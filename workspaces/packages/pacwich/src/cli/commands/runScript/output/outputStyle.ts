import { PacwichError } from "../../../../internal/core/error";
import { IS_TTY } from "../../../../internal/core/process/terminal";

export const OUTPUT_STYLE_VALUES = [
  "grouped",
  "prefixed",
  "plain",
  "none",
] as const;

export type OutputStyleName = (typeof OUTPUT_STYLE_VALUES)[number];

/**
 * Resolve the default output style for a `run-script` / `run-affected`
 * invocation that didn't pass `--output-style`.
 *
 * If `configuredDefault` is set (from the project's
 * `defaults.cliScriptOutputStyle` or `PACWICH_CLI_SCRIPT_OUTPUT_STYLE_DEFAULT`),
 * it wins over the TTY-derived default. A configured `"grouped"` is
 * downgraded to `"prefixed"` when stdout is not a TTY because the
 * grouped renderer requires an interactive terminal.
 */
export const getDefaultOutputStyle = (
  configuredDefault?: OutputStyleName,
): OutputStyleName => {
  const desired = configuredDefault ?? (IS_TTY ? "grouped" : "prefixed");
  return desired === "grouped" && !IS_TTY ? "prefixed" : desired;
};

export const validateOutputStyle = (style: string): OutputStyleName => {
  if (!OUTPUT_STYLE_VALUES.includes(style as OutputStyleName)) {
    throw new PacwichError(
      `Invalid output style: "${style}" (accepted values: ${OUTPUT_STYLE_VALUES.join(", ")})`,
    );
  }
  return style as OutputStyleName;
};
