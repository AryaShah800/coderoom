import { MAX_OUTPUT_CHARS, type RunResult } from "../run-contract";
import {
  JS_TIMEOUT_MS,
  PYODIDE_INDEX_URL,
  PY_EXEC_TIMEOUT_MS,
  PY_LOAD_TIMEOUT_MS,
  type FromWorker,
  type WorkerFactory,
  type WorkerLike,
} from "./protocol";
import { JS_WORKER_SOURCE, PYTHON_WORKER_SOURCE } from "./sandbox-source";

/** Judge0-compatible status ids, so browser runs render through the same output panel. */
const STATUS = {
  accepted: { id: 3, description: "Completed" },
  compile: { id: 6, description: "Syntax Error" },
  timeout: { id: 5, description: "Time Limit Exceeded" },
  runtime: { id: 11, description: "Runtime Error" },
  capped: { id: 11, description: "Output Limit Exceeded" },
  internal: { id: 13, description: "Runner Error" },
} as const;

export interface RunnerOptions {
  timeoutMs?: number;
  maxOutputChars?: number;
  signal?: AbortSignal;
  /** Human-readable phase ("Loading Python runtime…") for the UI. */
  onPhase?: (phase: string | null) => void;
}

export const blobWorkerFactory: WorkerFactory = (source) => {
  const url = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
  const worker = new Worker(url);
  // The worker has started loading its script; the URL is no longer needed.
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
  return worker as unknown as WorkerLike;
};

function emptyResult(status: RunResult["status"]): RunResult {
  return { status, stdout: "", stderr: "", compileOutput: "", message: "", time: null, memory: null, truncated: false };
}

const seconds = (ms: number) => (ms % 1000 ? (ms / 1000).toFixed(1) : String(ms / 1000));

/**
 * Collects the output of one `run` message. Settles on done, on the output cap, on a worker error,
 * on the timeout (this is what stops `while (true) {}` and never-resolving awaits: only the page
 * can terminate a worker that is stuck), or on abort.
 */
function collect(worker: WorkerLike, timeoutMs: number, signal?: AbortSignal): Promise<RunResult> {
  return new Promise<RunResult>((resolve) => {
    const started = performance.now();
    let stdout = "";
    let stderr = "";
    let settled = false;
    const settle = (status: RunResult["status"], extra: Partial<RunResult> = {}) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      resolve({
        ...emptyResult(status),
        stdout,
        stderr,
        time: (performance.now() - started) / 1000,
        ...extra,
      });
    };
    const timer = setTimeout(
      () => settle(STATUS.timeout, { message: `Stopped after ${seconds(timeoutMs)} s (time limit).` }),
      timeoutMs,
    );
    const onAbort = () => settle(STATUS.runtime, { message: "Stopped." });
    signal?.addEventListener("abort", onAbort);

    worker.onmessage = ({ data }: { data: FromWorker }) => {
      if (data.type === "out") {
        if (data.stream === "stdout") stdout += data.text;
        else stderr += data.text;
      } else if (data.type === "capped") {
        settle(STATUS.capped, { truncated: true, message: "Output limit reached; the program was stopped." });
      } else if (data.type === "done") {
        if (data.ok) settle(STATUS.accepted);
        else settle(STATUS.runtime, { stderr: stderr + (stderr && !stderr.endsWith("\n") ? "\n" : "") + (data.error ?? "") });
      }
    };
    worker.onerror = (event) => {
      settle(STATUS.runtime, { stderr: stderr + (event.message ?? "Uncaught error in the worker") });
    };
  });
}

async function transpileTypeScript(source: string): Promise<{ code: string } | { error: string }> {
  try {
    const { transform } = await import("sucrase");
    return { code: transform(source, { transforms: ["typescript"] }).code };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Runs JavaScript in a fresh, throwaway Web Worker. One worker per run: it is terminated when the
 * run settles, so timers or promises left behind cannot leak into the next run.
 */
export async function runJavaScript(
  source: string,
  options: RunnerOptions & { factory?: WorkerFactory } = {},
): Promise<RunResult> {
  const { timeoutMs = JS_TIMEOUT_MS, maxOutputChars = MAX_OUTPUT_CHARS, signal, factory = blobWorkerFactory } = options;
  let worker: WorkerLike | null = null;
  try {
    worker = factory(JS_WORKER_SOURCE);
    const result = collect(worker, timeoutMs, signal);
    worker.postMessage({ type: "run", code: source, stdin: "", maxChars: maxOutputChars });
    return await result;
  } catch (error) {
    return { ...emptyResult(STATUS.internal), message: error instanceof Error ? error.message : String(error) };
  } finally {
    worker?.terminate();
  }
}

export async function runTypeScript(source: string, options: RunnerOptions & { factory?: WorkerFactory } = {}): Promise<RunResult> {
  const out = await transpileTypeScript(source);
  if ("error" in out) return { ...emptyResult(STATUS.compile), compileOutput: out.error };
  return runJavaScript(out.code, options);
}

/**
 * Python via Pyodide (CPython compiled to WebAssembly). The runtime is fetched lazily from a
 * pinned jsDelivr version on the first Python run, then kept warm in one worker. A timeout or an
 * output-cap kill terminates that worker; the next run starts a new one (the browser cache makes
 * the reload cheaper than the first download).
 */
export class PythonRunner {
  private worker: WorkerLike | null = null;
  private ready: Promise<void> | null = null;

  constructor(
    private readonly factory: WorkerFactory = blobWorkerFactory,
    private readonly indexURL: string = PYODIDE_INDEX_URL,
    private readonly loadTimeoutMs: number = PY_LOAD_TIMEOUT_MS,
  ) {}

  private discard() {
    this.worker?.terminate();
    this.worker = null;
    this.ready = null;
  }

  private start(): Promise<void> {
    if (this.ready) return this.ready;
    const worker = this.factory(PYTHON_WORKER_SOURCE);
    this.worker = worker;
    this.ready = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.discard();
        reject(new Error(`Python runtime did not load within ${seconds(this.loadTimeoutMs)} s. Check your connection.`));
      }, this.loadTimeoutMs);
      worker.onmessage = ({ data }) => {
        if (data.type === "ready") {
          clearTimeout(timer);
          resolve();
        } else if (data.type === "init-error") {
          clearTimeout(timer);
          this.discard();
          reject(new Error(`Could not load the Python runtime: ${data.message}`));
        }
      };
      worker.onerror = (event) => {
        clearTimeout(timer);
        this.discard();
        reject(new Error(event.message ?? "Python worker failed to start"));
      };
      worker.postMessage({ type: "init", indexURL: this.indexURL });
    });
    return this.ready;
  }

  async run(source: string, stdin: string, options: RunnerOptions = {}): Promise<RunResult> {
    const { timeoutMs = PY_EXEC_TIMEOUT_MS, maxOutputChars = MAX_OUTPUT_CHARS, signal, onPhase } = options;
    try {
      if (!this.ready) onPhase?.("Loading the Python runtime (first run only)…");
      await this.start();
    } catch (error) {
      return { ...emptyResult(STATUS.internal), message: error instanceof Error ? error.message : String(error) };
    } finally {
      onPhase?.(null);
    }
    const worker = this.worker;
    if (!worker) return { ...emptyResult(STATUS.internal), message: "Python runtime is not available." };
    // The execution clock starts only now, after the runtime is ready.
    const result = collect(worker, timeoutMs, signal);
    worker.postMessage({ type: "run", code: source, stdin, maxChars: maxOutputChars });
    const outcome = await result;
    // A killed run leaves the worker stuck or flooded: drop it so the next run gets a fresh one.
    if (outcome.status.id === STATUS.timeout.id || outcome.truncated || signal?.aborted) this.discard();
    return outcome;
  }
}

export const pythonRunner = new PythonRunner();

export type BrowserLanguage = "javascript" | "typescript" | "python";

export function runInBrowser(
  language: BrowserLanguage,
  source: string,
  stdin: string,
  options: RunnerOptions = {},
): Promise<RunResult> {
  if (language === "python") return pythonRunner.run(source, stdin, options);
  if (language === "typescript") return runTypeScript(source, options);
  return runJavaScript(source, options);
}
