/** Messages between the page and the sandbox workers (see sandbox-source.ts). */

export type OutStream = "stdout" | "stderr";

export type ToWorker =
  | { type: "init"; indexURL: string }
  | { type: "run"; code: string; stdin: string; maxChars: number };

export type FromWorker =
  | { type: "ready" }
  | { type: "init-error"; message: string }
  | { type: "out"; stream: OutStream; text: string }
  /** Output hit the cap; the page terminates the worker. */
  | { type: "capped" }
  | { type: "done"; ok: boolean; error?: string };

/** The subset of the Web Worker API the runner uses (so tests can drive a worker_threads adapter). */
export interface WorkerLike {
  postMessage(message: ToWorker): void;
  terminate(): void;
  onmessage: ((event: { data: FromWorker }) => void) | null;
  onerror: ((event: { message?: string }) => void) | null;
}

export type WorkerFactory = (source: string) => WorkerLike;

/** Pinned: the runtime is fetched from this exact CDN version, never "latest". */
export const PYODIDE_VERSION = "0.27.7";
export const PYODIDE_INDEX_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

export const JS_TIMEOUT_MS = 5_000;
export const PY_EXEC_TIMEOUT_MS = 10_000;
export const PY_LOAD_TIMEOUT_MS = 60_000;
