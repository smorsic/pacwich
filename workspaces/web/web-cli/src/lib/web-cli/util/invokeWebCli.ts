import { useCallback } from "react";
import { create } from "zustand";
import { useApiState } from "./apiHealth";
import { localWebCliClient } from "./localWebCliClient";
import type {
  InvokeCliRequestBody,
  InvokeCliResponseChunk,
} from "./webCliClientTypes";

export const DEFAULT_TERMINAL_WIDTH = 80;

const useInvokeWebCliStore = create<{
  isLoading: boolean;
  result: InvokeCliResponseChunk[];
  input: string;
  terminalWidth: number;
  terminalSelection: string;
  setTerminalSelection: (terminalSelection: string) => void;
  setTerminalWidth: (terminalWidth: number) => void;
  setInput: (input: string) => void;
  setIsLoading: (isLoading: boolean) => void;
  setResult: (result: InvokeCliResponseChunk[]) => void;
  addResultChunk: (chunk: InvokeCliResponseChunk) => void;
}>((set) => ({
  isLoading: false,
  result: [],
  input: "",
  terminalWidth: DEFAULT_TERMINAL_WIDTH,
  terminalSelection: "",
  setTerminalSelection: (terminalSelection) => set({ terminalSelection }),
  setTerminalWidth: (terminalWidth) => set({ terminalWidth }),
  setInput: (input) => set({ input }),
  setIsLoading: (isLoading) => set({ isLoading }),
  setResult: (result) => set({ result }),
  addResultChunk: (chunk) =>
    set((state) => ({ result: [...state.result, chunk] })),
}));

export const useInvokeWebCli = () => {
  const isLoading = useInvokeWebCliStore((state) => state.isLoading);
  const result = useInvokeWebCliStore((state) => state.result);
  const setIsLoading = useInvokeWebCliStore((state) => state.setIsLoading);
  const setResult = useInvokeWebCliStore((state) => state.setResult);
  const addResultChunk = useInvokeWebCliStore((state) => state.addResultChunk);
  const terminalWidth = useInvokeWebCliStore((state) => state.terminalWidth);
  const { isReady } = useApiState();

  const invokeWebCli = useCallback(
    async (request: Omit<InvokeCliRequestBody, "terminalWidth">) => {
      if (isLoading || !isReady) return;

      setIsLoading(true);
      setResult([]);

      for await (const chunk of localWebCliClient.invokeWebCli({
        ...request,
        terminalWidth,
      })) {
        addResultChunk(chunk);
      }

      setIsLoading(false);
    },
    [
      addResultChunk,
      isReady,
      isLoading,
      setIsLoading,
      setResult,
      terminalWidth,
    ],
  );

  return { invokeWebCli, isLoading, result };
};

export const useWebCliLoading = () =>
  useInvokeWebCliStore((state) => state.isLoading);

export const useWebCliResult = () =>
  useInvokeWebCliStore((state) => state.result);

export const useWebCliInput = () =>
  useInvokeWebCliStore((state) => state.input);

export const useSetWebCliInput = () =>
  useInvokeWebCliStore((state) => state.setInput);

export const useWebCliTerminalWidth = () =>
  useInvokeWebCliStore((state) => state.terminalWidth);

export const useSetWebCliTerminalWidth = () =>
  useInvokeWebCliStore((state) => state.setTerminalWidth);

export const useWebCliTerminalSelection = () =>
  useInvokeWebCliStore((state) => state.terminalSelection);

export const useSetWebCliTerminalSelection = () =>
  useInvokeWebCliStore((state) => state.setTerminalSelection);
