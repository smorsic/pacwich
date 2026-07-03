import { useCallback } from "react";
import { create } from "zustand";
import type { WebCliOutputChunk } from "../../engine";

export const DEFAULT_TERMINAL_WIDTH = 80;

/** stderr is rendered red; the CLI emits plain text on that stream. */
const styleStderr = (text: string) => `\x1b[31m${text}\x1b[0m`;

const useInvokeWebCliStore = create<{
  isLoading: boolean;
  result: WebCliOutputChunk[];
  input: string;
  terminalWidth: number;
  terminalSelection: string;
  setTerminalSelection: (terminalSelection: string) => void;
  setTerminalWidth: (terminalWidth: number) => void;
  setInput: (input: string) => void;
  setIsLoading: (isLoading: boolean) => void;
  setResult: (result: WebCliOutputChunk[]) => void;
  addResultChunk: (chunk: WebCliOutputChunk) => void;
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

  const invokeWebCli = useCallback(
    async (commandLine: string) => {
      if (isLoading) return;

      setIsLoading(true);
      setResult([]);

      // Loaded lazily (client-side, on first run) so the engine's env shims —
      // which self-install a browser `process` on import — never evaluate
      // during Node static-site generation.
      const { runPacwichCli } = await import("../../engine");

      // The engine runs the real pacwich CLI over an in-memory filesystem and
      // streams stdout/stderr back chunk-by-chunk. It tokenizes and guards the
      // command line itself.
      await runPacwichCli(commandLine, {
        terminalWidth,
        onOutput: (text, stream) => {
          addResultChunk({
            terminalOutput: stream === "stderr" ? styleStderr(text) : text,
            warnings: [],
            errors: [],
          });
        },
      });

      setIsLoading(false);
    },
    [addResultChunk, isLoading, setIsLoading, setResult, terminalWidth],
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
