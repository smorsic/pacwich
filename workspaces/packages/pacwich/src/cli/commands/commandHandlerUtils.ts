import {
  getCliCommandConfig,
  type CliCommandConfig,
  type CliCommandName,
  type CliGlobalCommandName,
  type CliProjectCommandName,
} from "@pacwich/common/cli";
import { Option, type Command } from "../../internal/bundledDeps/commander";
import { stripANSI } from "../../internal/core";
import { PacwichError } from "../../internal/core/error";
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
  /**
   * Value of the global `--disable-executable-configs` flag.
   * `undefined` means the flag was not passed.
   */
  disableExecutableConfigs: boolean | undefined;
};

export type ProjectCommandContext = GlobalCommandContext & {
  project: FileSystemProject;
  projectError: Error | null;
};

/**
 * Splits a multi-value CLI arg on whitespace (any of space/tab/newline). A
 * literal space inside a value can be preserved by escaping it with a
 * backslash (e.g. `path/with\ space`). Used for `--files` and
 * `--workspace-patterns`, both of which accept output of `$(pacwich ...)`
 * substitutions, which are typically newline-separated.
 */
export const splitWhitespaceArg = (raw: string) =>
  raw
    .split(/(?<!\\)\s+/)
    .filter(Boolean)
    .map((value) => value.replace(/\\\s/g, " "));

export const createWorkspaceInfoLines = (workspace: Workspace) => [
  `Workspace: ${stripANSI(workspace.name)}${workspace.isRoot ? " (root)" : ""}`,
  ` - Aliases: ${workspace.aliases.map(stripANSI).join(", ")}`,
  ` - Path: ${stripANSI(workspace.path)}`,
  ` - Glob Match: ${stripANSI(workspace.matchPattern)}`,
  ` - Scripts: ${workspace.scripts.map(stripANSI).join(", ")}`,
  ` - Tags: ${workspace.tags.map(stripANSI).join(", ")}`,
  ` - Dependencies: ${workspace.dependencies.map(stripANSI).join(", ")}`,
  ` - Dependents: ${workspace.dependents.map(stripANSI).join(", ")}`,
];

export const createScriptInfoLines = (
  script: string,
  workspaces: Workspace[],
) => [
  `Script: ${stripANSI(script)}`,
  ...workspaces.map((workspace) => ` - ${stripANSI(workspace.name)}`),
];

/**
 * Config files can define factory functions (e.g. `workspacePatternConfigs`
 * entries) that survive unevaluated into `ResolvedProjectConfig`.
 * `JSON.stringify` otherwise drops function-valued properties silently,
 * which would make a config entry vanish from debug output with no trace.
 */
const jsonFunctionReplacer = (_key: string, value: unknown) =>
  typeof value === "function"
    ? { __function: true, name: (value as { name?: string }).name || null }
    : value;

export const createJsonLines = (data: unknown, options: { pretty: boolean }) =>
  JSON.stringify(
    data,
    jsonFunctionReplacer,
    options.pretty ? 2 : undefined,
  ).split("\n");

export const commandOutputLogger = createLogger("");
commandOutputLogger.printLevel = "info";

const commandWord = (command: string) => command.trim().split(/\s+/)[0];

/**
 * Resolve which Commander node a command config attaches to: the root
 * program for a top-level entry, or the already-registered parent command
 * for a child (see {@link CliCommandConfig.parent}). Parents must be
 * registered before their children (see `commands.ts`).
 */
const resolveAttachPoint = (
  rootProgram: Command,
  config: CliCommandConfig,
): Command => {
  if (!config.parent) return rootProgram;
  // AssertNoInvalidParents guarantees parent is valid.
  const parentConfig = getCliCommandConfig(config.parent as CliCommandName);
  const parentWord = commandWord(parentConfig.command);
  const parentCommand = rootProgram.commands.find(
    (cmd) => cmd.name() === parentWord,
  );
  if (!parentCommand) {
    throw new Error(
      `"${config.parent}" must be registered before its child command`,
    );
  }
  return parentCommand;
};

const handleCommand =
  <HandlerContext extends GlobalCommandContext, ActionArgs extends unknown[]>(
    commandName: CliCommandName,
    handler: (context: HandlerContext, ...actionArgs: ActionArgs) => void,
  ) =>
  (context: HandlerContext) => {
    const config = getCliCommandConfig(commandName);

    let program = resolveAttachPoint(context.program, config)
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
        if (error instanceof PacwichError) {
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
