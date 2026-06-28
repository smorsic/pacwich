import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import { useCallback, useEffect, useRef, useState } from "react";
import { runPacwichCli } from "../cli/runPacwichCli";
import "@xterm/xterm/css/xterm.css";

const WELCOME = [
  "\x1b[1mpacwich web-cli sandbox\x1b[0m",
  "The real pacwich CLI, running in your browser over an in-memory filesystem.",
  "",
  "Try:",
  "  \x1b[36mlist-workspaces\x1b[0m",
  "  \x1b[36mlist-workspaces --name-only\x1b[0m",
  "  \x1b[36mlist-scripts\x1b[0m",
  "  \x1b[36m--help\x1b[0m",
  "",
];

/** xterm wants CRLF; the CLI emits LF. */
const toCrlf = (text: string) => text.replace(/\r?\n/g, "\r\n");

export const WebCliTerminal = () => {
  const screenRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [input, setInput] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const historyRef = useRef<string[]>([]);
  const historyIndexRef = useRef<number>(-1);

  useEffect(() => {
    if (!screenRef.current) return;

    const term = new Terminal({
      convertEol: false,
      cursorBlink: false,
      disableStdin: true,
      fontSize: 14,
      fontFamily:
        'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
      theme: { background: "#161b22", foreground: "#e6edf3" },
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(screenRef.current);
    fit.fit();

    term.writeln(WELCOME.map(toCrlf).join("\r\n"));

    termRef.current = term;
    fitRef.current = fit;

    const onResize = () => fit.fit();
    const observer = new ResizeObserver(onResize);
    observer.observe(screenRef.current);

    return () => {
      observer.disconnect();
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
    };
  }, []);

  const runCommand = useCallback(async (commandLine: string) => {
    const term = termRef.current;
    if (!term) return;

    term.writeln(`\x1b[32m$ pacwich\x1b[0m ${commandLine}`);

    const cols = term.cols || 80;
    const result = await runPacwichCli(commandLine, {
      terminalWidth: cols,
      onOutput: (text, stream) => {
        const payload = toCrlf(text);
        term.write(stream === "stderr" ? `\x1b[31m${payload}\x1b[0m` : payload);
      },
    });

    // Ensure the prompt starts on a fresh line.
    term.write("\r\n");
    if (result.exitCode !== 0) {
      term.writeln(`\x1b[31m[exit ${result.exitCode}]\x1b[0m`);
    }
    term.scrollToBottom();
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const commandLine = input.trim();
      if (!commandLine || isRunning) return;

      historyRef.current.push(commandLine);
      historyIndexRef.current = historyRef.current.length;
      setInput("");
      setIsRunning(true);
      try {
        await runCommand(commandLine);
      } finally {
        setIsRunning(false);
        inputRef.current?.focus();
      }
    },
    [input, isRunning, runCommand],
  );

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const history = historyRef.current;
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!history.length) return;
      historyIndexRef.current = Math.max(0, historyIndexRef.current - 1);
      setInput(history[historyIndexRef.current] ?? "");
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!history.length) return;
      historyIndexRef.current = Math.min(
        history.length,
        historyIndexRef.current + 1,
      );
      setInput(history[historyIndexRef.current] ?? "");
    }
  }, []);

  return (
    <div className="terminal" onClick={() => inputRef.current?.focus()}>
      <div className="terminal__screen" ref={screenRef} />
      <form className="terminal__form" onSubmit={handleSubmit}>
        <span className="terminal__prompt">$ pacwich</span>
        <input
          ref={inputRef}
          className="terminal__input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isRunning}
          autoFocus
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          placeholder={
            isRunning ? "running…" : "type a command, e.g. list-workspaces"
          }
        />
      </form>
    </div>
  );
};
