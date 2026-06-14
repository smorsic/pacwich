import { runOnExit, stripANSI } from "../../../../internal/core";
import {
  createTypedEventFactory,
  type TypedEvent,
  TypedEventTarget,
} from "../../../../internal/core/language/events/typedEventTarget";
import {
  calculateVisibleLength,
  truncateTerminalString,
} from "../../../../internal/core/language/string/utf/visibleLength";
import { logger } from "../../../../internal/logger";
import type {
  RunScriptAcrossWorkspacesOutput,
  RunWorkspaceScriptMetadata,
} from "../../../../project";
import type {
  OutputStreamName,
  RunScriptExit,
  RunScriptsSummary,
  ScriptEventName,
} from "../../../../runScript";
import type { Workspace } from "../../../../workspaces";
import type { WriteOutputOptions } from "../../../createCli";
import { generateGroupedOutputLines } from "./renderPlainOutput";
import {
  initializeTuiTerminalState,
  resetTuiTerminalState,
} from "./tuiTerminal";

type ScriptEvent = TypedEvent<
  ScriptEventName,
  {
    workspace: Workspace;
    exitResult: RunScriptExit<RunWorkspaceScriptMetadata> | null;
  }
>;

class ScriptEventTarget extends TypedEventTarget<{
  [key in ScriptEvent["type"]]: ScriptEvent;
}> {}

export const createScriptEventTarget = () => new ScriptEventTarget();

export const createScriptEvent = {
  start: createTypedEventFactory<ScriptEvent>("start"),
  skip: createTypedEventFactory<ScriptEvent>("skip"),
  exit: createTypedEventFactory<ScriptEvent>("exit"),
};

const cursorOps = {
  up: (n: number) => `\x1b[${n}A`,
  down: (n: number) => `\x1b[${n}B`,
  toColumn: (n: number) => `\x1b[${n}G`,
  hide: () => `\x1b[?25l`,
  show: () => `\x1b[?25h`,
};

const lineOps = {
  clearToEnd: () => `\x1b[0K`,
  clearToStart: () => `\x1b[1K`,
  clearFull: () => `\x1b[2K`,
  clearBelow: () => `\x1b[0J`,
};

const textOps = {
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
  /**
   * Toggle bold without resetting foreground color, so wrapping a
   * segment inside another color (e.g. `gray(... + boldInline(x) + ...)`)
   * keeps the surrounding color across the bold segment.
   */
  boldInline: (s: string) => `\x1b[1m${s}\x1b[22m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  blue: (s: string) => `\x1b[34m${s}\x1b[0m`,
  magenta: (s: string) => `\x1b[35m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
  white: (s: string) => `\x1b[37m${s}\x1b[0m`,
  gray: (s: string) => `\x1b[90m${s}\x1b[0m`,
  intenseBlack: (s: string) => `\x1b[0;90m${s}\x1b[0m`,
  intenseRed: (s: string) => `\x1b[0;91m${s}\x1b[0m`,
  intenseGreen: (s: string) => `\x1b[0;92m${s}\x1b[0m`,
  intenseYellow: (s: string) => `\x1b[0;93m${s}\x1b[0m`,
  intenseBlue: (s: string) => `\x1b[0;94m${s}\x1b[0m`,
  intenseMagenta: (s: string) => `\x1b[0;95m${s}\x1b[0m`,
  intenseCyan: (s: string) => `\x1b[0;96m${s}\x1b[0m`,
  intenseWhite: (s: string) => `\x1b[0;97m${s}\x1b[0m`,
};

type Line = {
  text: string;
  type: "border" | "borderedContent" | "scriptOutput";
};

type WorkspaceStatus =
  | "pending"
  | "running"
  | "skipped"
  | "success"
  | "failure"
  | "interrupted"
  | "cancelled"
  | "killed";

const FINISHED_STATUSES: ReadonlySet<WorkspaceStatus> = new Set([
  "skipped",
  "success",
  "failure",
  "interrupted",
  "cancelled",
  "killed",
]);

const isFinished = (status: WorkspaceStatus): boolean =>
  FINISHED_STATUSES.has(status);

/** Number of streams (stdout + stderr) drained before a workspace is done. */
const STREAMS_PER_WORKSPACE = 2;

type WorkspaceState = {
  lines: Line[];
  status: WorkspaceStatus;
  exitCode: number | null;
  signal: string | null;
  /** Stream names (stdout/stderr) whose output has been fully drained. */
  endedStreams: Set<OutputStreamName>;
  /** True once every stream has drained: no more output will ever arrive. */
  drained: boolean;
  /**
   * True once this workspace's full output has been flushed to permanent
   * scrollback and it has left the live frame.
   */
  dumped: boolean;
};

const STATUS_COLORS: Record<WorkspaceState["status"], keyof typeof textOps> = {
  pending: "gray",
  running: "intenseMagenta",
  skipped: "gray",
  success: "intenseGreen",
  failure: "intenseRed",
  interrupted: "intenseYellow",
  cancelled: "gray",
  killed: "intenseRed",
};

const BORDER_COLOR = "intenseCyan" satisfies keyof typeof textOps;

const HEADER_ROWS_PER_WORKSPACE = 2;

export const renderGroupedOutput = async (
  workspaces: Workspace[],
  output: RunScriptAcrossWorkspacesOutput,
  summary: Promise<RunScriptsSummary<RunWorkspaceScriptMetadata>>,
  scriptEventTarget: ScriptEventTarget,
  activeScriptLines: number | "all" | "auto",
  outputWriters: Required<WriteOutputOptions>,
  terminalWidth: number,
  terminalHeight: number,
) => {
  const workspaceState: Record<string, WorkspaceState> = workspaces.reduce(
    (acc, workspace) => {
      acc[workspace.name] = {
        lines: [],
        status: "pending",
        exitCode: null,
        signal: null,
        endedStreams: new Set(),
        drained: false,
        dumped: false,
      };
      return acc;
    },
    {} as Record<string, WorkspaceState>,
  );

  let isInitialized = false;
  const initializeTuiTerminal = () => {
    if (isInitialized) {
      return;
    }
    isInitialized = true;
    logger.debug("Initializing TUI state");
    initializeTuiTerminalState({
      stdout: outputWriters.stdout,
      stdin: process.stdin,
    });
  };

  let isReset = false;
  const resetTuiTerminal = () => {
    if (isReset) {
      return;
    }
    isReset = true;
    logger.debug("Resetting TUI state");
    resetTuiTerminalState({
      stdout: outputWriters.stdout,
      stdin: process.stdin,
    });
  };

  const padding = 4; // left border, spaces, right border

  // Build a workspace's two boxed header rows (name + colored status), each
  // truncated to fit the terminal width.
  const buildHeaderLines = (workspace: Workspace, width: number): Line[] => {
    const state = workspaceState[workspace.name];
    let statusText: string = state.status;

    const hasExitCode = state.exitCode && state.exitCode !== -1;

    const exitState =
      hasExitCode && state.signal
        ? "exitAndSignal"
        : hasExitCode
          ? "exit"
          : state.signal
            ? "signal"
            : null;

    if (exitState === "exitAndSignal") {
      statusText += ` (exit code: ${state.exitCode}, signal: ${state.signal})`;
    } else if (exitState === "exit") {
      statusText += ` (exit code: ${state.exitCode})`;
    } else if (exitState === "signal") {
      statusText += ` (signal: ${state.signal})`;
    }

    const workspaceNameContent =
      textOps[BORDER_COLOR]("Workspace: ") +
      textOps.bold(stripANSI(workspace.name));
    const statusTextContent =
      textOps[BORDER_COLOR]("   Status: ") +
      textOps[STATUS_COLORS[state.status]](statusText);

    const borderText = (text: string, top: boolean, headerWidth: number) => {
      const visibleLength = calculateVisibleLength(text);
      const truncated =
        visibleLength > width - padding
          ? truncateTerminalString(text, width - padding - 1) + "\x1b[0m…"
          : text;
      return (
        textOps[BORDER_COLOR](top ? "┌ " : "└ ") +
        truncated +
        " ".repeat(Math.max(0, headerWidth - visibleLength - padding)) +
        textOps[BORDER_COLOR](top ? " ┐" : " ┘")
      );
    };

    const headerWidth = Math.min(
      width,
      Math.max(
        stripANSI(workspaceNameContent).length,
        stripANSI(statusTextContent).length,
      ) + padding,
    );

    return [
      {
        text: borderText(workspaceNameContent, true, headerWidth),
        type: "borderedContent",
      },
      {
        text: borderText(statusTextContent, false, headerWidth),
        type: "borderedContent",
      },
    ];
  };

  // Write one frame line. `full` (used for permanent dumps and the final
  // render) leaves script output untruncated so the terminal wraps it; live
  // frame lines are truncated to the width so the box never wraps.
  const writeLine = (line: Line, width: number, full: boolean) => {
    if (full && line.type === "scriptOutput") {
      outputWriters.stdout(line.text.replace(/\n?$/, "\n"));
      return;
    }
    const visibleLength = calculateVisibleLength(line.text);
    const truncated =
      visibleLength > width
        ? truncateTerminalString(line.text, width - 2) + "\x1b[0m…"
        : line.text;
    outputWriters.stdout(truncated.replace(/\n?$/, "\n"));
  };

  let previousHeight = 0;
  let didFinalRender = false;
  const render = (isFinal = false) => {
    if (didFinalRender) {
      return;
    }

    if (isFinal) {
      didFinalRender = true;
    }

    // Read the terminal size LIVE on every frame, preferring the real
    // `process.stdout` over the dimensions captured at CLI startup. The
    // captured values go stale if the terminal is resized mid-run (the
    // SIGWINCH handler re-renders but would otherwise reuse them) or if they
    // were read before a multiplexer (tmux/zellij) settled the pane winsize.
    // A height larger than the real viewport is catastrophic here: the frame
    // is drawn taller than the screen, cursor-up clamps at the top instead of
    // reaching the frame's top row, and each redraw leaks duplicated rows into
    // scrollback. The captured params remain as a fallback for non-TTY output.
    const width = Math.max(2, process.stdout.columns || terminalWidth || 2);
    const height = Math.max(1, process.stdout.rows || terminalHeight || 1);

    // Clear the previous live frame in place. Erasing from the top of the old
    // frame to the end of the screen (rather than line-by-line) also reclaims
    // rows when the frame shrinks — which it does every time a workspace is
    // dumped out of the live view below.
    if (previousHeight > 0) {
      outputWriters.stdout(cursorOps.up(previousHeight));
      outputWriters.stdout(cursorOps.toColumn(1));
      outputWriters.stdout(lineOps.clearBelow());
    }

    // Dump finished workspaces to permanent scrollback so they leave the live
    // view and free rows for the ones still running. A workspace is only
    // dumped once it has BOTH exited and had its output fully drained, so its
    // dump can never miss output that is still in flight. The final render
    // flushes whatever is still live regardless.
    const dumpLines: Line[] = [];
    workspaces.forEach((workspace) => {
      const state = workspaceState[workspace.name];
      if (state.dumped) {
        return;
      }
      if (!isFinal && !(state.drained && isFinished(state.status))) {
        return;
      }
      state.dumped = true;
      dumpLines.push(...buildHeaderLines(workspace, width));
      dumpLines.push(
        ...state.lines.map(
          (line) => ({ text: line.text, type: "scriptOutput" }) as const,
        ),
      );
    });
    for (const line of dumpLines) {
      writeLine(line, width, true);
    }

    // Build the live frame for the workspaces that haven't been dumped yet.
    const activeWorkspaces = workspaces.filter(
      (workspace) => !workspaceState[workspace.name].dumped,
    );

    const liveLines: Line[] = [];
    if (activeWorkspaces.length > 0) {
      // "auto" fits the per-workspace preview to the available height so the
      // frame stays within the viewport without relying on the tail-clamp.
      // Each workspace costs HEADER_ROWS_PER_WORKSPACE rows plus one for the
      // hidden-lines indicator, with one safety row to prevent scroll on the
      // final newline. An explicit count (or "all") is honored even when it
      // exceeds that fit: the tail-clamp below bounds the whole frame to the
      // viewport, so over-asking is safe and just keeps the most recent lines.
      const availableRows = Math.max(
        1,
        height - 1 - activeWorkspaces.length * (HEADER_ROWS_PER_WORKSPACE + 1),
      );
      const computedScriptLines = Math.max(
        1,
        Math.floor(availableRows / activeWorkspaces.length),
      );
      const effectiveScriptLines =
        activeScriptLines === "auto"
          ? computedScriptLines
          : activeScriptLines === "all"
            ? Infinity
            : activeScriptLines;

      activeWorkspaces.forEach((workspace) => {
        const state = workspaceState[workspace.name];

        liveLines.push(...buildHeaderLines(workspace, width));

        if (state.lines.length > effectiveScriptLines) {
          const hiddenLines = state.lines.length - effectiveScriptLines;
          liveLines.push({
            text: textOps.gray(
              `(${hiddenLines} line${hiddenLines === 1 ? "" : "s"} hidden until exit. Use ${textOps.boldInline("-o prefixed")} for all lines or set ${textOps.boldInline("cliScriptOutputStyle")} in config)`,
            ),
            type: "scriptOutput",
          });
        }

        liveLines.push(
          ...state.lines
            .slice(-effectiveScriptLines)
            .map(
              (line) => ({ text: line.text, type: "scriptOutput" }) as const,
            ),
        );
      });
    }

    // Never draw past the viewport: we can't clear rows that scrolled away
    // (cursor-up is clamped at the top of the screen). Keep the TAIL so the
    // most recently active workspaces stay visible while older ones scroll
    // off, rather than pinning the stale top of the frame.
    const maxFrameHeight = Math.max(1, height - 1);
    const cappedLiveLines = liveLines.slice(-maxFrameHeight);

    for (const line of cappedLiveLines) {
      writeLine(line, width, false);
    }

    previousHeight = cappedLiveLines.length;

    if (isFinal) {
      writeLine(
        { text: textOps[BORDER_COLOR]("─ Summary ─"), type: "borderedContent" },
        width,
        false,
      );
      resetTuiTerminal();
    }
  };

  const handleExitResult = (
    result: RunScriptExit<RunWorkspaceScriptMetadata>,
  ) => {
    const state = workspaceState[result.metadata.workspace.name];

    if (result.signal) {
      if (state.status === "running") {
        if (result.signal === "SIGINT") {
          state.status = "interrupted";
        } else {
          state.status = "killed";
          state.signal = result.signal ?? null;
        }
      } else if (state.status === "pending") {
        state.status = "cancelled";
      }
    } else {
      state.status = result.skipped
        ? "skipped"
        : result.success
          ? "success"
          : "failure";
    }

    state.exitCode = result.exitCode ?? process.exitCode ?? null;
  };

  scriptEventTarget.addEventListener("start", (event) => {
    const { workspace } = event;
    workspaceState[workspace.name].status = "running";
    render();
  });

  scriptEventTarget.addEventListener("skip", (event) => {
    const { workspace } = event;
    workspaceState[workspace.name].status = "skipped";
    render();
  });

  scriptEventTarget.addEventListener("exit", (event) => {
    if (event.exitResult) handleExitResult(event.exitResult);
    render();
  });

  // Wrap so the signal name Node passes to the listener isn't read as the
  // `isFinal` argument (which would wrongly trigger a final render on resize).
  process.on("SIGWINCH", () => render());

  process.stdin.on("data", (data) => {
    // Send to the entire process group (pid=0) so child processes also receive
    // the signal. Raw mode prevents the terminal from doing this automatically.
    const signal =
      data[0] === 0x03 ? "SIGINT" : data[0] === 0x1c ? "SIGQUIT" : null;
    if (!signal) return;
    // Restore the tty before fanning the signal: once SIGINT lands across
    // the process group, child cleanup races with our own tcsetattr and
    // setRawMode reliably returns EIO, leaving the user's terminal stuck
    // in raw mode. Doing it here, synchronously, while we still own the
    // tty cleanly, is the only place this can run before the race.
    resetTuiTerminal();
    process.kill(0, signal);
  });

  runOnExit((reason) => {
    try {
      if (typeof reason === "string" && reason.startsWith("SIG")) {
        outputWriters.stdout("\r" + lineOps.clearFull());
      }

      Object.keys(workspaceState).forEach((workspaceName) => {
        handleExitResult({
          metadata: { workspace: { name: workspaceName } as Workspace },
          skipped: false,
          success: false,
          exitCode:
            typeof process.exitCode === "number" ? process.exitCode : -1,
          signal:
            typeof reason === "string" ? (reason as NodeJS.Signals) : null,
        } as RunScriptExit<RunWorkspaceScriptMetadata>);
      });
      render(true);
    } finally {
      resetTuiTerminal();
    }
  });

  initializeTuiTerminal();

  render();

  for await (const event of generateGroupedOutputLines(output, {
    stripDisruptiveControls: true,
  })) {
    const state = workspaceState[event.metadata.workspace.name];

    if (event.type === "line") {
      state.lines.push({
        text: event.line.replace(/\n$/, ""),
        type: "scriptOutput",
      });
      render();
      continue;
    }

    // A stream (stdout/stderr) finished draining. Once both have, no more
    // output can arrive for this workspace, so it becomes eligible to be
    // dumped out of the live view (render dumps it if it has also exited).
    state.endedStreams.add(event.metadata.streamName);
    if (state.endedStreams.size >= STREAMS_PER_WORKSPACE) {
      state.drained = true;
      render();
    }
  }

  await summary.then((summary) => {
    // fallback logic to resolve race conditions with script events
    summary.scriptResults.forEach((result) => {
      handleExitResult(result);
    });
    render(true);
  });
};
