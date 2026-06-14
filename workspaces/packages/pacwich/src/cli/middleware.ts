import type { CliCommandName, CliGlobalCommandName } from "@pacwich/common/cli";
import type { Command as CommanderProgram } from "../internal/bundledDeps/commander";
import { defineErrors } from "../internal/core";
import { logger } from "../internal/logger";
import type { FileSystemProject } from "../project";
import type {
  GlobalCommandContext,
  ProjectCommandContext,
} from "./commands/commandHandlerUtils";

export type InitProgramContext = {
  commanderProgram: CommanderProgram;
  argv: string[];
};

export type ProcessArgvContext = {
  commanderProgram: CommanderProgram;
  args: string[];
  postTerminatorArgs: string[];
};

export type ProcessWorkingDirectoryContext = {
  commanderProgram: CommanderProgram;
  workingDirectory: string;
  exists: boolean;
  isDirectory: boolean;
};

export type FindProjectContext = {
  commanderProgram: CommanderProgram;
  project: FileSystemProject;
  projectError: Error | null;
};

export type PreParseContext = {
  commanderProgram: CommanderProgram;
  args: string[];
  project: FileSystemProject;
  projectError: Error | null;
};

export type PostParseContext = {
  commanderProgram: CommanderProgram;
  args: string[];
  project: FileSystemProject;
  projectError: Error | null;
};

export type CommandMiddlewareContext<C extends CliCommandName> = {
  commanderProgram: CommanderProgram;
  commandName: C;
  commandContext: C extends CliGlobalCommandName
    ? GlobalCommandContext
    : ProjectCommandContext;
  commanderActionArgs: unknown[];
};

export type CommandMiddleware = <C extends CliCommandName>(
  context: CommandMiddlewareContext<C>,
) => CommanderProgram;

export type CliMiddleware = {
  /** The first callback when the Commander program is created */
  initProgram: (context: InitProgramContext) => CommanderProgram;
  /** Before the true parsing, just splitting the argv into args and post-terminator args */
  processArgv: (context: ProcessArgvContext) => CommanderProgram;
  /** Before the working directory is changed */
  processWorkingDirectory: (
    context: ProcessWorkingDirectoryContext,
  ) => CommanderProgram;
  /** After the project has been initialized from global options */
  findProject: (context: FindProjectContext) => CommanderProgram;
  /** Before the Commander program parses the args */
  preParse: (context: PreParseContext) => CommanderProgram;
  /** After the Commander program has parsed the args (runs in finally block) */
  postParse: (context: PostParseContext) => CommanderProgram;
  /** Before a command is handled */
  preHandleCommand: CommandMiddleware;
  /** After a command is handled */
  postHandleCommand: CommandMiddleware;
  /** After the program has been parsed */
  catchError: (error: Error) => unknown;
};

export type CliMiddlewareOptions = Partial<CliMiddleware>;

const MIDDLEWARE_ERRORS = defineErrors("MiddlewareHandlerFailed");

export const resolveMiddleware = (
  defaultMiddleware: CliMiddlewareOptions,
  runMiddleware: CliMiddlewareOptions,
) =>
  Object.keys({
    catchError: null,
    initProgram: null,
    processArgv: null,
    processWorkingDirectory: null,
    findProject: null,
    preParse: null,
    postParse: null,
    preHandleCommand: null,
    postHandleCommand: null,
  } satisfies Record<keyof CliMiddleware, null>).reduce<CliMiddleware>(
    (acc, _key) => {
      const key = _key as keyof CliMiddleware;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      acc[key as keyof CliMiddleware] = (ctx: any) => {
        try {
          let result = defaultMiddleware?.[key]?.(ctx);
          result = runMiddleware?.[key]?.(ctx);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return result as any;
        } catch (error) {
          logger.error(
            new MIDDLEWARE_ERRORS.MiddlewareHandlerFailed(
              `Error in middleware handler "${key}"`,
            ),
          );
          throw error;
        }
      };
      return acc;
    },
    {} as CliMiddleware,
  );
