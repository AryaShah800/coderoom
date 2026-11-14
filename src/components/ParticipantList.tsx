"use client";

import { initials, remoteCursorCss } from "@/lib/participants";
import { useRoomStore } from "@/store/room";

const MAX_VISIBLE = 5;

export function ParticipantList() {
  const participants = useRoomStore((s) => s.participants);
  const visible = participants.slice(0, MAX_VISIBLE);
  const hidden = participants.length - visible.length;
  const count = participants.length;

  return (
    <div className="flex items-center gap-2">
      <ul aria-label={`People in this room: ${count}`} className="flex -space-x-2">
        {visible.map((p) => (
          <li
            key={p.clientId}
            title={p.isSelf ? `${p.name} (you)` : p.name}
            className="grid size-8 place-items-center rounded-full border-2 border-ink text-xs font-bold text-ink"
            style={{ backgroundColor: p.color }}
          >
            <span aria-hidden="true">{initials(p.name)}</span>
            <span className="sr-only">{p.isSelf ? `${p.name} (you)` : p.name}</span>
          </li>
        ))}
        {hidden > 0 && (
          <li className="grid size-8 place-items-center rounded-full border-2 border-ink bg-line-strong text-xs font-semibold">
            +{hidden}
          </li>
        )}
      </ul>
      <span className="hidden text-xs text-muted md:inline" aria-hidden="true">
        {count === 1 ? "Just you" : `${count} people`}
      </span>
    </div>
  );
}

/** Colours y-monaco's remote cursor and selection decorations, with a name label per person. */
export function RemoteCursorStyles() {
  const participants = useRoomStore((s) => s.participants);
  return <style data-testid="remote-cursor-styles">{remoteCursorCss(participants)}</style>;
}
