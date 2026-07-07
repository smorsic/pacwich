import { logger } from "../../../internal/logger";
import type { DetermineAffectedWorkspacesOptions } from "../../../project";
import {
  handleProjectCommand,
  splitWhitespaceArg,
} from "../commandHandlerUtils";
import {
  handleScriptRunFlow,
  type SharedRunScriptCliOptions,
} from "./scriptRunFlow";

export const runAffected = handleProjectCommand(
  "runAffected",
  async (
    {
      project,
      postTerminatorArgs,
      outputWriters,
      terminalWidth,
      terminalHeight,
    },
    positionalScript: string | undefined,
    options: SharedRunScriptCliOptions & {
      script: string | undefined;
      base: string | undefined;
      head: string | undefined;
      files: string | undefined;
      ignoreUntracked: boolean;
      ignoreUnstaged: boolean;
      ignoreStaged: boolean;
      ignoreUncommitted: boolean;
      ignoreWorkspaceDeps: boolean;
      ignoreExternalDeps: boolean;
    },
  ) => {
    options.inlineName = options.inlineName?.trim();
    options.args = options.args?.trim();
    options.jsonOutfile = options.jsonOutfile?.trim();
    options.maxOutputBuffer = options.maxOutputBuffer?.trim();
    options.parallel =
      typeof options.parallel === "string"
        ? options.parallel.trim()
        : options.parallel;

    if (positionalScript && options.script) {
      logger.error(
        "CLI syntax error: Cannot use both inline script positional and --script|-S option",
      );
      process.exit(1);
      return;
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

    if (options.files !== undefined && (options.base || options.head)) {
      logger.error(
        "CLI syntax error: --files cannot be used with --base or --head",
      );
      process.exit(1);
      return;
    }

    const affectedOptions: DetermineAffectedWorkspacesOptions<false> =
      options.files !== undefined
        ? {
            diffSource: "fileList",
            changedFiles: splitWhitespaceArg(options.files),
            ignoreWorkspaceDependencies:
              options.ignoreWorkspaceDeps || undefined,
            ignoreExternalDependencies: options.ignoreExternalDeps || undefined,
          }
        : {
            diffSource: "git",
            ignoreWorkspaceDependencies:
              options.ignoreWorkspaceDeps || undefined,
            ignoreExternalDependencies: options.ignoreExternalDeps || undefined,
            diffOptions: {
              baseRef: options.base,
              headRef: options.head,
              ignoreUntracked: options.ignoreUntracked || undefined,
              ignoreUnstaged: options.ignoreUnstaged || undefined,
              ignoreStaged: options.ignoreStaged || undefined,
              ignoreUncommitted: options.ignoreUncommitted || undefined,
            },
          };

    logger.debug(
      `Command: Run ${options.inline ? "inline " : ""}script ${JSON.stringify(script)} across affected workspaces (${affectedOptions.diffSource})`,
    );
    logger.debug(`Options: ${JSON.stringify(options)}`);

    await handleScriptRunFlow({
      project,
      context: { outputWriters, terminalWidth, terminalHeight },
      script,
      scriptArgs,
      cliOptions: options,
      runner: (scriptOptions) =>
        project.runAffectedWorkspaceScript({
          affectedOptions,
          scriptOptions,
        }),
    });
  },
);
