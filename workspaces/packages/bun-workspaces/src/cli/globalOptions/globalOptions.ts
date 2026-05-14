import fs from "fs";
import path from "path";
import {
  type CliGlobalOptionName,
  type CliGlobalOptions,
  getCliGlobalOptionConfig,
} from "bw-common/cli";
import { type Command } from "../../internal/bundledDeps/commander";
import { Option } from "../../internal/bundledDeps/commander";
import { defineErrors, expandHomePath } from "../../internal/core";
import { logger } from "../../internal/logger";
import {
  createFileSystemProject,
  createMemoryProject,
  type FileSystemProject,
} from "../../project";
import type { CliMiddleware } from "../middleware";

const ERRORS = defineErrors(
  "WorkingDirectoryNotFound",
  "WorkingDirectoryNotADirectory",
  "NoCwdAndWorkspaceRoot",
  "ProjectRootNotFound",
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

const getWorkingDirectoryFromArgs = (program: Command, args: string[]) => {
  addGlobalOption(program, "cwd");
  addGlobalOption(program, "workspaceRoot");
  program.parseOptions(args);

  const { cwd, workspaceRoot } = program.opts();

  if (cwd && workspaceRoot) {
    throw new ERRORS.NoCwdAndWorkspaceRoot(
      `Cannot use both ${
        getCliGlobalOptionConfig("cwd").mainOption
      } (${getCliGlobalOptionConfig("cwd").shortOption}) and ${
        getCliGlobalOptionConfig("workspaceRoot").mainOption
      } (${getCliGlobalOptionConfig("workspaceRoot").shortOption}) options together`,
    );
  }

  return { cwdOption: cwd, workspaceRootOption: workspaceRoot };
};

const findRootFromCwd = () => {
  let currentDirectory = process.cwd();
  while (true) {
    const packageJsonPath = path.join(currentDirectory, "package.json");
    if (fs.existsSync(packageJsonPath)) {
      try {
        const packageJsonContent = JSON.parse(
          fs.readFileSync(packageJsonPath, "utf8"),
        );
        if (packageJsonContent.workspaces) {
          return currentDirectory;
        }
      } catch {
        continue;
      }
    }
    const parentDirectory = path.dirname(currentDirectory);
    if (parentDirectory === currentDirectory) {
      break;
    }
    currentDirectory = parentDirectory;
  }

  throw new ERRORS.ProjectRootNotFound(
    `${getCliGlobalOptionConfig("workspaceRoot").shortOption}|${
      getCliGlobalOptionConfig("workspaceRoot").mainOption
    } option: Project root not found from current working directory "${process.cwd()}"`,
  );
};

const defineGlobalOptions = (
  program: Command,
  args: string[],
  middleware: CliMiddleware,
) => {
  const { cwdOption, workspaceRootOption } = getWorkingDirectoryFromArgs(
    program,
    args,
  );

  const cwd = expandHomePath(
    cwdOption || (workspaceRootOption ? findRootFromCwd() : process.cwd()),
  );

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

  return { cwd };
};

const applyGlobalOptions = (options: CliGlobalOptions) => {
  logger.printLevel = options.logLevel;
  logger.debug("Log level: " + options.logLevel);

  let project: FileSystemProject;
  let error: Error | null = null;
  try {
    project = createFileSystemProject({
      rootDirectory: options.cwd,
      includeRootWorkspace: options.includeRoot,
      disableExecutableConfigs: options.disableExecutableConfigs,
    });

    logger.debug(
      `Project: ${JSON.stringify(project.name)} (${
        project.workspaces.length
      } workspace${project.workspaces.length === 1 ? "" : "s"})`,
    );
    logger.debug("Project root: " + path.resolve(project.rootDirectory));
  } catch (_error) {
    error = _error as Error;
    project = createMemoryProject({
      workspaces: [],
    }) as unknown as FileSystemProject;
  }

  return {
    project,
    projectError: error,
    workingDirectory: options.cwd,
    disableExecutableConfigs: options.disableExecutableConfigs,
  };
};

export const initializeWithGlobalOptions = (
  program: Command,
  args: string[],
  middleware: CliMiddleware,
) => {
  program.allowUnknownOption(true);

  const { cwd } = defineGlobalOptions(program, args, middleware);

  program.parseOptions(args);
  program.allowUnknownOption(false);

  const options = program.opts() as CliGlobalOptions;

  return applyGlobalOptions({
    ...options,
    cwd,
  });
};
