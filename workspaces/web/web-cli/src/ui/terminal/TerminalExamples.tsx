import { forwardRef, useEffect, useState } from "react";
import { useSetWebCliInput } from "../state/invokeWebCli";
import { EXAMPLE_COMMANDS } from "./exampleCommands";
import { WEB_CLI_EXAMPLES_ID, WEB_CLI_INPUT_ID } from "./ids";

export const TerminalExamples = forwardRef<HTMLButtonElement, object>(
  function TerminalExamplesWithRef(_props, ref) {
    const [examplesOpen, setExamplesOpen] = useState(false);

    const setInput = useSetWebCliInput();

    useEffect(() => {
      if (examplesOpen) {
        document.getElementById("first-example")?.focus();

        const onWindowClick = (e: MouseEvent) => {
          if (
            !document
              .getElementById(WEB_CLI_EXAMPLES_ID)
              ?.contains(e.target as Node)
          ) {
            setExamplesOpen(false);
          }
        };

        const onKeyDown = (e: KeyboardEvent) => {
          if (e.key === "Escape") {
            setExamplesOpen(false);
          }
        };

        setTimeout(() => {
          window.addEventListener("click", onWindowClick);
          window.addEventListener("keydown", onKeyDown);
        });

        return () => {
          window.removeEventListener("click", onWindowClick);
          window.removeEventListener("keydown", onKeyDown);
        };
      } else {
        document.getElementById(WEB_CLI_INPUT_ID)?.focus();
      }
    }, [examplesOpen]);

    return (
      <div
        className="web-cli-terminal-examples-container"
        id={WEB_CLI_EXAMPLES_ID}
        tabIndex={-1}
      >
        <button
          className="web-cli-terminal-example-button"
          type="button"
          ref={ref}
          onClick={() => setExamplesOpen(!examplesOpen)}
        >
          Examples
        </button>
        {examplesOpen && (
          <div className="web-cli-terminal-examples-content">
            {EXAMPLE_COMMANDS.map((example, i) => (
              <button
                id={i === 0 ? "first-example" : undefined}
                className={`web-cli-terminal-example ${i % 2 === 0 ? "even" : "odd"}`}
                key={example.name}
                onClick={() => {
                  setInput(example.command);
                  setExamplesOpen(false);
                }}
              >
                <h3 className="web-cli-terminal-example-name">
                  {example.name}
                </h3>
                <p className="web-cli-terminal-example-description">
                  {example.description}:&nbsp;&nbsp;
                  <code className="web-cli-terminal-example-command">
                    pacwich {example.command}
                  </code>
                </p>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  },
);
