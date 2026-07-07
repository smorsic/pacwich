import fs from "fs";
import path from "path";
import type {
  ParallelMaxValue,
  ScriptShellOption,
} from "@pacwich/common/parameters";
import { expandHomePath, stripANSI } from "../../../internal/core";
import { logger } from "../../../internal/logger";
import type {
  FileSystemProject,
  RunScriptAcrossWorkspacesOptions,
  RunScriptAcrossWorkspacesResult,
} from "../../../project";
import { parseOutputBufferBytes } from "../../../runScript";
import type { ProjectCommandContext } from "../commandHandlerUtils";
import {
  getDefaultOutputStyle,
  validateOutputStyle,
  type OutputStyleName,
} from "./output/outputStyle";
import {
  createScriptEvent,
  createScriptEventTarget,
  renderGroupedOutput,
} from "./output/renderGroupedOutput";
import { renderPlainOutput } from "./output/renderPlainOutput";

/**
 * The CLI options that drive the shared script-run flow used by both
 * `run-script` and `run-affected`. The two commands diverge on workspace
 * selection (workspace patterns vs. affected diff inputs) but converge here
 * for everything from option building through output rendering and exit.
 */
export type SharedRunScriptCliOptions = {
  parallel: boolean | string;
  args: string;
  /** @deprecated Use `--output-style=plain` instead of `--no-prefix`. */
  prefix: boolean;
  inline: boolean;
  inlineName: string | undefined;
  shell: string | undefined;
  depOrder: boolean;
  ignoreDepFailure: boolean;
  jsonOutfile: string | undefined;
  outputStyle: string | undefined;
  groupedLines: string | undefined;
  maxOutputBuffer: string | undefined;
};

/**
 * Resolved script-run options the runner callback receives. Matches the API's
 * `runScriptAcrossWorkspaces` shape minus the workspace-selection field, which
 * is supplied by each command's runner closure.
 */
export type ScriptRunnerInput = Omit<
  RunScriptAcrossWorkspacesOptions,
  "workspacePatterns"
>;

/**
 * Callback supplied by each command (`run-script` / `run-affected`) that
 * produces a script-run result from the resolved script-run options.
 */
export type ScriptRunner = (
  input: ScriptRunnerInput,
) => RunScriptAcrossWorkspacesResult | Promise<RunScriptAcrossWorkspacesResult>;

export type HandleScriptRunFlowOptions = {
  project: FileSystemProject;
  context: Pick<
    ProjectCommandContext,
    "outputWriters" | "terminalWidth" | "terminalHeight"
  >;
  script: string | undefined;
  scriptArgs: string | string[];
  cliOptions: SharedRunScriptCliOptions;
  runner: ScriptRunner;
};

export const handleScriptRunFlow = async ({
  project,
  context,
  script,
  scriptArgs,
  cliOptions,
  runner,
}: HandleScriptRunFlowOptions): Promise<void> => {
  const outputStyle = cliOptions.outputStyle
    ? validateOutputStyle(cliOptions.outputStyle)
    : getDefaultOutputStyle(
        project.config.project.defaults.cliScriptOutputStyle,
      );

  logger.debug(`Effective output style: ${outputStyle}`);

  const scriptEventTarget = createScriptEventTarget();

  const inline = cliOptions.inline
    ? cliOptions.inlineName || cliOptions.shell
      ? {
          scriptName: cliOptions.inlineName,
          shell: cliOptions.shell as ScriptShellOption,
        }
      : true
    : undefined;

  const parallel =
    typeof cliOptions.parallel === "boolean" ||
    typeof cliOptions.parallel === "undefined"
      ? undefined
      : cliOptions.parallel === "true"
        ? true
        : cliOptions.parallel === "false"
          ? false
          : { max: cliOptions.parallel as ParallelMaxValue };

  let maxOutputBufferBytes: number | undefined;
  if (cliOptions.maxOutputBuffer !== undefined) {
    try {
      maxOutputBufferBytes = parseOutputBufferBytes(cliOptions.maxOutputBuffer);
    } catch {
      logger.error(
        `Invalid --max-output-buffer value: ${cliOptions.maxOutputBuffer}. Expected a byte count, a size like "16MB", or "unbounded".`,
      );
      process.exit(1);
      return;
    }
  }

  const { output, summary, workspaces } = await runner({
    script: script as string,
    inline,
    args: scriptArgs,
    dependencyOrder: cliOptions.depOrder,
    ignoreDependencyFailure: cliOptions.ignoreDepFailure,
    ignoreOutput: outputStyle === "none",
    maxOutputBufferBytes,
    onScriptEvent: (event, { workspace, exitResult }) => {
      setTimeout(() =>
        // place at end of call stack so listeners in render func receive event
        scriptEventTarget.dispatchEvent(
          createScriptEvent[event]({
            workspace,
            exitResult,
          }),
        ),
      );
    },
    parallel,
  });

  const scriptName = cliOptions.inline
    ? cliOptions.inlineName || "(inline)"
    : script;

  logger.debug(`Script name: ${scriptName}`);

  const stripDisruptiveControls =
    workspaces.length > 1 || !!cliOptions.parallel;

  logger.debug(`Strip disruptive controls: ${stripDisruptiveControls}`);

  let groupedLines: number | "all" | "auto" = "auto";
  if (cliOptions.groupedLines) {
    if (cliOptions.groupedLines === "all") {
      groupedLines = "all";
    } else if (cliOptions.groupedLines === "auto") {
      groupedLines = "auto";
    } else {
      const parsedGroupedLines = parseInt(cliOptions.groupedLines as string);

      if (parsedGroupedLines <= 0 || isNaN(parsedGroupedLines)) {
        logger.error(
          `Invalid max grouped lines value: ${cliOptions.groupedLines}. Must be a positive number or "all".`,
        );
        process.exit(1);
        return;
      }

      groupedLines = parsedGroupedLines;
    }
  }

  logger.debug(`Effective grouped lines: ${JSON.stringify(groupedLines)}`);

  if (!cliOptions.prefix) {
    logger.warn(
      "--no-prefix is deprecated and will be removed in a future version. Use --output-style=plain instead.",
    );
    if (!cliOptions.outputStyle) {
      cliOptions.outputStyle = "plain";
    }
  }

  const outputStyleHandlers: Record<OutputStyleName, () => Promise<void>> = {
    grouped: () =>
      renderGroupedOutput(
        workspaces,
        output,
        summary,
        scriptEventTarget,
        groupedLines,
        context.outputWriters,
        context.terminalWidth,
        context.terminalHeight,
      ),
    prefixed: () =>
      renderPlainOutput(output, context.outputWriters, {
        prefix: true,
        stripDisruptiveControls,
      }),
    plain: () =>
      renderPlainOutput(output, context.outputWriters, {
        prefix: false,
        stripDisruptiveControls,
      }),
    none: async () => {
      // no-op
    },
  };

  await outputStyleHandlers[outputStyle]();

  const exitResults = await summary;

  exitResults.scriptResults.forEach(
    ({ success, metadata: { workspace }, exitCode }) => {
      const isSkipped = exitCode === -1;
      const safeWorkspaceName = stripANSI(workspace.name);
      const safeScriptName = stripANSI(scriptName ?? "");
      if (isSkipped) {
        logger.info(
          `➖ ${safeWorkspaceName}: ${safeScriptName} (skipped due to dependency failure)`,
        );
      } else {
        logger.info(
          `${success ? "✅" : "❌"} ${safeWorkspaceName}: ${safeScriptName}${exitCode ? ` (exited with code ${exitCode})` : ""}`,
        );
      }
    },
  );

  const s = exitResults.scriptResults.length === 1 ? "" : "s";
  const skippedCount = exitResults.scriptResults.filter(
    ({ exitCode }) => exitCode === -1,
  ).length;
  const skippedMessage = skippedCount ? ` (${skippedCount} skipped)` : "";
  if (exitResults.failureCount) {
    const message = `${exitResults.failureCount} of ${exitResults.scriptResults.length} script${s} failed${skippedMessage}`;
    logger.info(message);
  } else {
    logger.info(
      `${exitResults.scriptResults.length} script${s} ran successfully${skippedMessage}`,
    );
  }

  if (cliOptions.jsonOutfile) {
    const fullOutputPath = path.resolve(
      project.rootDirectory,
      expandHomePath(cliOptions.jsonOutfile),
    );

    // Check if can make directory
    const jsonOutputDir = path.dirname(fullOutputPath);
    if (!fs.existsSync(jsonOutputDir)) {
      try {
        logger.debug(`Creating JSON output file directory "${jsonOutputDir}"`);
        fs.mkdirSync(jsonOutputDir, { recursive: true });
      } catch (error) {
        logger.error(
          `Failed to create JSON output file directory "${jsonOutputDir}": ${error}`,
        );
        process.exit(1);
        return;
      }
    } else if (fs.statSync(jsonOutputDir).isFile()) {
      logger.error(
        `Given JSON output file directory "${jsonOutputDir}" is an existing file`,
      );
      process.exit(1);
      return;
    }

    // Check if can make file
    if (
      fs.existsSync(fullOutputPath) &&
      fs.statSync(fullOutputPath).isDirectory()
    ) {
      logger.error(
        `Given JSON output file path "${fullOutputPath}" is an existing directory`,
      );
      process.exit(1);
      return;
    }

    try {
      logger.debug(`Writing JSON output file "${fullOutputPath}"`);
      fs.writeFileSync(fullOutputPath, JSON.stringify(exitResults, null, 2));
    } catch (error) {
      logger.error(
        `Failed to write JSON output file "${fullOutputPath}": ${error}`,
      );
      process.exit(1);
      return;
    }
    logger.info(`JSON output written to ${fullOutputPath}`);
  }

  if (exitResults.failureCount) {
    process.exit(1);
    return;
  }
};
