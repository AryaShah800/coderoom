/**
 * Monaco from its ESM build, bundled by Next.js (Monaco's AMD `min/vs` build is deprecated and
 * embeds its own DOMPurify copy, which cannot be updated without editing vendor files).
 * Bundling the ESM build lets next.config.ts substitute the official, patched `dompurify` package
 * for Monaco's vendored copy at build time.
 *
 * This module is only imported by CodeEditor, which is loaded with next/dynamic and `ssr: false`,
 * so Monaco stays out of the initial bundle and never runs on the server.
 */
import * as monaco from "monaco-editor/editor/editor.main.js";

type WorkerFactory = { getWorker: (workerId: string, label: string) => Worker };

(self as unknown as { MonacoEnvironment: WorkerFactory }).MonacoEnvironment = {
  getWorker(_workerId, label) {
    if (label === "typescript" || label === "javascript") {
      return new Worker(new URL("./ts.worker.ts", import.meta.url), { type: "module", name: label });
    }
    return new Worker(new URL("./editor.worker.ts", import.meta.url), { type: "module", name: label });
  },
};

export { monaco };
