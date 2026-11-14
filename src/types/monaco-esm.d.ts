// Monaco ships types for its root entry only; these subpath entries expose the same API.
declare module "monaco-editor/editor/editor.main.js" {
  export * from "monaco-editor";
}
declare module "monaco-editor/editor/editor.api.js" {
  export * from "monaco-editor";
}
declare module "monaco-editor/editor/editor.worker.js";
declare module "monaco-editor/language/typescript/ts.worker.js";
