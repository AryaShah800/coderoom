"use client";

import { useEffect, useState } from "react";
import { getShared } from "@/lib/collab";
import { downloadTextFile, exportFilename } from "@/lib/export-file";
import { useRoomStore } from "@/store/room";

/** Saves the shared file from this browser's copy of the document. */
export function ExportButton({ roomId }: { roomId: string }) {
  const collab = useRoomStore((s) => s.collab);
  const language = useRoomStore((s) => s.language);

  return (
    <button
      type="button"
      disabled={!collab}
      onClick={() => {
        if (!collab) return;
        downloadTextFile(getShared(collab.doc).text.toString(), exportFilename(roomId, language));
      }}
      className="inline-flex h-10 items-center gap-2 rounded-md border border-line-strong bg-panel-2 px-3 text-xs font-medium transition hover:border-muted disabled:opacity-60"
    >
      <span aria-hidden="true">↓</span>
      Export file
    </button>
  );
}

/** Rooms are not stored anywhere durable; say so where people will see it. */
export function RoomLifetimeNotice({ roomId, ttlMinutes }: { roomId: string; ttlMinutes: number }) {
  const [dismissedRoom, setDismissedRoom] = useState<string | null>(null);
  const storageKey = `coderoom:room-lifetime-dismissed:${roomId}`;

  useEffect(() => {
    try {
      // Read browser storage after hydration, and again when the room changes.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDismissedRoom(sessionStorage.getItem(storageKey) === "true" ? roomId : null);
    } catch {
      // The notice still works when browser storage is unavailable.
    }
  }, [roomId, storageKey]);

  if (dismissedRoom === roomId) return null;

  return (
    <div data-testid="room-lifetime-notice" className="flex shrink-0 items-start gap-2 border-b border-line bg-panel px-4 py-1.5 text-xs text-muted">
      <p className="min-w-0 flex-1">
        Rooms live in the sync server&apos;s memory only. A room is deleted when the server restarts, and {ttlMinutes} minutes
        after the last person leaves. Use <strong className="font-semibold text-fg">Export file</strong> to keep your code.
      </p>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => {
          setDismissedRoom(roomId);
          try {
            sessionStorage.setItem(storageKey, "true");
          } catch {
            // Dismiss for this visit even if storage is unavailable.
          }
        }}
        className="inline-flex size-10 shrink-0 items-center justify-center rounded text-base transition hover:bg-panel-2 hover:text-fg"
      >
        <span aria-hidden="true">×</span>
      </button>
    </div>
  );
}
