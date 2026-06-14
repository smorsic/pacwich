import {
  initializeTuiTerminalState,
  resetTuiTerminalState,
  type TuiTerminalStdin,
} from "../../../../src/cli/commands/runScript/output/tuiTerminal";
import { describe, expect, test } from "../../../util/testFramework";

const SHOW_CURSOR = "\x1b[?25h";
const HIDE_CURSOR = "\x1b[?25l";

type StdinSpyOptions = {
  setRawModeImpl?: (mode: boolean) => unknown;
  pauseImpl?: () => unknown;
  unrefImpl?: () => unknown;
  omitSetRawMode?: boolean;
  omitUnref?: boolean;
};

type StdinSpy = TuiTerminalStdin & {
  calls: { setRawMode: boolean[]; pause: number; unref: number };
};

const createStdinSpy = ({
  setRawModeImpl,
  pauseImpl,
  unrefImpl,
  omitSetRawMode,
  omitUnref,
}: StdinSpyOptions = {}): StdinSpy => {
  const calls = { setRawMode: [] as boolean[], pause: 0, unref: 0 };
  const stdin: StdinSpy = {
    calls,
    pause: () => {
      calls.pause++;
      return pauseImpl?.();
    },
  };
  if (!omitSetRawMode) {
    stdin.setRawMode = (mode: boolean) => {
      calls.setRawMode.push(mode);
      return setRawModeImpl?.(mode);
    };
  }
  if (!omitUnref) {
    stdin.unref = () => {
      calls.unref++;
      return unrefImpl?.();
    };
  }
  return stdin;
};

describe("tuiTerminal", () => {
  describe("initializeTuiTerminalState", () => {
    test("emits hide-cursor sequence and enables raw mode", () => {
      const writes: string[] = [];
      const stdin = createStdinSpy();
      initializeTuiTerminalState({
        stdout: (chunk) => writes.push(chunk),
        stdin,
      });
      expect(writes).toEqual([HIDE_CURSOR]);
      expect(stdin.calls.setRawMode).toEqual([true]);
    });

    test("tolerates missing setRawMode (non-tty stdin)", () => {
      const writes: string[] = [];
      const stdin = createStdinSpy({ omitSetRawMode: true });
      expect(() =>
        initializeTuiTerminalState({
          stdout: (chunk) => writes.push(chunk),
          stdin,
        }),
      ).not.toThrow();
      expect(writes).toEqual([HIDE_CURSOR]);
    });
  });

  describe("resetTuiTerminalState", () => {
    test("emits show-cursor, disables raw mode, and detaches stdin", () => {
      const writes: string[] = [];
      const stdin = createStdinSpy();
      resetTuiTerminalState({
        stdout: (chunk) => writes.push(chunk),
        stdin,
      });
      expect(writes).toEqual([SHOW_CURSOR]);
      expect(stdin.calls.setRawMode).toEqual([false]);
      expect(stdin.calls.pause).toBe(1);
      expect(stdin.calls.unref).toBe(1);
    });

    /**
     * Regression: v1.5.0 introduced a raw-mode ^C handler that fires
     * `process.kill(0, "SIGINT")` to fan SIGINT across the process group.
     * On the resulting cleanup, `process.stdin.setRawMode(false)` can race
     * with child tty teardown and throw EIO. The previous ordering
     * (unref before setRawMode, no try/catch) left the cursor hidden and
     * the tty in raw mode whenever the throw fired.
     */
    test("still shows cursor and detaches stdin when setRawMode throws", () => {
      const writes: string[] = [];
      const stdin = createStdinSpy({
        setRawModeImpl: () => {
          const error = new Error(
            "setRawMode failed with errno: 5",
          ) as Error & { errno?: number };
          error.errno = 5;
          throw error;
        },
      });
      expect(() =>
        resetTuiTerminalState({
          stdout: (chunk) => writes.push(chunk),
          stdin,
        }),
      ).not.toThrow();
      expect(writes).toEqual([SHOW_CURSOR]);
      expect(stdin.calls.setRawMode).toEqual([false]);
      expect(stdin.calls.pause).toBe(1);
      expect(stdin.calls.unref).toBe(1);
    });

    test("still disables raw mode and detaches stdin when stdout throws", () => {
      const stdin = createStdinSpy();
      expect(() =>
        resetTuiTerminalState({
          stdout: () => {
            throw new Error("stdout closed");
          },
          stdin,
        }),
      ).not.toThrow();
      expect(stdin.calls.setRawMode).toEqual([false]);
      expect(stdin.calls.pause).toBe(1);
      expect(stdin.calls.unref).toBe(1);
    });

    test("still emits show-cursor and resets raw mode when pause throws", () => {
      const writes: string[] = [];
      const stdin = createStdinSpy({
        pauseImpl: () => {
          throw new Error("pause failed");
        },
      });
      expect(() =>
        resetTuiTerminalState({
          stdout: (chunk) => writes.push(chunk),
          stdin,
        }),
      ).not.toThrow();
      expect(writes).toEqual([SHOW_CURSOR]);
      expect(stdin.calls.setRawMode).toEqual([false]);
    });

    test("disables raw mode before detaching stdin", () => {
      const sequence: string[] = [];
      const stdin = createStdinSpy({
        setRawModeImpl: () => {
          sequence.push("setRawMode");
        },
        pauseImpl: () => {
          sequence.push("pause");
        },
        unrefImpl: () => {
          sequence.push("unref");
        },
      });
      resetTuiTerminalState({ stdout: () => {}, stdin });
      expect(sequence).toEqual(["setRawMode", "pause", "unref"]);
    });

    test("tolerates missing setRawMode and unref (non-tty stdin)", () => {
      const writes: string[] = [];
      const stdin = createStdinSpy({
        omitSetRawMode: true,
        omitUnref: true,
      });
      expect(() =>
        resetTuiTerminalState({
          stdout: (chunk) => writes.push(chunk),
          stdin,
        }),
      ).not.toThrow();
      expect(writes).toEqual([SHOW_CURSOR]);
      expect(stdin.calls.pause).toBe(1);
    });
  });
});
