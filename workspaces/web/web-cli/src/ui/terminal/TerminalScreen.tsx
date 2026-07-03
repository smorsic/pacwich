import { FitAddon } from "@xterm/addon-fit";
import { type Terminal as XTermTerminal, type ITheme } from "@xterm/xterm";
import { useEffect, useRef, useState } from "react";
import "@xterm/xterm/css/xterm.css";
import {
  useSetWebCliTerminalSelection,
  useWebCliResult,
} from "../state/invokeWebCli";
import { WEB_CLI_INPUT_ID } from "./ids";

export type TerminalSize = {
  cols: number;
  rows: number;
};

export type TerminalScreenProps = {
  onTerminalResize?: (size: TerminalSize) => void;
};

const getTerminalTheme = (): ITheme => {
  const computedStyle = getComputedStyle(document.documentElement);

  const getCssVariable = (name: string) =>
    computedStyle.getPropertyValue(name).trim();

  return {
    background: getCssVariable("--rp-c-code-block-bg"),
    foreground: getCssVariable("--rp-c-text-1"),
    cursor: "transparent",
    cursorAccent: "transparent",
    selectionBackground: getCssVariable("--rp-c-bg-soft"),
    black: getCssVariable("--web-cli-black"),
    red: getCssVariable("--web-cli-red"),
    green: getCssVariable("--web-cli-green"),
    yellow: getCssVariable("--web-cli-yellow"),
    blue: getCssVariable("--web-cli-blue"),
    magenta: getCssVariable("--web-cli-magenta"),
    cyan: getCssVariable("--web-cli-cyan"),
    white: getCssVariable("--rp-c-text-1"),
    brightBlack: getCssVariable("--web-cli-bright-black"),
    brightRed: getCssVariable("--web-cli-red"),
    brightGreen: getCssVariable("--web-cli-green"),
    brightYellow: getCssVariable("--web-cli-yellow"),
    brightBlue: getCssVariable("--web-cli-blue"),
    brightMagenta: getCssVariable("--web-cli-magenta"),
    brightCyan: getCssVariable("--web-cli-cyan"),
    brightWhite: getCssVariable("--rp-c-text-1"),
  };
};

export const TerminalScreen = ({ onTerminalResize }: TerminalScreenProps) => {
  const terminalDivRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<XTermTerminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [xtermModule, setXtermModule] = useState<
    // eslint-disable-next-line @typescript-eslint/consistent-type-imports
    typeof import("@xterm/xterm") | null
  >(null);
  const setTerminalSelection = useSetWebCliTerminalSelection();

  const cliResult = useWebCliResult();
  const writtenChunksRef = useRef(0);

  useEffect(() => {
    import("@xterm/xterm").then((module) => {
      setXtermModule(module);
    });
  }, []);

  // Theme changes (the host toggling `.dark` on <html>) are picked up by the
  // MutationObserver below, which re-reads the CSS variables and re-fits.
  useEffect(() => {
    if (!terminalDivRef.current || !xtermModule) return;

    const terminal = new xtermModule.Terminal({
      disableStdin: true,
      cursorBlink: false,
      cursorWidth: 1,
      cursorInactiveStyle: "none",
      allowTransparency: true,
      fontFamily: "var(--rp-font-family-terminal)",
      fontSize: 16,
      lineHeight: 1.35,
      theme: getTerminalTheme(),
    });

    const cleanupOnSelectionChange = terminal.onSelectionChange(() => {
      setTerminalSelection(terminal.getSelection());
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(terminalDivRef.current);
    terminal.write("\x1b[?25l");

    const fitAndNotify = () => {
      fitAddon.fit();
      onTerminalResize?.({
        cols: terminal.cols,
        rows: terminal.rows,
      });
    };

    fitAndNotify();

    const resizeObserver = new ResizeObserver(() => {
      fitAndNotify();
    });
    resizeObserver.observe(terminalDivRef.current);

    const rootClassObserver = new MutationObserver(() => {
      terminal.options.theme = getTerminalTheme();
      fitAndNotify();
    });
    rootClassObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;

    return () => {
      rootClassObserver.disconnect();
      resizeObserver.disconnect();
      cleanupOnSelectionChange.dispose();
      fitAddonRef.current = null;
      terminalRef.current = null;
      terminal.dispose();
    };
  }, [onTerminalResize, setTerminalSelection, xtermModule]);

  useEffect(() => {
    const terminal = terminalRef.current;
    if (!terminal) return;

    if (cliResult.length === 0) {
      terminal.reset();
      terminal.write("\x1b[?25l");
      writtenChunksRef.current = 0;
      return;
    }

    const newChunks = cliResult.slice(writtenChunksRef.current);
    if (newChunks.length === 0) return;

    const payload = newChunks
      .map((chunk) => chunk.terminalOutput)
      .join("")
      .replaceAll("\n", "\r\n")
      .replace(/\p{Emoji_Presentation}/gu, "$& ");
    terminal.write(payload);
    writtenChunksRef.current = cliResult.length;

    const lastChunk = newChunks[newChunks.length - 1];
    lastChunk.warnings.forEach((warning) => {
      terminal.write(
        `\x1b[33m${warning.message.replaceAll("\n", "\r\n")}\x1b[0m`,
      );
    });
    lastChunk.errors.forEach((error) => {
      terminal.write(
        `\x1b[31m${error.message.replaceAll("\n", "\r\n")}\x1b[0m`,
      );
    });
  }, [cliResult]);

  return (
    <div
      className="web-cli-terminal-screen-container"
      onClick={() => {
        const input = document.getElementById(WEB_CLI_INPUT_ID);
        if (input) {
          input.focus();
        }
      }}
    >
      <div className="web-cli-terminal-screen" ref={terminalDivRef} />
    </div>
  );
};
