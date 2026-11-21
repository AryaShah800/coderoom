import type { LanguageKey } from "./languages";

const EXTENSIONS: Record<LanguageKey, string> = {
  javascript: "js",
  typescript: "ts",
  python: "py",
  java: "java",
  cpp: "cpp",
  c: "c",
  go: "go",
  rust: "rs",
};

/** Java files must be named after their public class, which the starter template calls Main. */
export function exportFilename(roomId: string, language: LanguageKey): string {
  if (language === "java") return "Main.java";
  return `coderoom-${roomId}.${EXTENSIONS[language]}`;
}

/** Saves `text` as a UTF-8 file through a temporary link. Returns the file name used. */
export function downloadTextFile(text: string, filename: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.hidden = true;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
