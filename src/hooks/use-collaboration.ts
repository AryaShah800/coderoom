"use client";

import { useEffect } from "react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { getShared, initializeRoom, readLanguage, readLastRun } from "@/lib/collab";
import { participantsFromAwareness, type ParticipantIdentity } from "@/lib/participants";
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
    const onAwareness = () =>
      store.setParticipants(
        participantsFromAwareness(provider.awareness.getStates() as Map<number, Record<string, unknown>>, doc.clientID),
      );

    store.setStatus("connecting");
    provider.on("status", onStatus);
    provider.on("sync", onSync);
    meta.observe(onMeta);
    provider.awareness.on("change", onAwareness);
    store.setCollab({ doc, provider });

    return () => {
      provider.off("status", onStatus);
      provider.off("sync", onSync);
      meta.unobserve(onMeta);
      provider.awareness.off("change", onAwareness);
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
