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
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={copy}
        className="inline-flex h-8 items-center gap-2 rounded-md border border-line-strong bg-panel-2 px-3 text-xs font-medium transition hover:border-muted"
      >
        <span aria-hidden="true">⧉</span>
        Copy invite link
      </button>
      <span role="status" aria-live="polite" className="text-xs text-muted">
        {state === "copied" ? "Link copied" : state === "failed" ? `Copy failed. Room code: ${roomId}` : ""}
      </span>
    </div>
  );
}
