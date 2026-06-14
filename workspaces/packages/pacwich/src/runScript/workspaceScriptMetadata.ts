import { type ScriptShellOption } from "@pacwich/common/parameters";
import {
  getWorkspaceScriptMetadataConfig,
  type WorkspaceScriptMetadata,
  type WorkspaceScriptMetadataKey,
} from "@pacwich/common/runScript";
import { quote } from "../internal/bundledDeps/shellQuote";
import { PacwichError, IS_WINDOWS } from "../internal/core";

/**
 * Wrap a value so that, when it is concatenated into a shell command for
 * `shell`, the receiving shell parses it as a single literal token. Used
 * when substituted metadata values land in a shell-interpretable context
 * (inline command bodies, string-form `--args` before POSIX parse).
 */
export const quoteShellValue = (
  value: string,
  shell: ScriptShellOption,
): string =>
  IS_WINDOWS && shell === "system"
    ? `"${value.replace(/"/g, '""')}"`
    : quote([value]);

export const createScriptRuntimeEnvVars = (
  metadata: WorkspaceScriptMetadata,
) => {
  const keys = [
    "projectPath",
    "projectName",
    "workspacePath",
    "workspaceRelativePath",
    "scriptName",
    "workspaceName",
  ] as const satisfies WorkspaceScriptMetadataKey[];

  return keys.reduce(
    (acc, key) => {
      const { envVarName } = getWorkspaceScriptMetadataConfig(key);
      acc[envVarName] = metadata[key];
      return acc;
    },
    {} as Record<string, string>,
  );
};

export type InterpolateWorkspaceScriptMetadataOptions = {
  /** Text containing inline metadata tokens (e.g. `<workspaceName>`) to substitute. */
  text: string;
  /** Metadata values to substitute into the text. */
  metadata: WorkspaceScriptMetadata;
  /** Target shell. Controls escaping when `quoteValues` is true. */
  shell: ScriptShellOption;
  /**
   * When true, each substituted metadata value is wrapped via
   * {@link quoteShellValue} so that shell metacharacters in the value
   * (e.g. `;`, `|`, `$`) cannot break out into the surrounding shell
   * command. Use at call sites where the interpolation result lands
   * directly in a shell-interpretable string with no later quoting.
   */
  quoteValues?: boolean;
};

export const interpolateWorkspaceScriptMetadata = ({
  text,
  metadata,
  shell,
  quoteValues = false,
}: InterpolateWorkspaceScriptMetadataOptions) => {
  const keys = [
    "projectPath",
    "projectName",
    "workspacePath",
    "workspaceRelativePath",
    "scriptName",
    "workspaceName",
  ] as const satisfies WorkspaceScriptMetadataKey[];

  const inlineNames = keys.map(
    (key) => getWorkspaceScriptMetadataConfig(key).inlineName,
  );

  return text.replace(new RegExp(inlineNames.join("|"), "g"), (match) => {
    const key = keys.find(
      (k) => getWorkspaceScriptMetadataConfig(k).inlineName === match,
    );
    const value = metadata[key as WorkspaceScriptMetadataKey];
    if (quoteValues) {
      // Preserve "empty substitution is invisible". Quoting an empty value
      // would inject a literal `''` shell token (an empty positional arg),
      // which changes argv length for commands like `echo <scriptName>`
      // when no inline scriptName is set.
      return value === "" ? "" : quoteShellValue(value, shell);
    }
    if (IS_WINDOWS && shell === "bun") {
      return value.replace(/\\/g, "\\\\");
    }
    return value;
  });
};

/**
 * Read a single metadata value about the project, workspace, or
 * script that invoked this process. Intended to be called from
 * inside a `package.json` script (or inline command) that was run
 * through pacwich, which sets the corresponding `PACWICH_*`
 * environment variables on the child process.
 *
 * Throws {@link PacwichError} if the expected env var isn't set,
 * which typically means the script wasn't actually invoked via
 * pacwich.
 *
 * @example
 * // inside a script that pacwich invoked
 * import { getWorkspaceScriptMetadata } from "pacwich/script";
 *
 * const workspaceName = getWorkspaceScriptMetadata("workspaceName");
 * const projectPath = getWorkspaceScriptMetadata("projectPath");
 */
export const getWorkspaceScriptMetadata = (key: WorkspaceScriptMetadataKey) => {
  const { envVarName } = getWorkspaceScriptMetadataConfig(key);
  if (!(envVarName in process.env)) {
    throw new PacwichError(
      `getScriptMetadata() called with key "${key}" but environment variable ${envVarName} is not set. getScriptMetadata() may not have been called in a workspace script running via pacwich.`,
    );
  }
  return process.env[envVarName] as string;
};
