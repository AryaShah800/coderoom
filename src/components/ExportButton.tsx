"use client";

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
      className="inline-flex h-8 items-center gap-2 rounded-md border border-line-strong bg-panel-2 px-3 text-xs font-medium transition hover:border-muted disabled:opacity-60"
    >
      <span aria-hidden="true">↓</span>
      Export file
    </button>
  );
}

/** Rooms are not stored anywhere durable; say so where people will see it. */
export function RoomLifetimeNotice({ ttlMinutes }: { ttlMinutes: number }) {
  return (
    <p data-testid="room-lifetime-notice" className="border-b border-line bg-panel px-4 py-1.5 text-xs text-muted">
      Rooms live in the sync server&apos;s memory only. A room is deleted when the server restarts, and {ttlMinutes} minutes
      after the last person leaves. Use <strong className="font-semibold text-fg">Export file</strong> to keep your code.
    </p>
  );
}
