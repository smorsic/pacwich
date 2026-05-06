import {
  getCliCommandConfig,
  type CliCommandName,
  type CliGlobalCommandName,
  type CliProjectCommandName,
} from "bw-common/cli";
import { Option, type Command } from "../../internal/bundledDeps/commander";
import { BunWorkspacesError } from "../../internal/core/error";
import { createLogger, logger } from "../../internal/logger";
import type { FileSystemProject } from "../../project/implementations/fileSystemProject";
import type { Workspace } from "../../workspaces";
import type { WriteOutputOptions } from "../createCli";
import type { CliMiddleware, CommandMiddlewareContext } from "../middleware";

/** @todo DRY use of output text in cases such as having no workspaces/scripts */

export type GlobalCommandContext = {
  program: Command;
  postTerminatorArgs: string[];
  middleware: CliMiddleware;
  outputWriters: Required<WriteOutputOptions>;
  terminalWidth: number;
  terminalHeight: number;
  workingDirectory: string;
};

export type ProjectCommandContext = GlobalCommandContext & {
  project: FileSystemProject;
  projectError: Error | null;
};

/**
 * Splits a multi-value CLI arg on whitespace (any of space/tab/newline). A
 * literal space inside a value can be preserved by escaping it with a
 * backslash (e.g. `path/with\ space`). Used for `--files` and
 * `--workspace-patterns`, both of which accept output of `$(bw ...)`
 * substitutions, which are typically newline-separated.
 */
export const splitWhitespaceArg = (raw: string) =>
  raw
    .split(/(?<!\\)\s+/)
    .filter(Boolean)
    .map((value) => value.replace(/\\\s/g, " "));

export const createWorkspaceInfoLines = (workspace: Workspace) => [
  `Workspace: ${workspace.name}${workspace.isRoot ? " (root)" : ""}`,
  ` - Aliases: ${workspace.aliases.join(", ")}`,
  ` - Path: ${workspace.path}`,
  ` - Glob Match: ${workspace.matchPattern}`,
  ` - Scripts: ${workspace.scripts.join(", ")}`,
  ` - Tags: ${workspace.tags.join(", ")}`,
  ` - Dependencies: ${workspace.dependencies.join(", ")}`,
  ` - Dependents: ${workspace.dependents.join(", ")}`,
];

export const createScriptInfoLines = (
  script: string,
  workspaces: Workspace[],
) => [
  `Script: ${script}`,
  ...workspaces.map((workspace) => ` - ${workspace.name}`),
];

export const createJsonLines = (data: unknown, options: { pretty: boolean }) =>
  JSON.stringify(data, null, options.pretty ? 2 : undefined).split("\n");

export const commandOutputLogger = createLogger("");
commandOutputLogger.printLevel = "info";

const handleCommand =
  <HandlerContext extends GlobalCommandContext, ActionArgs extends unknown[]>(
    commandName: CliCommandName,
    handler: (context: HandlerContext, ...actionArgs: ActionArgs) => void,
  ) =>
  (context: HandlerContext) => {
    const config = getCliCommandConfig(commandName);
    let { program } = context;

    program = program
      .command(config.command)
      .aliases(config.aliases)
      .description(config.description);

    for (const { flags, description, values } of Object.values(
      config.options,
    )) {
      const option = new Option(flags.join(", "), description);
      if (values?.length) {
        option.choices(values);
      }
      program.addOption(option);
    }

    program = program.action(async (...actionArgs) => {
      try {
        logger.debug(`Handling command: ${commandName}`);

        const middlewareContext: CommandMiddlewareContext<CliCommandName> = {
          commanderProgram: program,
          commandName,
          commandContext: context,
          commanderActionArgs: actionArgs,
        };

        program = context.middleware.preHandleCommand(middlewareContext);

        await handler(context, ...(actionArgs as ActionArgs));

        program = context.middleware.postHandleCommand(middlewareContext);
      } catch (error) {
        context.middleware.catchError(error as Error);
        if (error instanceof BunWorkspacesError) {
          logger.error(error.message);
          process.exit(1);
        }
        throw error;
      }
    });

    return program;
  };

export const handleGlobalCommand =
  <ActionArgs extends unknown[]>(
    commandName: CliGlobalCommandName,
    handler: (context: GlobalCommandContext, ...actionArgs: ActionArgs) => void,
  ) =>
  (context: GlobalCommandContext) =>
    handleCommand(commandName, handler)(context);

export const handleProjectCommand =
  <ActionArgs extends unknown[]>(
    commandName: CliProjectCommandName,
    handler: (
      context: Omit<ProjectCommandContext, "projectError">,
      ...actionArgs: ActionArgs
    ) => void,
  ) =>
  (context: ProjectCommandContext) =>
    handleCommand<ProjectCommandContext, ActionArgs>(
      commandName,
      async (context, ...actionArgs) => {
        const { projectError } = context;
        if (projectError) {
          context.middleware.catchError(projectError);
          logger.error(projectError.message);
          process.exit(1);
          return;
        }
        await handler(context, ...actionArgs);
      },
    )(context);
