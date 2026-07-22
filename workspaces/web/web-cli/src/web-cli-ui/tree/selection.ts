import { create } from "zustand";

const useSelection = create<{
  selectedFile: string;
  setSelectedFile: (selectedFile: string) => void;
}>()((set) => ({
  selectedFile: "package.json",
  setSelectedFile: (selectedFile) => set({ selectedFile }),
}));

export const useSelectedFile = () => {
  return useSelection((state) => state.selectedFile);
};

export const useSetSelectedFile = () => {
  return useSelection((state) => state.setSelectedFile);
};
