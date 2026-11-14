import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { sanitizeColor, sanitizeName } from "@/lib/participants";

interface SessionState {
  name: string;
  color: string;
  hydrated: boolean;
  setIdentity: (identity: { name: string; color: string }) => void;
}

/**
 * The visitor's display name and colour, remembered in localStorage between visits.
 * Hydration is manual (`skipHydration`) so the server render and the first client render match;
 * call `useSessionStore.persist.rehydrate()` from an effect.
 */
export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      name: "",
      color: "",
      hydrated: false,
      setIdentity: ({ name, color }) => set({ name: sanitizeName(name), color: sanitizeColor(color) }),
    }),
    {
      name: "coderoom:identity",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: ({ name, color }) => ({ name, color }),
      onRehydrateStorage: () => () => {
        useSessionStore.setState({ hydrated: true });
      },
    },
  ),
);
