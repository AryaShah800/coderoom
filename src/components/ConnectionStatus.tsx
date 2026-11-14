"use client";

import { useEffect, useState } from "react";
import { SLOW_CONNECT_MS } from "@/lib/config";
import { useRoomStore } from "@/store/room";

type Display = { label: string; tone: string; pulse: boolean };

export function describeConnection(status: string, everConnected: boolean, synced: boolean): Display {
  if (status === "connected") {
    return synced
      ? { label: "Live", tone: "bg-ok", pulse: false }
      : { label: "Syncing…", tone: "bg-warn", pulse: true };
  }
  if (status === "connecting") {
    return everConnected
      ? { label: "Reconnecting…", tone: "bg-warn", pulse: true }
      : { label: "Connecting…", tone: "bg-warn", pulse: true };
  }
  return { label: "Offline", tone: "bg-bad", pulse: false };
}

export function ConnectionStatus() {
  const status = useRoomStore((s) => s.status);
  const everConnected = useRoomStore((s) => s.everConnected);
  const synced = useRoomStore((s) => s.synced);
  const display = describeConnection(status, everConnected, synced);

  return (
    <p
      role="status"
      aria-live="polite"
      data-status={status}
      className="inline-flex items-center gap-2 rounded-full border border-line bg-panel-2 px-3 py-1 text-xs font-medium"
    >
      <span aria-hidden="true" className={`size-2 rounded-full ${display.tone} ${display.pulse ? "pulse-dot" : ""}`} />
      <span>
        <span className="sr-only">Connection: </span>
        {display.label}
      </span>
    </p>
  );
}

/**
 * Banner shown when the room is not live: explains free-tier cold starts on first connect,
 * and that edits are kept and merged after a dropped connection.
 */
export function ConnectionBanner() {
  const status = useRoomStore((s) => s.status);
  const everConnected = useRoomStore((s) => s.everConnected);
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (status === "connected") return;
    const timer = setTimeout(() => setSlow(true), SLOW_CONNECT_MS);
    return () => {
      clearTimeout(timer);
      setSlow(false);
    };
  }, [status]);

  if (status === "connected") return null;

  let message: string | null = null;
  if (everConnected) {
    message =
      "Connection to the sync server dropped. Keep typing: your edits are kept on this device and merge in when the connection returns.";
  } else if (slow) {
    message =
      "Still connecting to the sync server. A free-tier server can take up to a minute to wake up. You can start typing; edits sync once it is reachable.";
  }
  if (!message) return null;

  return (
    <div role="status" className="border-b border-warn/30 bg-warn/10 px-4 py-2 text-sm text-warn">
      {message}
    </div>
  );
}
