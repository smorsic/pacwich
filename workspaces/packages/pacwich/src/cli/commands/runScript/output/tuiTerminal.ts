import { logger } from "../../../../internal/logger";

const SHOW_CURSOR_SEQUENCE = "\x1b[?25h";
const HIDE_CURSOR_SEQUENCE = "\x1b[?25l";

export type TuiTerminalStdin = {
  setRawMode?: (mode: boolean) => unknown;
  pause: () => unknown;
  unref?: () => unknown;
};

export type TuiTerminalWriter = (chunk: string) => unknown;

export type TuiTerminalDeps = {
  stdout: TuiTerminalWriter;
  stdin: TuiTerminalStdin;
};

/**
 * Resets the controlling tty after the grouped-output TUI has owned it.
 *
 * Each step runs independently: when SIGINT is delivered to the whole
 * process group via the raw-mode ^C handler, `setRawMode(false)` can
 * race with child-process tty teardown and return EIO. A throw must
 * not strand the cursor in a hidden state nor leave the tty in raw
 * mode for any subsequent step.
 *
 * `setRawMode` runs before `unref` so the underlying tty handle is in
 * a known, ref'd state for tcsetattr.
 */
export const resetTuiTerminalState = ({ stdout, stdin }: TuiTerminalDeps) => {
  try {
    stdout(SHOW_CURSOR_SEQUENCE);
  } catch (error) {
    logger.debug("Failed to show cursor during TUI reset", { error });
  }
  try {
    stdin.setRawMode?.(false);
  } catch (error) {
    logger.debug("Failed to reset raw mode during TUI reset", { error });
  }
  try {
    stdin.pause();
    stdin.unref?.();
  } catch (error) {
    logger.debug("Failed to detach stdin during TUI reset", { error });
  }
};

export const initializeTuiTerminalState = ({
  stdout,
  stdin,
}: TuiTerminalDeps) => {
  stdout(HIDE_CURSOR_SEQUENCE);
  stdin.setRawMode?.(true);
};
