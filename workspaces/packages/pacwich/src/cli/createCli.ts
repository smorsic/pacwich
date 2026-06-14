import packageJson from "../../package.json" with { type: "json" };
import { createCommand } from "../internal/bundledDeps/commander";
import { PacwichError } from "../internal/core";
import { logger } from "../internal/logger";
import {
  CLI_COMMANDS_CONFIG,
  defineGlobalCommands,
  defineProjectCommands,
} from "./commands";
import { commandOutputLogger } from "./commands/commandHandlerUtils";
import { fatalErrorLogger } from "./fatalErrorLogger";
import { initializeWithGlobalOptions } from "./globalOptions";
import {
  resolveMiddleware,
  type CliMiddleware,
  type CliMiddlewareOptions,
} from "./middleware";

/** Overrides for where the CLI writes output (defaults to the real `process` streams). */
export interface WriteOutputOptions {
  stdout?: (...args: Parameters<typeof process.stdout.write>) => void;
  stderr?: (...args: Parameters<typeof process.stderr.write>) => void;
}

/** Options for a single {@link CLI.run} invocation. */
export interface RunCliOptions {
  /** Args to parse. Defaults to `process.argv`. */
  argv?: string[];
  /** Should be `true` if args do not include the binary name (e.g. `bunx pacwich`) */
  programmatic?: true;
  middleware?: CliMiddlewareOptions;
  writeOutput?: WriteOutputOptions;
  /** Terminal dimensions to assume for help and output layout. Default to the real terminal's. */
  terminalWidth?: number;
  terminalHeight?: number;
}

/** A constructed pacwich CLI program. */
export interface CLI {
  /** Parse args and dispatch the matching command. */
  run: (options?: RunCliOptions) => Promise<void>;
}

/** Options for {@link createCli}. */
export interface CreateCliOptions {
  /** Working directory the CLI resolves the project from. Defaults to `process.cwd()`. */
  defaultCwd?: string;
  /** Always handled when the result `.run()` is called */
  defaultMiddleware?: CliMiddlewareOptions;
}

/**
 * Create the pacwich CLI program. The returned object's `run()` parses
 * argv and dispatches a command. The `pacwich` bin is a thin wrapper
 * around this, but it can also be embedded to drive the CLI
 * programmatically.
 *
 * @example
 * ```ts
 * import { createCli } from "pacwich/cli";
 *
 * await createCli().run(); // parses process.argv
 * ```
 */
export const createCli = ({
  defaultCwd = process.cwd(),
  defaultMiddleware,
}: CreateCliOptions = {}): CLI => {
  logger.debug(`Creating CLI with default cwd: ${defaultCwd}`);

  const run = async ({
    argv = process.argv,
    programmatic,
    middleware: _runMiddleware,
    writeOutput,
    terminalWidth = process.stdout.columns,
    terminalHeight = process.stdout.rows,
  }: RunCliOptions = {}) => {
    const middleware: CliMiddleware = resolveMiddleware(
      defaultMiddleware ?? {},
      _runMiddleware ?? {},
    );

    const outputWriters: Required<WriteOutputOptions> = {
      stdout: (...args) => process.stdout.write(...args),
      stderr: (...args) => process.stderr.write(...args),
      ...writeOutput,
    };

    logger.setPrintStdout(outputWriters.stdout);
    logger.setPrintStderr(outputWriters.stderr);
    commandOutputLogger.setPrintStdout(outputWriters.stdout);
    commandOutputLogger.setPrintStderr(outputWriters.stderr);

    const errorListener = (error: Error) => {
      middleware.catchError(error);
      fatalErrorLogger.error(error);
      process.exit(1);
    };

    process.on("unhandledRejection", errorListener);

    try {
      const program = createCommand("pacwich")
        .description(
          "Monorepo tooling that works on top of Bun, npm, or pnpm workspaces",
        )
        .version(packageJson.version)
        .showHelpAfterError(true)
        .configureOutput({
          writeOut: outputWriters.stdout,
          writeErr: outputWriters.stderr,
          ...(terminalWidth
            ? {
                getOutHelpWidth: () => terminalWidth,
                getErrHelpWidth: () => terminalWidth,
              }
            : {}),
        });

      const defaultContext = {
        commanderProgram: program,
      };

      middleware.initProgram({ ...defaultContext, argv });

      const terminatorIndex = argv.findIndex((arg) => arg === "--");
      let args = terminatorIndex !== -1 ? argv.slice(0, terminatorIndex) : argv;
      const postTerminatorArgs =
        terminatorIndex !== -1 ? argv.slice(terminatorIndex + 1) : [];

      middleware.processArgv({ ...defaultContext, args, postTerminatorArgs });

      const {
        project,
        projectError,
        workingDirectory,
        disableExecutableConfigs,
      } = initializeWithGlobalOptions(program, args, middleware);

      // Caught here, after global options (including --log-level) are
      // applied, so the deprecation warning honors the configured log level.
      // The flags are stripped before the command parse below, since they are
      // no longer recognized options.
      args = tempCatchDeprecatedFlags(args);

      middleware.findProject({ ...defaultContext, project, projectError });

      if (postTerminatorArgs.length) {
        logger.debug("Has post-terminator args");
      }

      logger.debug(
        `Runtime: ${typeof Bun === "undefined" ? `Node ${process.versions.node}` : `Bun ${Bun.version}`}`,
      );

      defineProjectCommands({
        program,
        project,
        projectError,
        postTerminatorArgs,
        middleware,
        outputWriters,
        terminalWidth,
        terminalHeight,
        workingDirectory,
        disableExecutableConfigs,
      });

      defineGlobalCommands({
        program,
        postTerminatorArgs,
        middleware,
        outputWriters,
        terminalWidth,
        terminalHeight,
        workingDirectory,
        disableExecutableConfigs,
      });

      logger.debug(`Commands initialized. Parsing args...`);

      middleware.preParse({ ...defaultContext, args, project, projectError });

      await program.parseAsync(args, {
        from: programmatic ? "user" : "node",
      });

      middleware.postParse({ ...defaultContext, args, project, projectError });
    } catch (error) {
      if (error instanceof PacwichError) {
        logger.debug(error);
        fatalErrorLogger.error(error.message);
        process.exit(1);
      } else {
        errorListener(error as Error);
      }
    } finally {
      process.off("unhandledRejection", errorListener);
    }
  };

  return {
    run,
  };
};

/**
 * @deprecated
 */
const tempCatchDeprecatedFlags = (args: string[]) => {
  args.forEach((arg, index) => {
    if (
      (arg === "-w" || arg === "--workspace-root") &&
      !args.slice(0, index).find((prevArg) =>
        Object.values(CLI_COMMANDS_CONFIG)
          .map((config) => config.command.split(/\s+/)[0])
          .includes(prevArg),
      )
    ) {
      logger.warn(
        `The ${arg} flag from bun-workspaces is deprecated and will be removed in a future version. This is now pacwich's default behavior.`,
      );
      args.splice(index, 1);
    }
  });
  return args;
};
