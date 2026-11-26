"use client";

import { useEffect, useRef, useState } from "react";
import Editor, { loader, type BeforeMount, type OnMount } from "@monaco-editor/react";
import type { editor as MonacoEditor } from "monaco-editor";
import { getShared } from "@/lib/collab";
import { remoteCursorIndex } from "@/lib/presence";
import { monaco } from "@/lib/monaco/runtime";
import { getLanguage } from "@/lib/languages";
import { useRoomStore } from "@/store/room";
import { EditorSkeleton } from "./EditorSkeleton";

// Use the Monaco instance bundled from the ESM build (see src/lib/monaco/runtime.ts) instead of
// letting @monaco-editor/react fetch the AMD build from a CDN.
loader.config({ monaco });

const defineTheme: BeforeMount = (monaco) => {
  monaco.editor.defineTheme("coderoom-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "7d8590", fontStyle: "italic" },
      { token: "keyword", foreground: "f5a524" },
      { token: "string", foreground: "4ade80" },
      { token: "number", foreground: "38bdf8" },
    ],
    colors: {
      "editor.background": "#0f1115",
      "editor.lineHighlightBackground": "#171b21",
      "editorLineNumber.foreground": "#7d8590",
      "editorLineNumber.activeForeground": "#e7e9ec",
      "editorCursor.foreground": "#f5a524",
      "editor.selectionBackground": "#f5a52440",
      "editorIndentGuide.background1": "#1f242c",
    },
  });
};

/**
 * Monaco bound to the room's shared Y.Text via y-monaco. This module is loaded with
 * next/dynamic and `ssr: false`, so Monaco, its workers and the binding are only fetched on the room page.
 */
export default function CodeEditor({ onRun }: { onRun: () => void }) {
  const collab = useRoomStore((s) => s.collab);
  const language = useRoomStore((s) => s.language);
  const [editor, setEditor] = useState<MonacoEditor.IStandaloneCodeEditor | null>(null);
  const onRunRef = useRef(onRun);

  useEffect(() => {
    onRunRef.current = onRun;
  }, [onRun]);

  const handleMount: OnMount = (instance, monaco) => {
    instance.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => onRunRef.current());
    setEditor(instance);
  };

  useEffect(() => {
    if (!editor || !collab) return;
    const model = editor.getModel();
    if (!model) return;
    let cancelled = false;
    let binding: { destroy: () => void } | null = null;
    import("y-monaco").then(({ MonacoBinding }) => {
      if (cancelled) return;
      binding = new MonacoBinding(getShared(collab.doc).text, model, new Set([editor]), collab.provider.awareness);
    });
    return () => {
      cancelled = true;
      binding?.destroy();
    };
  }, [editor, collab]);

  // Follow mode: keep the followed collaborator's caret in view whenever it moves.
  const followId = useRoomStore((s) => s.followId);
  useEffect(() => {
    if (!editor || !collab || followId === null) return;
    const { awareness } = collab.provider;
    const { text } = getShared(collab.doc);
    const reveal = () => {
      const model = editor.getModel();
      const index = remoteCursorIndex(collab.doc, text, awareness.getStates().get(followId) as Record<string, unknown> | undefined);
      if (!model || index === null) return;
      // Immediate (1) rather than smooth, so tests and fast typists do not chase a moving target.
      editor.revealPositionInCenterIfOutsideViewport(model.getPositionAt(index), 1);
    };
    reveal();
    awareness.on("update", reveal);
    return () => awareness.off("update", reveal);
  }, [editor, collab, followId]);

  return (
    <Editor
      height="100%"
      defaultValue=""
      language={getLanguage(language).monaco}
      theme="coderoom-dark"
      beforeMount={defineTheme}
      onMount={handleMount}
      loading={<EditorSkeleton />}
      options={{
        ariaLabel: "Code editor. Press Ctrl+M to toggle whether Tab moves focus out of the editor.",
        fontFamily: "ui-monospace, 'Cascadia Code', 'JetBrains Mono', Menlo, Consolas, monospace",
        fontSize: 14,
        lineHeight: 22,
        minimap: { enabled: false },
        padding: { top: 16, bottom: 16 },
        scrollBeyondLastLine: false,
        smoothScrolling: true,
        tabSize: 2,
        automaticLayout: true,
        renderLineHighlight: "line",
        fixedOverflowWidgets: true,
      }}
    />
  );
}
