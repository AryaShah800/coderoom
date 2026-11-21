"use client";

import { useEffect } from "react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { getShared, initializeRoom, readLanguage, readLastRun } from "@/lib/collab";
import { participantsFromAwareness, type ParticipantIdentity } from "@/lib/participants";
import { PresenceTracker, TypingPublisher } from "@/lib/presence";
import { SYNC_URL } from "@/lib/config";
import { useRoomStore, type ConnectionStatus } from "@/store/room";

/**
 * Connects the current room to the y-websocket sync server while `enabled` is true.
 * Creates one Y.Doc + WebsocketProvider per room and mirrors connection state, participants
 * (awareness), the shared language and the last run into the room store.
 */
export function useCollaboration(roomId: string, identity: ParticipantIdentity, enabled: boolean, serverUrl = SYNC_URL) {
  const collab = useRoomStore((s) => s.collab);

  useEffect(() => {
    if (!enabled) return;
    const store = useRoomStore.getState();
    const doc = new Y.Doc();
    const provider = new WebsocketProvider(serverUrl, roomId, doc, { maxBackoffTime: 8_000 });
    const { meta } = getShared(doc);

    const onStatus = ({ status }: { status: ConnectionStatus }) => store.setStatus(status);
    const onSync = (isSynced: boolean) => {
      store.setSynced(isSynced);
      if (isSynced) initializeRoom(doc);
    };
    const onMeta = () => {
      store.setLanguage(readLanguage(doc));
      store.setLastRun(readLastRun(doc));
    };
    const tracker = new PresenceTracker((snapshot) => store.setPresence(snapshot));
    const typing = new TypingPublisher((on) => provider.awareness.setLocalStateField("typing", on));
    const states = () => provider.awareness.getStates() as Map<number, Record<string, unknown>>;
    const onAwareness = () => {
      const participants = participantsFromAwareness(states(), doc.clientID);
      store.setParticipants(participants);
      const followId = useRoomStore.getState().followId;
      if (followId !== null && !participants.some((p) => p.clientId === followId)) store.follow(null);
    };
    // "update" also fires for unchanged heartbeats; "change" is only for real differences.
    const onUpdate = ({ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] }) => {
      for (const id of [...added, ...updated]) if (id !== doc.clientID) tracker.ingest(id, states().get(id));
      for (const id of removed) tracker.remove(id);
    };
    // Edits typed here (y-monaco applies them with an origin; room seeding has none) mean "typing".
    const onText = (_: unknown, tr: Y.Transaction) => {
      if (tr.local && tr.origin !== null) typing.edited();
    };
    const { text } = getShared(doc);

    store.setStatus("connecting");
    provider.on("status", onStatus);
    provider.on("sync", onSync);
    meta.observe(onMeta);
    provider.awareness.on("change", onAwareness);
    provider.awareness.on("update", onUpdate);
    text.observe(onText);
    store.setCollab({ doc, provider });

    return () => {
      provider.off("status", onStatus);
      provider.off("sync", onSync);
      meta.unobserve(onMeta);
      provider.awareness.off("change", onAwareness);
      provider.awareness.off("update", onUpdate);
      text.unobserve(onText);
      typing.stop();
      tracker.dispose();
      useRoomStore.getState().follow(null);
      useRoomStore.getState().setPresence({ active: [], typing: [] });
      provider.destroy();
      doc.destroy();
      useRoomStore.getState().setCollab(null);
    };
  }, [roomId, enabled, serverUrl]);

  const { name, color } = identity;
  useEffect(() => {
    collab?.provider.awareness.setLocalStateField("user", { name, color });
  }, [collab, name, color]);

  return collab;
}
