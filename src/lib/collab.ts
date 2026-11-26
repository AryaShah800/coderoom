import * as Y from "yjs";
import { DEFAULT_LANGUAGE, getLanguage, isLanguageKey, isUntouchedTemplate, type LanguageKey } from "./languages";
import type { RunErrorBody, RunResult } from "./run-contract";
import { sanitizeName } from "./participants";

/**
 * Shared room state, stored in one Y.Doc per room:
 * - text "code": the editor content (bound to Monaco by y-monaco)
 * - map "meta": { language, lastRun }
 */
export const getShared = (doc: Y.Doc) => ({
  text: doc.getText("code"),
  meta: doc.getMap<unknown>("meta"),
});

export interface SharedRun {
  by: string;
  language: LanguageKey;
  at: number;
  /** Where it ran. Absent on runs from older clients. */
  runtime?: "browser" | "judge0";
  result?: RunResult;
  error?: RunErrorBody["error"];
}

export function readLanguage(doc: Y.Doc): LanguageKey {
  const value = getShared(doc).meta.get("language");
  return isLanguageKey(value) ? value : DEFAULT_LANGUAGE;
}

/**
 * Seeds a brand-new room with a language and starter code. Runs after the first sync with the
 * server, so an existing room is never overwritten.
 */
export function initializeRoom(doc: Y.Doc): boolean {
  const { text, meta } = getShared(doc);
  if (meta.has("language")) return false;
  doc.transact(() => {
    meta.set("language", DEFAULT_LANGUAGE);
    if (text.length === 0) text.insert(0, getLanguage(DEFAULT_LANGUAGE).template);
  });
  return true;
}

/**
 * Switches the room language for everyone. If the code is still the untouched starter
 * template (or empty), it is swapped for the new language's template; real code is kept.
 */
export function changeLanguage(doc: Y.Doc, next: LanguageKey): void {
  const { text, meta } = getShared(doc);
  const current = readLanguage(doc);
  if (current === next && meta.has("language")) return;
  doc.transact(() => {
    if (isUntouchedTemplate(text.toString(), current)) {
      text.delete(0, text.length);
      text.insert(0, getLanguage(next).template);
    }
    meta.set("language", next);
  });
}

export function publishRun(doc: Y.Doc, run: SharedRun): void {
  getShared(doc).meta.set("lastRun", { ...run, by: sanitizeName(run.by) });
}

/** Reads the last run from the doc. Peers are untrusted, so the shape is checked. */
export function readLastRun(doc: Y.Doc): SharedRun | null {
  const raw = getShared(doc).meta.get("lastRun") as Partial<SharedRun> | undefined;
  if (!raw || typeof raw !== "object" || !isLanguageKey(raw.language) || typeof raw.at !== "number") return null;
  const hasResult = typeof raw.result === "object" && raw.result !== null && typeof raw.result.status?.id === "number";
  const hasError = typeof raw.error === "object" && raw.error !== null && typeof raw.error.message === "string";
  if (!hasResult && !hasError) return null;
  return {
    by: sanitizeName(raw.by) || "Someone",
    language: raw.language,
    at: raw.at,
    ...(raw.runtime === "browser" || raw.runtime === "judge0" ? { runtime: raw.runtime } : {}),
    ...(hasResult ? { result: normalizeRunResult(raw.result as Partial<RunResult>) } : {}),
    ...(hasError ? { error: { code: String(raw.error!.code ?? "unknown"), message: raw.error!.message } as SharedRun["error"] } : {}),
  };
}

/**
 * lastRun comes from any peer in the room, so every field is untrusted. Coerce it to a
 * well-formed RunResult so one malformed update cannot crash every participant's output panel.
 */
function normalizeRunResult(raw: Partial<RunResult>): RunResult {
  const str = (value: unknown) => (typeof value === "string" ? value : "");
  const num = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : null);
  return {
    status: { id: raw.status!.id, description: str(raw.status?.description) || "Finished" },
    stdout: str(raw.stdout),
    stderr: str(raw.stderr),
    compileOutput: str(raw.compileOutput),
    message: str(raw.message),
    time: num(raw.time),
    memory: num(raw.memory),
    truncated: Boolean(raw.truncated),
  };
}
