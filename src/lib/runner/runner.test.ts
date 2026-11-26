// @vitest-environment node
import { Worker as NodeWorker } from "node:worker_threads";
import { describe, expect, it, vi } from "vitest";
import { MAX_OUTPUT_CHARS } from "../run-contract";
import type { FromWorker, ToWorker, WorkerFactory, WorkerLike } from "./protocol";
import { PythonRunner, runJavaScript, runTypeScript } from "./index";

/**
 * Runs the real worker source text inside a node worker_threads worker, behind the same
 * onmessage/postMessage/terminate surface a browser Worker has. Infinite loops and output floods
 * therefore hit real threads that can only be stopped by terminate().
 */
const PRELUDE = `
const { parentPort } = require("node:worker_threads");
globalThis.self = globalThis;
globalThis.postMessage = (m) => parentPort.postMessage(m);
parentPort.on("message", (d) => { if (globalThis.onmessage) globalThis.onmessage({ data: d }); });
`;

const spawned: NodeWorker[] = [];

const nodeFactory: WorkerFactory = (source) => {
  const worker = new NodeWorker(PRELUDE + source, { eval: true });
  spawned.push(worker);
  const adapter: WorkerLike = {
    onmessage: null,
    onerror: null,
    postMessage: (m: ToWorker) => worker.postMessage(m),
    terminate: () => void worker.terminate(),
  };
  worker.on("message", (data: FromWorker) => adapter.onmessage?.({ data }));
  worker.on("error", (error) => adapter.onerror?.({ message: String(error?.stack ?? error) }));
  return adapter;
};

const run = (code: string, options: { timeoutMs?: number; maxOutputChars?: number } = {}) =>
  runJavaScript(code, { factory: nodeFactory, timeoutMs: 2_000, ...options });

describe("JavaScript runner (real worker source)", () => {
  it("captures console output and reports completion", async () => {
    const result = await run('console.log("hi", 1, { a: [1, 2] }); console.info("info");');
    expect(result.status).toMatchObject({ id: 3, description: "Completed" });
    expect(result.stdout).toBe('hi 1 { a: [ 1, 2 ] }\ninfo\n');
    expect(result.stderr).toBe("");
    expect(result.truncated).toBe(false);
  });

  it("routes console.error to stderr", async () => {
    const result = await run('console.error("bad"); console.log("ok");');
    expect(result.stderr).toBe("bad\n");
    expect(result.stdout).toBe("ok\n");
  });

  it("reports a thrown error as a runtime error and keeps earlier output", async () => {
    const result = await run('console.log("before"); throw new TypeError("boom");');
    expect(result.status.id).toBe(11);
    expect(result.stdout).toBe("before\n");
    expect(result.stderr).toContain("TypeError: boom");
  });

  it("supports top-level await and timers that fire after the script body returns", async () => {
    const result = await run(
      'await new Promise((r) => setTimeout(r, 20)); console.log("awaited"); setTimeout(() => console.log("later"), 30);',
    );
    expect(result.status.id).toBe(3);
    expect(result.stdout).toBe("awaited\nlater\n");
  });

  it("stops a synchronous infinite loop at the timeout", async () => {
    const started = Date.now();
    const result = await run("console.log('start'); while (true) {}", { timeoutMs: 1_000 });
    expect(result.status).toMatchObject({ id: 5, description: "Time Limit Exceeded" });
    expect(result.stdout).toBe("start\n");
    expect(result.message).toContain("1 s");
    expect(Date.now() - started).toBeLessThan(2_000);
  });

  it("stops a promise that never settles", async () => {
    const result = await run("await new Promise(() => {});", { timeoutMs: 300 });
    expect(result.status.id).toBe(5);
  });

  it("stops a setInterval that never ends", async () => {
    const result = await run('setInterval(() => console.log("tick"), 10);', { timeoutMs: 1_000 });
    expect(result.status.id).toBe(5);
    expect(result.stdout).toContain("tick");
  });

  it("cuts output at the cap, flags it, and stops the program", async () => {
    const started = Date.now();
    const result = await run('while (true) console.log("x".repeat(100));', { maxOutputChars: 1_000, timeoutMs: 5_000 });
    expect(result.status).toMatchObject({ id: 11, description: "Output Limit Exceeded" });
    expect(result.truncated).toBe(true);
    expect(result.stdout.length).toBe(1_000);
    // It was stopped by the cap, not by the 5 s timeout.
    expect(Date.now() - started).toBeLessThan(3_000);
  });

  it("applies the shared output cap by default", async () => {
    const result = await run('for (let i = 0; i < 100000; i++) console.log("0123456789");');
    expect(result.truncated).toBe(true);
    expect(result.stdout.length + result.stderr.length).toBeLessThanOrEqual(MAX_OUTPUT_CHARS);
  });

  it("shadows network and storage globals", async () => {
    const result = await run("console.log(typeof fetch, typeof XMLHttpRequest, typeof WebSocket, typeof indexedDB);");
    expect(result.stdout).toBe("undefined undefined undefined undefined\n");
  });

  it("terminates its worker after every run", async () => {
    const before = spawned.length;
    await run("console.log(1)");
    await run("while(true){}", { timeoutMs: 100 });
    const mine = spawned.slice(before);
    expect(mine).toHaveLength(2);
    // threadId becomes -1 once a worker has exited.
    await vi.waitFor(() => expect(mine.every((w) => w.threadId === -1)).toBe(true));
  });
});

describe("TypeScript runner", () => {
  it("strips types and runs the result", async () => {
    const result = await runTypeScript(
      "interface P { n: string }\nconst p: P = { n: 'ts' };\nconst f = (x: number): number => x * 2;\nconsole.log(p.n, f(21));",
      { factory: nodeFactory, timeoutMs: 2_000 },
    );
    expect(result.status.id).toBe(3);
    expect(result.stdout).toBe("ts 42\n");
  });

  it("reports a syntax error without starting a worker", async () => {
    const before = spawned.length;
    const result = await runTypeScript("const = ;", { factory: nodeFactory });
    expect(result.status).toMatchObject({ id: 6, description: "Syntax Error" });
    expect(result.compileOutput).not.toBe("");
    expect(spawned.length).toBe(before);
  });

  it("does not type-check (a type error still runs)", async () => {
    const result = await runTypeScript("const n: number = 'x' as unknown as number; console.log(typeof n);", {
      factory: nodeFactory,
    });
    expect(result.stdout).toBe("string\n");
  });
});

/** Scripted stand-in for the Pyodide worker: the real one needs a network download. */
function fakePythonFactory(script: (m: ToWorker, reply: (d: FromWorker) => void) => void) {
  const created: { terminated: boolean; sent: ToWorker[] }[] = [];
  const factory: WorkerFactory = () => {
    const state = { terminated: false, sent: [] as ToWorker[] };
    created.push(state);
    const worker: WorkerLike = {
      onmessage: null,
      onerror: null,
      postMessage: (m) => {
        state.sent.push(m);
        queueMicrotask(() => script(m, (data) => !state.terminated && worker.onmessage?.({ data })));
      },
      terminate: () => {
        state.terminated = true;
      },
    };
    return worker;
  };
  return { factory, created };
}

describe("PythonRunner protocol", () => {
  const healthy = (m: ToWorker, reply: (d: FromWorker) => void) => {
    if (m.type === "init") reply({ type: "ready" });
    else {
      reply({ type: "out", stream: "stdout", text: "hello\n" });
      reply({ type: "done", ok: true });
    }
  };

  it("loads once, reports the load phase, then reuses the warm worker", async () => {
    const { factory, created } = fakePythonFactory(healthy);
    const runner = new PythonRunner(factory, "https://example.test/pyodide/");
    const phases: (string | null)[] = [];
    const first = await runner.run("print('hello')", "", { onPhase: (p) => phases.push(p) });
    const second = await runner.run("print('hello')", "", { onPhase: (p) => phases.push(p) });
    expect(first.stdout).toBe("hello\n");
    expect(first.status.id).toBe(3);
    expect(second.status.id).toBe(3);
    expect(created).toHaveLength(1);
    expect(created[0].sent[0]).toEqual({ type: "init", indexURL: "https://example.test/pyodide/" });
    expect(phases[0]).toMatch(/Loading the Python runtime/);
    expect(phases.filter((p) => p !== null)).toHaveLength(1);
  });

  it("never sends the code when stopped while the runtime is loading", async () => {
    const { factory, created } = fakePythonFactory((m, reply) => {
      if (m.type === "init") setTimeout(() => reply({ type: "ready" }), 50);
      else reply({ type: "done", ok: true });
    });
    const controller = new AbortController();
    const pending = new PythonRunner(factory).run("print('x')", "", { signal: controller.signal });
    controller.abort();
    const result = await pending;
    expect(result.message).toBe("Stopped.");
    expect(created[0].sent.map((m) => m.type)).toEqual(["init"]);
  });

  it("starts the execution clock only after the runtime is ready", async () => {
    // Loading takes 150 ms; the exec timeout is 100 ms. A clock started too early would time out.
    const { factory } = fakePythonFactory((m, reply) => {
      if (m.type === "init") setTimeout(() => reply({ type: "ready" }), 150);
      else reply({ type: "done", ok: true });
    });
    const result = await new PythonRunner(factory).run("pass", "", { timeoutMs: 100 });
    expect(result.status.id).toBe(3);
  });

  it("kills a run that exceeds the time limit and respawns on the next run", async () => {
    let hang = true;
    const { factory, created } = fakePythonFactory((m, reply) => {
      if (m.type === "init") reply({ type: "ready" });
      else if (hang) reply({ type: "out", stream: "stdout", text: "partial\n" });
      else reply({ type: "done", ok: true });
    });
    const runner = new PythonRunner(factory);
    const killed = await runner.run("while True: pass", "", { timeoutMs: 100 });
    expect(killed.status.id).toBe(5);
    expect(killed.stdout).toBe("partial\n");
    expect(created[0].terminated).toBe(true);
    hang = false;
    const next = await runner.run("print(1)", "", { timeoutMs: 100 });
    expect(next.status.id).toBe(3);
    expect(created).toHaveLength(2);
  });

  it("stops and discards the worker when output hits the cap", async () => {
    const { factory, created } = fakePythonFactory((m, reply) => {
      if (m.type === "init") reply({ type: "ready" });
      else {
        reply({ type: "out", stream: "stdout", text: "x".repeat(10) });
        reply({ type: "capped" });
      }
    });
    const result = await new PythonRunner(factory).run("print('x')", "", { maxOutputChars: 10 });
    expect(result.truncated).toBe(true);
    expect(result.status.description).toBe("Output Limit Exceeded");
    expect(created[0].terminated).toBe(true);
  });

  it("returns a runner error (not a hang) when the runtime fails to load", async () => {
    const { factory, created } = fakePythonFactory((m, reply) => {
      if (m.type === "init") reply({ type: "init-error", message: "network down" });
    });
    const result = await new PythonRunner(factory).run("pass", "");
    expect(result.status.id).toBe(13);
    expect(result.message).toContain("network down");
    expect(created[0].terminated).toBe(true);
  });

  it("gives up when loading takes longer than the load timeout", async () => {
    const { factory } = fakePythonFactory(() => {});
    const result = await new PythonRunner(factory, "https://example.test/", 100).run("pass", "");
    expect(result.status.id).toBe(13);
    expect(result.message).toMatch(/did not load/);
  });

  it("reports a Python exception as a runtime error with its traceback", async () => {
    const { factory } = fakePythonFactory((m, reply) => {
      if (m.type === "init") reply({ type: "ready" });
      else reply({ type: "done", ok: false, error: "Traceback...\nZeroDivisionError: division by zero" });
    });
    const result = await new PythonRunner(factory).run("1/0", "");
    expect(result.status.id).toBe(11);
    expect(result.stderr).toContain("ZeroDivisionError");
  });
});
