import { create } from "zustand";
import type * as Y from "yjs";
import type { WebsocketProvider } from "y-websocket";
import { DEFAULT_LANGUAGE, type LanguageKey } from "@/lib/languages";
import type { Participant } from "@/lib/participants";
import type { SharedRun } from "@/lib/collab";
import type { PresenceSnapshot } from "@/lib/presence";

export type ConnectionStatus = "connecting" | "connected" | "disconnected";

export interface Collab {
  doc: Y.Doc;
  provider: WebsocketProvider;
}

interface RoomState {
  roomId: string | null;
  joined: boolean;
  status: ConnectionStatus;
  /** True once the first full sync with the server finished for this room. */
  synced: boolean;
  /** True once any connection succeeded, so a later drop reads "reconnecting" rather than "connecting". */
  everConnected: boolean;
  participants: Participant[];
  language: LanguageKey;
  lastRun: SharedRun | null;
  isRunning: boolean;
  /** Who moved or typed recently (label visibility, typing indicator). */
  presence: PresenceSnapshot;
  /** Client id of the collaborator whose caret this person follows. */
  followId: number | null;
  /** What a run is waiting on, e.g. the Python runtime download. */
  runPhase: string | null;
  collab: Collab | null;

  enterRoom: (roomId: string) => void;
  join: () => void;
  leave: () => void;
  setStatus: (status: ConnectionStatus) => void;
  setSynced: (synced: boolean) => void;
  setParticipants: (participants: Participant[]) => void;
  setLanguage: (language: LanguageKey) => void;
  setLastRun: (run: SharedRun | null) => void;
  setRunning: (running: boolean) => void;
  setPresence: (presence: PresenceSnapshot) => void;
  follow: (clientId: number | null) => void;
  setRunPhase: (phase: string | null) => void;
  setCollab: (collab: Collab | null) => void;
}

const initialRoom = {
  joined: false,
  status: "connecting" as ConnectionStatus,
  synced: false,
  everConnected: false,
  participants: [] as Participant[],
  language: DEFAULT_LANGUAGE,
  lastRun: null,
  isRunning: false,
  presence: { active: [], typing: [] } as PresenceSnapshot,
  followId: null as number | null,
  runPhase: null as string | null,
  collab: null,
};

/** UI state for the room on screen. The Y.Doc itself is the source of truth for shared data. */
export const useRoomStore = create<RoomState>()((set, get) => ({
  roomId: null,
  ...initialRoom,
  enterRoom: (roomId) => {
    if (get().roomId !== roomId) set({ roomId, ...initialRoom });
  },
  join: () => set({ joined: true }),
  leave: () => set({ ...initialRoom }),
  setStatus: (status) => set((s) => ({ status, everConnected: s.everConnected || status === "connected" })),
  setSynced: (synced) => set({ synced }),
  setParticipants: (participants) => set({ participants }),
  setLanguage: (language) => set({ language }),
  setLastRun: (lastRun) => set({ lastRun }),
  setRunning: (isRunning) => set({ isRunning, ...(isRunning ? {} : { runPhase: null }) }),
  setRunPhase: (runPhase) => set({ runPhase }),
  setPresence: (presence) => set({ presence }),
  follow: (followId) => set({ followId }),
  setCollab: (collab) => set({ collab }),
}));
