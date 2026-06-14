import { logger } from "../../../internal/logger";
import {
  handleProjectCommand,
  splitWhitespaceArg,
} from "../commandHandlerUtils";
import {
  handleScriptRunFlow,
  type SharedRunScriptCliOptions,
} from "./scriptRunFlow";

export const runScript = handleProjectCommand(
  "runScript",
  async (
    {
      project,
      postTerminatorArgs,
      outputWriters,
      terminalWidth,
      terminalHeight,
    },
    positionalScript: string,
    positionalWorkspacePatterns: string[],
    options: SharedRunScriptCliOptions & {
      script: string | undefined;
      workspacePatterns: string | undefined;
    },
  ) => {
    options.inlineName = options.inlineName?.trim();
    options.args = options.args?.trim();
    options.jsonOutfile = options.jsonOutfile?.trim();
    options.parallel =
      typeof options.parallel === "string"
        ? options.parallel.trim()
        : options.parallel;

    if (positionalScript && options.script) {
      // If script is provided via options, then the first positional argument is actually a workspace pattern
      positionalWorkspacePatterns.splice(0, 0, positionalScript);
    }

    const script = options.script || positionalScript;

    if (postTerminatorArgs.length && options.args) {
      logger.error(
        "CLI syntax error: Cannot use both --args and inline script args after --",
      );
      process.exit(1);
      return;
    }

    const scriptArgs = postTerminatorArgs.length
      ? postTerminatorArgs
      : options.args;

    if (positionalWorkspacePatterns.length && options.workspacePatterns) {
      logger.error(
        "CLI syntax error: Cannot use both inline workspace patterns and --workspace-patterns|-W option",
      );
      process.exit(1);
      return;
    }

    const workspacePatterns = positionalWorkspacePatterns?.length
      ? positionalWorkspacePatterns
      : splitWhitespaceArg(options.workspacePatterns ?? "");

    logger.debug(
      `Command: Run ${options.inline ? "inline " : ""}script ${JSON.stringify(script)} for ${
        workspacePatterns.length
          ? "workspaces " + workspacePatterns.join(", ")
          : "all workspaces"
      }`,
    );
    logger.debug(`Options: ${JSON.stringify(options)}`);

    await handleScriptRunFlow({
      project,
      context: { outputWriters, terminalWidth, terminalHeight },
      script,
      scriptArgs,
      cliOptions: options,
      runner: (scriptOptions) =>
        project.runScriptAcrossWorkspaces({
          ...scriptOptions,
          workspacePatterns: workspacePatterns.length
            ? workspacePatterns
            : undefined,
        }),
    });
  },
);
