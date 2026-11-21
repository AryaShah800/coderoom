"use client";

import { useMemo } from "react";
import { initials, remoteCursorCss } from "@/lib/participants";
import { useRoomStore } from "@/store/room";

const MAX_VISIBLE = 5;

export function ParticipantList() {
  const participants = useRoomStore((s) => s.participants);
  const typingIds = useRoomStore((s) => s.presence.typing);
  const followId = useRoomStore((s) => s.followId);
  const follow = useRoomStore((s) => s.follow);
  const visible = participants.slice(0, MAX_VISIBLE);
  const hidden = participants.length - visible.length;
  const count = participants.length;
  const typers = participants.filter((p) => !p.isSelf && typingIds.includes(p.clientId));

  return (
    <div className="flex items-center gap-2">
      <ul aria-label={`People in this room: ${count}`} className="flex -space-x-2">
        {visible.map((p) => {
          const isTyping = typingIds.includes(p.clientId) && !p.isSelf;
          const isFollowed = followId === p.clientId;
          const ring = `grid size-8 place-items-center rounded-full border-2 text-xs font-bold text-ink ${isFollowed ? "border-fg" : "border-ink"} ${isTyping ? "animate-pulse" : ""}`;
          return (
            <li key={p.clientId} title={p.isSelf ? `${p.name} (you)` : `${isFollowed ? "Stop following" : "Follow"} ${p.name}`} data-typing={isTyping || undefined}>
              {p.isSelf ? (
                <span className={ring} style={{ backgroundColor: p.color }}>
                  <span aria-hidden="true">{initials(p.name)}</span>
                  <span className="sr-only">{`${p.name} (you)`}</span>
                </span>
              ) : (
                <button
                  type="button"
                  aria-pressed={isFollowed}
                  onClick={() => follow(isFollowed ? null : p.clientId)}
                  className={`${ring} cursor-pointer transition hover:brightness-110`}
                  style={{ backgroundColor: p.color }}
                >
                  <span aria-hidden="true">{initials(p.name)}</span>
                  <span className="sr-only">{`Follow ${p.name}`}</span>
                </button>
              )}
            </li>
          );
        })}
        {hidden > 0 && (
          <li className="grid size-8 place-items-center rounded-full border-2 border-ink bg-line-strong text-xs font-semibold">
            +{hidden}
          </li>
        )}
      </ul>
      <span className="hidden text-xs text-muted md:inline" aria-hidden="true">
        {count === 1 ? "Just you" : `${count} people`}
      </span>
      {typers.length > 0 && (
        <span data-testid="typing-indicator" className="hidden text-xs text-muted md:inline">
          {typers.length === 1 ? `${typers[0]!.name} is typing…` : `${typers.length} people are typing…`}
        </span>
      )}
    </div>
  );
}

/** Colours y-monaco's remote cursor and selection decorations, with a name label per person. */
export function RemoteCursorStyles() {
  const participants = useRoomStore((s) => s.participants);
  const active = useRoomStore((s) => s.presence.active);
  const followId = useRoomStore((s) => s.followId);
  const css = useMemo(() => remoteCursorCss(participants, new Set(active), followId), [participants, active, followId]);
  return <style data-testid="remote-cursor-styles">{css}</style>;
}

/** Shown while following someone; sits under the header. */
export function FollowBanner() {
  const participants = useRoomStore((s) => s.participants);
  const followId = useRoomStore((s) => s.followId);
  const follow = useRoomStore((s) => s.follow);
  const who = participants.find((p) => p.clientId === followId);
  if (!who) return null;
  return (
    <div role="status" className="flex items-center gap-3 border-b border-line bg-panel-2 px-4 py-1.5 text-xs">
      <span className="size-2 rounded-full" style={{ backgroundColor: who.color }} aria-hidden="true" />
      <span data-testid="follow-banner">Following {who.name}: your view scrolls to their cursor.</span>
      <button type="button" onClick={() => follow(null)} className="rounded font-semibold text-accent hover:underline">
        Stop following
      </button>
    </div>
  );
}
