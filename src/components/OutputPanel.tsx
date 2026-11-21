"use client";

import { getLanguage, needsJudge0, type LanguageKey } from "@/lib/languages";
import { isSuccessfulRun, type RunResult } from "@/lib/run-contract";
import type { SharedRun } from "@/lib/collab";

interface OutputPanelProps {
  run: SharedRun | null;
  isRunning: boolean;
  /** null while unknown */
  configured: boolean | null;
  selfName: string;
  /** Language currently selected in the room (decides which hints apply). */
  language?: LanguageKey;
  /** What a run in progress is waiting on, if anything. */
  phase?: string | null;
}

const lineCount = (text: string) => (text ? text.replace(/\n$/, "").split("\n").length : 0);

/** One-line summary read out by screen readers when a run finishes. */
export function summarizeRun(run: SharedRun, selfName: string): string {
  const who = run.by === selfName ? "Your run" : `${run.by}'s run`;
  if (run.error) return `${who} failed: ${run.error.message}`;
  const result = run.result as RunResult;
  const lines = lineCount(result.stdout);
  return `${who} finished: ${result.status.description}. ${lines} line${lines === 1 ? "" : "s"} of output.`;
}

function Stream({ label, text, tone }: { label: string; text: string; tone?: "bad" }) {
  if (!text) return null;
  return (
    <section aria-label={label} className="flex flex-col gap-1">
      <h3 className="text-xs font-semibold tracking-wide text-muted uppercase">{label}</h3>
      <pre
        tabIndex={0}
        className={`max-h-72 overflow-auto rounded-md border border-line bg-ink p-3 font-mono text-[13px] leading-relaxed whitespace-pre-wrap break-words ${tone === "bad" ? "text-bad" : "text-fg"}`}
      >
        {text}
      </pre>
    </section>
  );
}

export function OutputPanel({ run, isRunning, configured, selfName, language, phase }: OutputPanelProps) {
  const announcement = isRunning ? "Running code…" : run ? summarizeRun(run, selfName) : "";

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {configured === false && !run && language !== undefined && needsJudge0(language) && (
        <div className="rounded-md border border-warn/30 bg-warn/10 p-3 text-sm text-warn">
          <p className="font-semibold">Run is not configured here</p>
          <p className="mt-1 text-warn/90">
            This server has no Judge0 endpoint set (JUDGE0_URL). Editing and live collaboration still work.
          </p>
        </div>
      )}

      {isRunning && (
        <div className="flex flex-col gap-2">
          {phase && <p className="text-sm text-muted">{phase}</p>}
          <div aria-hidden="true" className="flex flex-col gap-2">
          <div className="h-3 w-40 animate-pulse rounded bg-line" />
          <div className="h-20 animate-pulse rounded bg-line/60" />
          </div>
        </div>
      )}

      {!isRunning && !run && (language === undefined || !needsJudge0(language) || configured !== false) && (
        <p className="text-sm text-muted">
          Press <kbd className="rounded border border-line-strong px-1 font-mono text-xs">Ctrl</kbd> +{" "}
          <kbd className="rounded border border-line-strong px-1 font-mono text-xs">Enter</kbd> or Run to execute the code.
          Output is shared with everyone in the room.
        </p>
      )}

      {!isRunning && run?.error && (
        <div role="alert" className="rounded-md border border-bad/40 bg-bad/10 p-3 text-sm text-bad">
          <p className="font-semibold">
            {run.error.code === "not_configured" ? "Run is not configured here" : "Could not run the code"}
          </p>
          <p className="mt-1">{run.error.message}</p>
          <p className="mt-2 text-xs text-muted">
            {run.by === selfName ? "You" : run.by} tried {getLanguage(run.language).label}
          </p>
        </div>
      )}

      {!isRunning && run?.result && (
        <div className="flex min-h-0 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <span
              className={`rounded-full px-2 py-0.5 font-semibold ${isSuccessfulRun(run.result) ? "bg-ok/15 text-ok" : "bg-bad/15 text-bad"}`}
            >
              {run.result.status.description}
            </span>
            {run.result.time !== null && <span className="text-muted">{run.result.time.toFixed(3)} s</span>}
            {run.result.memory !== null && (
              <span className="text-muted">{(run.result.memory / 1024).toFixed(1)} MB</span>
            )}
            <span className="text-muted">
              · {run.by === selfName ? "you" : run.by}, {getLanguage(run.language).label}
              {run.runtime === "browser" ? " (in browser)" : run.runtime === "judge0" ? " (Judge0)" : ""}
            </span>
          </div>
          <Stream label="Output" text={run.result.stdout} />
          <Stream label="Compiler output" text={run.result.compileOutput} tone="bad" />
          <Stream label="Errors" text={run.result.stderr} tone="bad" />
          <Stream label="Message" text={run.result.message} />
          {!run.result.stdout && !run.result.stderr && !run.result.compileOutput && (
            <p className="text-sm text-muted">The program finished with no output.</p>
          )}
          {run.result.truncated && <p className="text-xs text-warn">Output was cut to 20,000 characters.</p>}
        </div>
      )}
    </div>
  );
}
