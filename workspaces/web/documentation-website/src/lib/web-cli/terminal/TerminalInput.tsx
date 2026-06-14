import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FaTerminal } from "react-icons/fa";
import { parse } from "shell-quote";
import { useApiState } from "../../service";
import {
  useAddCommandToHistory,
  useDecrementCommandHistoryIndex,
  useHistoryCommand,
  useHistoryIndex,
  useIncrementCommandHistoryIndex,
  useResetHistoryIndex,
} from "../util/commandHistory";
import {
  useInvokeWebCli,
  useSetWebCliInput,
  useWebCliInput,
  useWebCliTerminalSelection,
} from "../util/invokeWebCli";
import { EXAMPLE_COMMANDS } from "./exampleCommands";
import { WEB_CLI_INPUT_ID } from "./ids";
import { TerminalExamples } from "./TerminalExamples";

const parseArgv = (input: string) => {
  const parsed = parse(input);

  const argv: string[] = [];
  const operations: string[] = [];

  for (const entry of parsed) {
    if (typeof entry === "object" && "op" in entry) {
      if (entry.op === "glob") {
        argv.push(entry.pattern);
      } else {
        argv.push(entry.op);
        if (!operations.includes(entry.op)) {
          operations.push(entry.op);
        }
      }
    } else if (typeof entry === "string") {
      argv.push(entry);
    }
  }

  return {
    argv: argv.filter((entry, i) => !(i === 0 && entry.trim() === "pacwich")),
    operations,
  };
};

const getRandomExampleCommand = (previous?: string) => {
  let newExample = previous;
  while (newExample === previous || (newExample?.length ?? 0) >= 40) {
    newExample =
      EXAMPLE_COMMANDS[Math.floor(Math.random() * EXAMPLE_COMMANDS.length)]
        .command;
  }
  return newExample ?? EXAMPLE_COMMANDS[0].command;
};

export const TerminalInput = () => {
  const input = useWebCliInput();
  const setInput = useSetWebCliInput();

  const inputRef = useRef<HTMLInputElement>(null);
  const submitRef = useRef<HTMLButtonElement>(null);
  const examplesRef = useRef<HTMLButtonElement>(null);
  const resetHistoryIndex = useResetHistoryIndex();
  const historyCommand = useHistoryCommand();
  const incrementHistoryIndex = useIncrementCommandHistoryIndex();
  const decrementHistoryIndex = useDecrementCommandHistoryIndex();
  const historyIndex = useHistoryIndex();
  const addCommandToHistory = useAddCommandToHistory();
  const terminalSelection = useWebCliTerminalSelection();

  const [placeholderText, setPlaceholderText] = useState<string>("Loading");

  const { argv, operations } = useMemo(() => parseArgv(input), [input]);

  const { isReady, isLoading, error } = useApiState();

  const setNewPlaceholderExample = useCallback(() => {
    setPlaceholderText(
      ` Enter a command (like: ${getRandomExampleCommand(placeholderText).replace("pacwich ", "")})`,
    );
  }, [placeholderText]);

  useEffect(() => {
    if (!isLoading) {
      inputRef.current?.focus();
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNewPlaceholderExample();
    } else {
      let ellipsisCount = 0;
      const interval = setInterval(() => {
        setPlaceholderText("Loading" + ".".repeat(ellipsisCount));
        ellipsisCount++;
        if (ellipsisCount > 3) {
          ellipsisCount = 0;
        }
      }, 350);
      return () => clearInterval(interval);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading]);

  useEffect(() => {
    if (input.trim() || isLoading) return;
    const timeout = setTimeout(() => {
      setNewPlaceholderExample();
    }, 4000);
    return () => clearTimeout(timeout);
  }, [input, isLoading, setNewPlaceholderExample]);

  const { isLoading: isInvoking, invokeWebCli } = useInvokeWebCli();

  const isError = !!error || (!isLoading && !isReady);
  const disabled = !isReady || isError || isInvoking;

  useEffect(() => {
    if (historyCommand) {
      setInput(historyCommand);
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.selectionStart = inputRef.current?.value.length ?? 0;
        }
      });
    }
  }, [historyCommand, setInput]);

  const handleInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setInput(e.target.value);
      resetHistoryIndex();
    },
    [resetHistoryIndex, setInput],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) {
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        incrementHistoryIndex();
      } else if (e.key === "ArrowDown") {
        decrementHistoryIndex();
        if (historyIndex <= 0) {
          setInput("");
        }
      }
    },
    [incrementHistoryIndex, decrementHistoryIndex, historyIndex, setInput],
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (disabled) return;
      if (!input.trim()) return;
      invokeWebCli({
        argv,
      });
      addCommandToHistory(input.trim());
      setInput("");
      inputRef.current?.focus();
    },
    [disabled, invokeWebCli, input, argv, addCommandToHistory, setInput],
  );

  return (
    <div>
      <form
        onSubmit={handleSubmit}
        className="web-cli-input-form"
        onClick={(e) => {
          if (
            (e.target as HTMLElement) !== inputRef.current &&
            (e.target as HTMLElement) !== submitRef.current &&
            (e.target as HTMLElement) !== examplesRef.current &&
            !submitRef.current?.contains(e.target as Node) &&
            !examplesRef.current?.contains(e.target as Node)
          ) {
            inputRef.current?.focus();
          }
        }}
        onKeyDown={(e) => {
          if (
            e.key === "c" &&
            (e.ctrlKey || e.metaKey) &&
            inputRef.current?.selectionStart === inputRef.current?.selectionEnd
          ) {
            // allow copying text in terminal normally
            navigator.clipboard.writeText(terminalSelection);
          }
        }}
      >
        <span className="web-cli-input-label">$ pacwich</span>
        {isError ? (
          <div className="web-cli-input-error">
            Something went wrong! Try reloading or try again later. <br />
            Report recurring issues on{" "}
            <a
              href="https://github.com/smorsic/pacwich"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub
            </a>
          </div>
        ) : (
          <input
            ref={inputRef}
            className="web-cli-input"
            id={WEB_CLI_INPUT_ID}
            disabled={isLoading}
            type="text"
            autoCapitalize="off"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            maxLength={200}
            placeholder={placeholderText}
          />
        )}
        <button
          disabled={disabled || !argv.length}
          type="submit"
          className="web-cli-input-submit"
          ref={submitRef}
        >
          <FaTerminal />
        </button>
        <TerminalExamples ref={examplesRef} />
      </form>
      <div className="web-cli-input-warning">
        {operations.length > 0 && (
          <>
            Warning: Shell operations like{" "}
            <code>{operations.join(" or ")}</code> are not supported. This only
            passes arguments to <code>pacwich</code>.
          </>
        )}
      </div>
    </div>
  );
};
