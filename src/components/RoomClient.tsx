"use client";

import { useEffect } from "react";
import { useSessionStore } from "@/store/session";
import { useRoomStore } from "@/store/room";
import { randomColor, type ParticipantIdentity } from "@/lib/participants";
import { JoinForm } from "./JoinForm";
import { Workspace } from "./Workspace";

export function RoomClient({ roomId }: { roomId: string }) {
  const hydrated = useSessionStore((s) => s.hydrated);
  const name = useSessionStore((s) => s.name);
  const color = useSessionStore((s) => s.color);
  const joined = useRoomStore((s) => s.joined && s.roomId === roomId);

  useEffect(() => {
    useRoomStore.getState().enterRoom(roomId);
  }, [roomId]);

  useEffect(() => {
    if (useSessionStore.getState().hydrated) return;
    void Promise.resolve(useSessionStore.persist.rehydrate()).then(() => {
      // First visit: suggest a random colour so two newcomers rarely share one.
      if (!useSessionStore.getState().color) useSessionStore.setState({ color: randomColor() });
    });
  }, []);

  const handleJoin = (identity: ParticipantIdentity) => {
    useSessionStore.getState().setIdentity(identity);
    useRoomStore.getState().enterRoom(roomId);
    useRoomStore.getState().join();
  };

  if (joined && name) {
    return <Workspace roomId={roomId} identity={{ name, color }} />;
  }

  return (
    <main id="main" className="grid flex-1 place-items-center px-4 py-16">
      {hydrated ? (
        <JoinForm key={`${name}|${color}`} roomId={roomId} initialName={name} initialColor={color} onJoin={handleJoin} />
      ) : (
        <JoinSkeleton />
      )}
    </main>
  );
}

export function JoinSkeleton() {
  return (
    <div role="status" className="w-full max-w-md rounded-2xl border border-line bg-panel p-8" aria-label="Loading room">
      <div className="h-3 w-32 animate-pulse rounded bg-line" />
      <div className="mt-4 h-6 w-48 animate-pulse rounded bg-line" />
      <div className="mt-8 h-11 animate-pulse rounded bg-line/70" />
      <div className="mt-6 h-8 animate-pulse rounded bg-line/50" />
      <div className="mt-8 h-11 animate-pulse rounded bg-line" />
      <span className="sr-only">Loading room…</span>
    </div>
  );
}
