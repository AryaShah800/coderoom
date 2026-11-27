"use client";

import { useEffect, useState } from "react";

export function CopyLinkButton({ roomId }: { roomId: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  useEffect(() => {
    if (state === "idle") return;
    const timer = setTimeout(() => setState("idle"), 2000);
    return () => clearTimeout(timer);
  }, [state]);

  const copy = async () => {
    const url = `${window.location.origin}/room/${roomId}`;
    try {
      await navigator.clipboard.writeText(url);
      setState("copied");
    } catch {
      setState("failed");
    }
  };

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={copy}
        className="inline-flex h-10 min-w-[9.5rem] items-center justify-center gap-2 rounded-md border border-line-strong bg-panel-2 px-3 text-xs font-medium transition hover:border-muted"
      >
        <span aria-hidden="true">{state === "copied" ? "✓" : "⧉"}</span>
        {/* The label swaps in place, so the header doesn't shift when the link is copied. */}
        <span aria-hidden={state === "copied"}>{state === "copied" ? "Copied" : "Copy invite link"}</span>
      </button>
      <span role="status" aria-live="polite" className={state === "failed" ? "text-xs text-muted" : "sr-only"}>
        {state === "copied" ? "Link copied" : state === "failed" ? `Copy failed. Room code: ${roomId}` : ""}
      </span>
    </div>
  );
}
