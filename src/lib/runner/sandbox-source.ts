/**
 * Source text of the two worker programs. They are plain strings (not bundled modules) so they can
 * be started from a Blob URL without bundler worker configuration, and so unit tests can run the
 * very same text inside a node worker_threads adapter.
 *
 * Isolation is best effort, not a security boundary: a blob worker shares the page's origin. It has
 * no DOM and no access to the page's variables; network and storage globals are shadowed for the
 * JavaScript worker. The Python worker keeps network access because Pyodide needs it to load.
 */

const SHARED = String.raw`
const post = (m) => self.postMessage(m);
function makeEmitter(maxChars) {
  let used = 0;
  let capped = false;
  return function emit(stream, text) {
    if (capped) return;
    const room = maxChars - used;
    if (text.length > room) {
      text = text.slice(0, Math.max(room, 0));
      capped = true;
    }
    used += text.length;
    if (text) post({ type: "out", stream, text });
    if (capped) post({ type: "capped" });
  };
}
`;

export const JS_WORKER_SOURCE = String.raw`
"use strict";
${SHARED}
for (const name of ["fetch", "XMLHttpRequest", "WebSocket", "EventSource", "importScripts", "indexedDB", "caches", "BroadcastChannel", "Worker", "SharedWorker"]) {
  try {
    Object.defineProperty(self, name, { value: undefined, writable: false, configurable: true });
  } catch (_) {}
}

function show(value, depth, seen) {
  if (typeof value === "string") return depth === 0 ? value : JSON.stringify(value);
  if (typeof value === "bigint") return value + "n";
  if (typeof value === "function") return "[Function" + (value.name ? ": " + value.name : "") + "]";
  if (typeof value === "symbol") return value.toString();
  if (value === null || typeof value !== "object") return String(value);
  if (value instanceof Error) return value.stack || value.name + ": " + value.message;
  if (seen.includes(value)) return "[Circular]";
  if (depth > 3) return Array.isArray(value) ? "[Array]" : "[Object]";
  const next = seen.concat([value]);
  if (Array.isArray(value)) return "[ " + value.map((v) => show(v, depth + 1, next)).join(", ") + " ]";
  if (value instanceof Map) return "Map(" + value.size + ") { " + Array.from(value, ([k, v]) => show(k, depth + 1, next) + " => " + show(v, depth + 1, next)).join(", ") + " }";
  if (value instanceof Set) return "Set(" + value.size + ") { " + Array.from(value, (v) => show(v, depth + 1, next)).join(", ") + " }";
  try {
    const keys = Object.keys(value);
    return "{ " + keys.map((k) => k + ": " + show(value[k], depth + 1, next)).join(", ") + " }";
  } catch (_) {
    return "[Object]";
  }
}

self.onmessage = async function (event) {
  const { code, maxChars } = event.data;
  const emit = makeEmitter(maxChars);
  const line = (args) => args.map((a) => show(a, 0, [])).join(" ") + "\n";
  const sandboxConsole = {
    log: (...a) => emit("stdout", line(a)),
    info: (...a) => emit("stdout", line(a)),
    debug: (...a) => emit("stdout", line(a)),
    warn: (...a) => emit("stderr", line(a)),
    error: (...a) => emit("stderr", line(a)),
  };

  // Pending timers are tracked so setTimeout callbacks still run after the script body returns.
  const timeouts = new Set();
  const intervals = new Set();
  let bodyDone = false;
  let finished = false;
  const finish = (ok, error) => {
    if (finished) return;
    finished = true;
    post({ type: "done", ok, error });
  };
  const maybeDone = () => {
    if (bodyDone && timeouts.size === 0 && intervals.size === 0) finish(true);
  };
  const realSetTimeout = self.setTimeout.bind(self);
  const realSetInterval = self.setInterval.bind(self);
  const realClearTimeout = self.clearTimeout.bind(self);
  const realClearInterval = self.clearInterval.bind(self);
  const guarded = (fn) => (...args) => {
    try {
      return fn(...args);
    } catch (err) {
      finish(false, String((err && err.stack) || err));
    }
  };
  const sbSetTimeout = (fn, ms, ...args) => {
    const id = realSetTimeout(guarded(() => {
      timeouts.delete(id);
      if (typeof fn === "function") fn(...args);
      maybeDone();
    }), ms);
    timeouts.add(id);
    return id;
  };
  const sbSetInterval = (fn, ms, ...args) => {
    const id = realSetInterval(guarded(() => { if (typeof fn === "function") fn(...args); }), ms);
    intervals.add(id);
    return id;
  };
  const sbClearTimeout = (id) => { timeouts.delete(id); realClearTimeout(id); maybeDone(); };
  const sbClearInterval = (id) => { intervals.delete(id); realClearInterval(id); maybeDone(); };

  try {
    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
    const body = new AsyncFunction("console", "setTimeout", "setInterval", "clearTimeout", "clearInterval", code);
    await body(sandboxConsole, sbSetTimeout, sbSetInterval, sbClearTimeout, sbClearInterval);
    bodyDone = true;
    maybeDone();
  } catch (err) {
    finish(false, String((err && err.stack) || err));
  }
};
`;

export const PYTHON_WORKER_SOURCE = String.raw`
${SHARED}
let pyodide = null;

self.onmessage = async function (event) {
  const m = event.data;
  if (m.type === "init") {
    try {
      self.importScripts(m.indexURL + "pyodide.js");
      pyodide = await self.loadPyodide({ indexURL: m.indexURL });
      post({ type: "ready" });
    } catch (err) {
      post({ type: "init-error", message: String((err && err.message) || err) });
    }
    return;
  }
  if (m.type === "run") {
    const emit = makeEmitter(m.maxChars);
    pyodide.setStdout({ batched: (s) => emit("stdout", s + "\n") });
    pyodide.setStderr({ batched: (s) => emit("stderr", s + "\n") });
    const lines = m.stdin ? m.stdin.split("\n") : [];
    pyodide.setStdin({ stdin: () => (lines.length ? lines.shift() : undefined) });
    // Free the per-run globals even when the user's code raises, or the long-lived worker leaks.
    const globals = pyodide.globals.get("dict")();
    try {
      await pyodide.runPythonAsync(m.code, { globals });
      post({ type: "done", ok: true });
    } catch (err) {
      post({ type: "done", ok: false, error: String((err && err.message) || err) });
    } finally {
      globals.destroy();
    }
  }
};
`;
