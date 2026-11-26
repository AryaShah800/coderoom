"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getShared, publishRun, type SharedRun } from "@/lib/collab";
import { requestRun } from "@/lib/run-client";
import { runInBrowser, type BrowserLanguage } from "@/lib/runner";
import { getLanguage } from "@/lib/languages";
import { useRoomStore } from "@/store/room";

/** Whether this deployment has Judge0 configured (GET /api/run). null = unknown. */
export function useRunAvailability() {
  const [configured, setConfigured] = useState<boolean | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch(new URL("/api/run", window.location.origin), { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((json: { configured?: unknown } | null) => {
        if (json && typeof json.configured === "boolean") setConfigured(json.configured);
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);
  return configured;
}

/**
 * Runs the shared code through /api/run and publishes the result into the Y.Doc,
 * so every participant sees the same output. `cancel` stops this person's run.
 */
export function useRunCode(selfName: string, stdin: string) {
  const inFlight = useRef<AbortController | null>(null);

  useEffect(() => () => inFlight.current?.abort(), []);

  const cancel = useCallback(() => {
    const controller = inFlight.current;
    if (!controller) return;
    // Release the UI now; the aborted run settles in the background and publishes nothing.
    inFlight.current = null;
    controller.abort();
    const { setRunning, setRunPhase } = useRoomStore.getState();
    setRunPhase(null);
    setRunning(false);
  }, []);

  const run = useCallback(async () => {
    const { collab, language, isRunning, setRunning, setLastRun, setRunPhase } = useRoomStore.getState();
    if (!collab || isRunning) return;
    const source = getShared(collab.doc).text.toString();
    const controller = new AbortController();
    inFlight.current = controller;
    setRunning(true);
    try {
      const info = getLanguage(language);
      if (info.runtime === "browser") {
        const result = await runInBrowser(info.key as BrowserLanguage, source, stdin, {
          signal: controller.signal,
          onPhase: setRunPhase,
        });
        if (!controller.signal.aborted) {
          publishRun(collab.doc, { by: selfName, language, at: Date.now(), runtime: "browser", result });
        }
        return;
      }
      const outcome = await requestRun({ language, source, stdin }, controller.signal);
      const run: SharedRun = outcome.ok
        ? { by: selfName, language, at: Date.now(), runtime: "judge0", result: outcome.result }
        : { by: selfName, language, at: Date.now(), runtime: "judge0", error: outcome.error as SharedRun["error"] };
      // Configuration and validation problems are local to this person; real results are shared.
      if (outcome.ok || outcome.error.code === "upstream_timeout" || outcome.error.code === "upstream_error") {
        publishRun(collab.doc, run);
      } else {
        setLastRun(run);
      }
    } catch (error) {
      if ((error as { name?: string })?.name !== "AbortError") throw error;
    } finally {
      // Only the run that is still current may clear the running flag; a cancelled run
      // settling late must not end a newer run's "Running…" state.
      if (inFlight.current === controller) {
        inFlight.current = null;
        useRoomStore.getState().setRunning(false);
      }
    }
  }, [selfName, stdin]);

  return { run, cancel };
}
