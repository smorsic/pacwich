import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

/**
 * Bumping this per-build invalidates old sessionStorage entries so a new
 * deploy never reads a stale-shaped history. Falls back to a per-session
 * random version when a host app doesn't inject `process.env.BUILD_ID`
 * (e.g. local dev, or an app that doesn't set one at all).
 */
const HISTORY_VERSION = process.env.BUILD_ID
  ? parseInt(process.env.BUILD_ID, 36) || 1
  : Math.floor(Math.random() * 10000);

export const useCommandHistory = create<{
  history: string[];
  historyIndex: number;
  addCommand: (command: string) => void;
  incrementHistoryIndex: () => void;
  decrementHistoryIndex: () => void;
  resetHistoryIndex: () => void;
}>()(
  persist(
    (set) => ({
      history: [],
      historyIndex: -1,
      addCommand: (command) =>
        set((state) => ({
          history:
            command !== state.history[0]
              ? [command, ...state.history.slice(0, 99)]
              : state.history,
          historyIndex: -1,
        })),
      incrementHistoryIndex: () =>
        set((state) => ({
          historyIndex: Math.min(
            state.historyIndex + 1,
            state.history.length - 1,
          ),
        })),
      decrementHistoryIndex: () =>
        set((state) => ({
          historyIndex: Math.max(state.historyIndex - 1, -1),
        })),
      resetHistoryIndex: () => set({ historyIndex: -1 }),
    }),
    {
      name: "command-history",
      storage: createJSONStorage(() => sessionStorage),
      version: HISTORY_VERSION,
    },
  ),
);

export const useAddCommandToHistory = () =>
  useCommandHistory((state) => state.addCommand);

export const useHistoryCommand = (): string | null =>
  useCommandHistory((state) => state.history[state.historyIndex] ?? null);

export const useIncrementCommandHistoryIndex = () =>
  useCommandHistory((state) => state.incrementHistoryIndex);

export const useDecrementCommandHistoryIndex = () =>
  useCommandHistory((state) => state.decrementHistoryIndex);

export const useResetHistoryIndex = () =>
  useCommandHistory((state) => state.resetHistoryIndex);

export const useHistoryIndex = () =>
  useCommandHistory((state) => state.historyIndex);
