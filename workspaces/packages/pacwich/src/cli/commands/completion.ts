import {
  SUPPORTED_COMPLETION_SHELLS,
  filterCompletionCandidates,
  getCompletionScript,
  planCompletion,
  type CompletionGroup,
  type CompletionShell,
  type ProjectGroup,
} from "@pacwich/common/cli";
import { IS_MACOS, stripANSI } from "../../internal/core";
import { logger } from "../../internal/logger";
import { createFileSystemProject } from "../../project";
import type { FileSystemProject } from "../../project/implementations/fileSystemProject";
import { handleGlobalCommand, splitWhitespaceArg } from "./commandHandlerUtils";
import {
  bashLoginShellHint,
  completionInfoText,
  detectShell,
  formatInstallReport,
  installCompletion,
} from "./completionInstall";

const isCompletionShell = (value: string): value is CompletionShell =>
  (SUPPORTED_COMPLETION_SHELLS as readonly string[]).includes(value);

const INSTALL_ACTION = "install";

/**
 * `pacwich completion` — shell completion command with three modes:
 * - no argument: print setup help ({@link completionInfoText}).
 * - `<shell>`: print that shell's completion script (a thin wrapper that
 *   calls the hidden `__complete` command; see {@link tryRunCompletionRequest}).
 * - `install [shell]`: wire completions into the shell's config, detecting
 *   the current shell when none is given ({@link runCompletionInstall}).
 */
export const completion = handleGlobalCommand(
  "completion",
  (
    { outputWriters },
    action: string | undefined,
    shellArg: string | undefined,
  ) => {
    if (!action) {
      outputWriters.stdout(completionInfoText() + "\n");
      return;
    }

    if (action === INSTALL_ACTION) {
      runCompletionInstall(outputWriters.stdout, shellArg);
      return;
    }

    if (isCompletionShell(action)) {
      outputWriters.stdout(getCompletionScript(action) + "\n");
      return;
    }

    logger.error(
      `Unknown argument "${action}". Usage: pacwich completion [install] [${SUPPORTED_COMPLETION_SHELLS.join(
        "|",
      )}]. Run \`pacwich completion\` for setup help.`,
    );
    process.exit(1);
  },
);

/** Resolve the target shell (explicit arg, else auto-detect) and install. */
const runCompletionInstall = (
  stdout: (text: string) => void,
  shellArg: string | undefined,
): void => {
  if (shellArg && !isCompletionShell(shellArg)) {
    logger.error(
      `Unsupported shell "${shellArg}". Supported: ${SUPPORTED_COMPLETION_SHELLS.join(", ")}.`,
    );
    process.exit(1);
    return;
  }

  const shell = shellArg ? (shellArg as CompletionShell) : detectShell();
  if (!shell) {
    logger.error(
      `Could not detect a supported shell. Run \`pacwich completion install <${SUPPORTED_COMPLETION_SHELLS.join(
        "|",
      )}>\`, or see \`pacwich completion\` for manual setup.`,
    );
    process.exit(1);
    return;
  }

  stdout(formatInstallReport(installCompletion({ shell })) + "\n");

  // Nudge only the narrow group this may not reach: macOS bash login shells
  // (see bashLoginShellHint). Silent for everyone else.
  if (shell === "bash") {
    const hint = bashLoginShellHint({ isMacOS: IS_MACOS });
    if (hint) logger.warn(hint);
  }
};

/** Name of the hidden command the shell wrappers invoke. */
export const COMPLETE_COMMAND = "__complete";

/**
 * Handle a `pacwich __complete -- <words>` request, if that is what the
 * given args represent, and return `true` to signal the CLI should stop.
 *
 * @param commandArgs Args up to (not including) the `--` terminator.
 * @param words The post-terminator words; the last is the partial word.
 */
export const tryRunCompletionRequest = (
  commandArgs: string[],
  words: string[],
  stdout: (text: string) => void,
): boolean => {
  // Handles edge case to avoid colliding with a workspace literally named
  // `__complete` that might appear inside the words being completed.
  if (commandArgs[commandArgs.length - 1] !== COMPLETE_COMMAND) return false;

  // Suppress other output
  logger.printLevel = "silent";

  const plan = planCompletion(words);

  // Load the project only when a dynamic group needs it — static
  // completions never touch it.
  const project = plan.some((group) => group.kind === "dynamic")
    ? loadProjectForCompletion(words)
    : null;

  const lines = plan.flatMap((group) => resolveGroupLines(group, project));
  if (lines.length) stdout(lines.join("\n") + "\n");
  return true;
};

/** The flag that opts completion out of evaluating executable configs. */
const DISABLE_CONFIGS_FLAG = "--disable-executable-configs";

const loadProjectForCompletion = (
  words: string[],
): FileSystemProject | null => {
  const disableExecutableConfigs = hasDisableConfigsFlag(words) || undefined;

  // prevent config from writing to stdout/stderr during completion
  return withMutedStdio(() => {
    try {
      return createFileSystemProject({
        rootDirectory: extractCwd(words),
        disableExecutableConfigs,
      });
    } catch {
      return null;
    }
  });
};

/**
 * Whether `--disable-executable-configs` appears among the already-typed
 * words. Skips last element due to being a partial word typed.
 */
const hasDisableConfigsFlag = (words: string[]): boolean => {
  for (let i = 0; i < words.length - 1; i++) {
    if (words[i] === DISABLE_CONFIGS_FLAG) return true;
  }
  return false;
};

/**
 * Run `fn` with `process.stdout`/`process.stderr` writes swallowed, so a
 * config's incidental output can't corrupt the completion candidate
 * stream. Writes are restored even if `fn` throws.
 */
const withMutedStdio = <T>(fn: () => T): T => {
  const originalStdout = process.stdout.write.bind(process.stdout);
  const originalStderr = process.stderr.write.bind(process.stderr);
  const swallow = (() => true) as typeof process.stdout.write;
  process.stdout.write = swallow;
  process.stderr.write = swallow;
  try {
    return fn();
  } finally {
    process.stdout.write = originalStdout;
    process.stderr.write = originalStderr;
  }
};

/**
 * Column separator for completion candidate lines .The shell wrappers split these
 * with `read`/`IFS`, dropping empty columns.
 */
const FIELD_SEPARATOR = "\u001f";

/**
 * Make an external candidate field safe for both the terminal, stripping
 * control codes and problematic whitespace that could break the completion format.
 */
export const sanitizeCompletionField = (value: string): string =>
  stripANSI(value).replace(/[\t\n\r]/g, "");

/**
 * Render a planned group as `group<separator>value<separator>description<separator>flags` lines.
 */
const resolveGroupLines = (
  group: CompletionGroup,
  project: FileSystemProject | null,
): string[] => {
  const flags = group.noSpace ? "nospace" : "";

  if (group.kind === "static") {
    return group.items.map((item) =>
      [
        group.label,
        sanitizeCompletionField(item.value),
        sanitizeCompletionField(item.description ?? ""),
        flags,
      ].join(FIELD_SEPARATOR),
    );
  }

  if (!project) return [];

  const names = projectSourceNames(group, project);
  return filterCompletionCandidates(names, group.prefix).map((name) =>
    [
      group.label,
      sanitizeCompletionField(`${group.valuePrefix ?? ""}${name}`),
      "",
      flags,
    ].join(FIELD_SEPARATOR),
  );
};

const projectSourceNames = (
  group: ProjectGroup,
  project: FileSystemProject,
): string[] => {
  switch (group.source) {
    case "script":
      return scriptNames(group.workspaceScope, project);
    case "tag":
      return Object.keys(project.tagMap);
    case "workspaceName":
      return project.workspaces.map((workspace) => workspace.name);
    case "workspaceAlias":
      return project.workspaces.flatMap((workspace) => workspace.aliases);
    case "workspacePath":
      // workspace.path is already project-root-relative
      return project.workspaces.map((workspace) => workspace.path || ".");
  }
};

/**
 * Script names: the project-wide union, or — when a workspace was already
 * supplied via `-W`/`--workspace`/`--workspace-patterns`. Only the
 * scripts of the workspaces those patterns resolve to.
 */
const scriptNames = (
  workspaceScope: string[] | undefined,
  project: FileSystemProject,
): string[] => {
  if (!workspaceScope?.length) return Object.keys(project.scriptMap);

  const patterns = workspaceScope.flatMap(splitWhitespaceArg);
  if (!patterns.length) return Object.keys(project.scriptMap);

  const scripts = new Set<string>();
  for (const workspace of project.findWorkspacesByPattern(...patterns)) {
    for (const script of workspace.scripts) scripts.add(script);
  }
  return [...scripts];
};

/**
 * Resolve the directory to load the project from: an explicit `--cwd` /
 * `--cwd=` already on the line, else the process working directory (where
 * the shell invoked completion).
 */
const extractCwd = (words: string[]): string => {
  // Skip the final element — it's the partial word under the cursor.
  for (let i = 0; i < words.length - 1; i++) {
    const word = words[i];
    if (word.startsWith("--cwd=")) return word.slice("--cwd=".length);
    if (word === "--cwd" && i + 1 < words.length - 1) return words[i + 1];
  }
  return process.cwd();
};
