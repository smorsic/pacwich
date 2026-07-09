import fs from "fs";
import path from "path";
import {
  type CliGlobalOptionName,
  type CliGlobalOptions,
  getCliGlobalOptionConfig,
  isGlobalCliCommandToken,
} from "@pacwich/common/cli";
import type { WarningId } from "@pacwich/common/warnings";
import { type Command } from "../../internal/bundledDeps/commander";
import { Option } from "../../internal/bundledDeps/commander";
import {
  defineErrors,
  expandHomePath,
  splitCsvList,
} from "../../internal/core";
import {
  logger,
  resolveEnvLogLevel,
  setSuppressWarnings,
} from "../../internal/logger";
import {
  createFileSystemProject,
  createMemoryProject,
  type FileSystemProject,
} from "../../project";
import type { CliMiddleware } from "../middleware";

const ERRORS = defineErrors(
  "WorkingDirectoryNotFound",
  "WorkingDirectoryNotADirectory",
);

const addGlobalOption = (
  program: Command,
  optionName: CliGlobalOptionName,
  defaultOverride?: string,
) => {
  const { mainOption, shortOption, description, param, values, defaultValue } =
    getCliGlobalOptionConfig(optionName);

  const flagsString = `${shortOption ? `${shortOption} ` : ""}${mainOption}${
    param ? ` <${param}>` : ""
  }`;
  let option = new Option(flagsString, description);

  const effectiveDefaultValue = defaultOverride ?? defaultValue;
  if (effectiveDefaultValue) {
    option = option.default(effectiveDefaultValue);
  }

  if (values?.length) {
    option = option.choices(values as string[]);
  }

  program.addOption(option);

  if (!param) {
    program.option(
      mainOption.replace(/^--/, "--no-"),
      `Set ${mainOption} as false`,
    );
  }
};

const getCwdOptionFromArgs = (program: Command, args: string[]) => {
  addGlobalOption(program, "cwd");
  program.parseOptions(args);
  return program.opts().cwd as string;
};

const defineGlobalOptions = (
  program: Command,
  args: string[],
  middleware: CliMiddleware,
) => {
  const cwdOption = getCwdOptionFromArgs(program, args);

  // Walk-up to the actual project root is owned by createFileSystemProject.
  // Here we just resolve the user-supplied cwd (or process.cwd()) for
  // existence/isDirectory validation, then hand it to the project layer.
  const cwd = expandHomePath(cwdOption || process.cwd());

  const exists = fs.existsSync(cwd);
  const isDirectory = exists ? fs.statSync(cwd).isDirectory() : false;

  middleware.processWorkingDirectory({
    commanderProgram: program,
    workingDirectory: cwd,
    exists,
    isDirectory,
  });

  if (!exists) {
    throw new ERRORS.WorkingDirectoryNotFound(
      `Working directory not found at path "${cwd}"`,
    );
  }
  if (!isDirectory) {
    throw new ERRORS.WorkingDirectoryNotADirectory(
      `Working directory is not a directory at path "${cwd}"`,
    );
  }

  addGlobalOption(program, "logLevel");
  addGlobalOption(program, "includeRoot");
  addGlobalOption(program, "disableExecutableConfigs");
  addGlobalOption(program, "pm");
  addGlobalOption(program, "suppressWarnings");

  return { cwd };
};

// Placeholder used when no real project is loaded (a global command was
// invoked, or project assembly failed)
const createPlaceholderProject = () =>
  createMemoryProject({
    workspaces: [],
    packageManager: "bun",
  }) as unknown as FileSystemProject;

type ApplyGlobalOptionsOptions = {
  /**
   * Skip loading the file-system project. Set for global commands.
   */
  skipProjectLoad: boolean;
  /**
   * Whether --log-level was explicitly passed (vs. Commander's default).
   * When false, the PACWICH_LOG_LEVEL env var default stands.
   */
  logLevelExplicit: boolean;
};

const applyGlobalOptions = (
  options: CliGlobalOptions,
  { skipProjectLoad, logLevelExplicit }: ApplyGlobalOptionsOptions,
) => {
  // An explicit flag wins. Otherwise honor the PACWICH_LOG_LEVEL env var, and
  // fall back to Commander's static default ("info") when it is unset. Reading
  // the env var live also keeps repeated in-process invocations deterministic.
  logger.printLevel = logLevelExplicit
    ? options.logLevel
    : (resolveEnvLogLevel() ?? options.logLevel);
  logger.debug("Log level: " + logger.printLevel);

  // The --suppress-warnings flag. The PACWICH_SUPPRESS_WARNINGS env var is
  // honored by the logger directly, so nothing else is wired up here.
  setSuppressWarnings(
    splitCsvList(options.suppressWarnings ?? "") as WarningId[],
  );

  if (skipProjectLoad) {
    return {
      project: createPlaceholderProject(),
      projectError: null,
      workingDirectory: options.cwd,
      disableExecutableConfigs: options.disableExecutableConfigs,
    };
  }

  let project: FileSystemProject;
  let error: Error | null = null;
  try {
    project = createFileSystemProject({
      rootDirectory: options.cwd,
      includeRootWorkspace: options.includeRoot,
      disableExecutableConfigs: options.disableExecutableConfigs,
      packageManager: options.pm,
    });

    logger.debug(
      `Project: ${JSON.stringify(project.name)} (${
        project.workspaces.length
      } workspace${project.workspaces.length === 1 ? "" : "s"})`,
    );
    logger.debug("Project root: " + path.resolve(project.rootDirectory));
  } catch (_error) {
    error = _error as Error;
    project = createPlaceholderProject();
  }

  return {
    project,
    projectError: error,
    workingDirectory: options.cwd,
    disableExecutableConfigs: options.disableExecutableConfigs,
  };
};

export type InitializeWithGlobalOptionsOptions = {
  /**
   * Whether `args` came in already stripped of the leading Node
   * `execPath`/scriptPath prefix (mirrors Commander's `from: "user"`)
   */
  programmatic: boolean;
};

export const initializeWithGlobalOptions = (
  program: Command,
  args: string[],
  middleware: CliMiddleware,
  { programmatic }: InitializeWithGlobalOptionsOptions,
) => {
  program.allowUnknownOption(true);

  const { cwd } = defineGlobalOptions(program, args, middleware);

  // Get positional args
  const { operands } = program.parseOptions(args);

  program.allowUnknownOption(false);

  const commandToken = (programmatic ? operands : operands.slice(2))[0];

  const options = program.opts() as CliGlobalOptions;

  return applyGlobalOptions(
    {
      ...options,
      cwd,
    },
    {
      skipProjectLoad: isGlobalCliCommandToken(commandToken),
      logLevelExplicit: program.getOptionValueSource("logLevel") === "cli",
    },
  );
};
