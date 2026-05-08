import type { CliCommandName } from "bw-common/cli";
import { type ReactNode, useId } from "react";
import { Link } from "rspress/theme";
import { SyntaxHighlighter } from "../util/highlight";
import { getCliCommandContent } from "./cliCommandOptions";
import { getCommandId } from "./searchIds";

const renderDescription = ({
  description,
  descriptionLinks,
}: {
  description: string;
  descriptionLinks?: Record<string, string>;
}) => {
  if (!descriptionLinks || Object.keys(descriptionLinks).length === 0) {
    return description;
  }

  const nodes: ReactNode[] = [description];
  let linkIndex = 0;

  for (const [linkText, href] of Object.entries(descriptionLinks)) {
    const nextNodes: ReactNode[] = [];

    for (const node of nodes) {
      if (typeof node !== "string") {
        nextNodes.push(node);
        continue;
      }

      const segments = node.split(linkText);
      if (segments.length === 1) {
        nextNodes.push(node);
        continue;
      }

      segments.forEach((segment, index) => {
        if (segment) {
          nextNodes.push(segment);
        }
        if (index < segments.length - 1) {
          nextNodes.push(
            <Link
              key={`description-link-${linkIndex++}`}
              href={href}
              className="inline-link"
            >
              {linkText}
            </Link>,
          );
        }
      });
    }

    nodes.splice(0, nodes.length, ...nextNodes);
  }

  return nodes;
};

export const CliCommandDoc = ({ command }: { command: CliCommandName }) => {
  const content = getCliCommandContent(command);
  const id = useId();
  return (
    <div className="cli-command-doc">
      <div id={getCommandId(content)} className="cli-doc-section-anchor" />
      <p>
        Usage: <code>{content.command}</code>
      </p>
      {content.aliases?.length ? (
        <p>
          Aliases:{" "}
          {content.aliases.map((value) => (
            <code
              key={id + "code-alias-" + value}
              style={{ marginRight: "0.25rem" }}
            >
              {value}
            </code>
          ))}
        </p>
      ) : (
        ""
      )}
      <p style={{ marginBottom: "0" }}>
        {renderDescription({
          description: content.description,
          descriptionLinks: content.descriptionLinks,
        })}
      </p>

      {Object.values(content.options)?.length ? (
        <div style={{ marginTop: "1rem" }}>
          <h5>
            <em>Options:</em>
          </h5>
          <div className="cli-command-options-container">
            {Object.values(content.options).map((option) => (
              <div
                key={
                  "cli-command-option-" +
                  content.command +
                  "-" +
                  option.flags.join(", ")
                }
              >
                <p className="cli-command-option-flags">
                  <code>{option.flags.join(" | ")}</code>:
                  <span>{option.description}</span>
                  {option.values?.length ? (
                    <span style={{ marginLeft: "0.25rem" }}>
                      (Values: <span>{option.values.join(" | ")}</span>)
                    </span>
                  ) : null}
                </p>
                <hr />
              </div>
            ))}
          </div>
        </div>
      ) : (
        ""
      )}
      <h5>
        <em>Examples:</em>
      </h5>
      <SyntaxHighlighter language="bash">
        {content.examples.join("\n")}
      </SyntaxHighlighter>
    </div>
  );
};
