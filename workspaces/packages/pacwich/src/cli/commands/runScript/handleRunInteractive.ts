import type { ScriptShellOption } from "@pacwich/common/parameters";
import { logger } from "../../../internal/logger";
import { handleProjectCommand } from "../commandHandlerUtils";

export const runInteractive = handleProjectCommand(
  "runInteractive",
  async (
    { project, postTerminatorArgs },
    positionalScript: string | undefined,
    options: {
      workspace: string | undefined;
      script: string | undefined;
      args: string | undefined;
      inline: boolean;
      inlineName: string | undefined;
      shell: string | undefined;
    },
  ) => {
    options.args = options.args?.trim();
    options.inlineName = options.inlineName?.trim();
    options.workspace = options.workspace?.trim();

    if (positionalScript && options.script) {
      logger.error(
        "CLI syntax error: Cannot use both inline script positional and --script|-S option",
      );
      process.exit(1);
      return;
    }

    const script = options.script || positionalScript;

    if (!script) {
      logger.error(
        "CLI syntax error: A script is required (positional argument or --script|-S option)",
      );
      process.exit(1);
      return;
    }

    if (!options.workspace) {
      logger.error(
        "CLI syntax error: A workspace is required via --workspace|-W",
      );
      process.exit(1);
      return;
    }

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

    const inline = options.inline
      ? options.inlineName || options.shell
        ? {
            scriptName: options.inlineName,
            shell: options.shell as ScriptShellOption,
          }
        : true
      : undefined;

    logger.debug(
      `Command: Run ${options.inline ? "inline " : ""}script ${JSON.stringify(script)} interactively in workspace ${JSON.stringify(options.workspace)}`,
    );

    const { exit } = project.runWorkspaceScript({
      workspaceNameOrAlias: options.workspace,
      script,
      interactive: true,
      inline,
      args: scriptArgs,
    });

    const { exitCode } = await exit;

    // Faithful passthrough: surface the script's own exit code as pacwich's.
    if (exitCode) {
      process.exit(exitCode);
    }
  },
);
