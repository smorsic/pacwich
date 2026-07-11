import { create } from "zustand";

const useViewStore = create<{
  view: "terminal" | "tree";
  setView: (view: "terminal" | "tree") => void;
}>()((set) => ({
  view: "terminal",
  setView: (view) => set({ view }),
}));

export const useView = () => {
  return useViewStore((state) => state.view);
};

export const useSetView = () => {
  return useViewStore((state) => state.setView);
};
