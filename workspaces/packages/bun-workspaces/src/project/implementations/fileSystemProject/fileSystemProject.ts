import fs from "fs";
import path from "path";
import type { ScriptShellOption, ShellOption } from "bw-common/parameters";
import { ROOT_WORKSPACE_SELECTOR } from "bw-common/project";
import type { WorkspaceScriptMetadata } from "bw-common/runScript";
import { loadRootConfig } from "../../../config";
import { getUserEnvVar } from "../../../config/userEnvVars";
import { parse, quote } from "../../../internal/bundledDeps/shellQuote";
import type { Simplify } from "../../../internal/core";
import {
  DEFAULT_TEMP_DIR,
  IS_WINDOWS,
  InvalidJSTypeError,
  expandHomePath,
  isPlainObject,
  validateJSArray,
  validateJSTypes,
} from "../../../internal/core";
import { logger } from "../../../internal/logger";
import {
  runScript,
  runScripts,
  createScriptRuntimeEnvVars,
  interpolateWorkspaceScriptMetadata,
  type RunScriptsParallelOptions,
  type RunScriptsSummary,
  type RunScriptExit,
  type OutputStreamName,
  type ScriptEventName,
} from "../../../runScript";
import {
  createMultiProcessOutput,
  type MultiProcessOutput,
} from "../../../runScript/output/multiProcessOutput";
import { checkIsRecursiveScript } from "../../../runScript/recursion";
import { resolveScriptShell } from "../../../runScript/scriptShellOption";
import {
  findWorkspaces,
  sortWorkspaces,
  type Workspace,
} from "../../../workspaces";
import { preventDependencyCycles } from "../../../workspaces/dependencyGraph";
import { PROJECT_ERRORS } from "../../errors";
import type { Project, ProjectConfig } from "../../project";
import {
  ProjectBase,
  resolveRootWorkspaceSelector,
  resolveWorkspacePath,
} from "../projectBase";
import {
  getAffectedWorkspaces,
  type AffectedWorkspacesResult,
  type GetAffectedWorkspacesOptions,
} from "./affectedWorkspaces";

/** Arguments for {@link createFileSystemProject} */
export type CreateFileSystemProjectOptions = {
  /** The directory containing the root package.json. Often the same root as a git repository. Relative to process.cwd(). The default is process.cwd(). */
  rootDirectory?: string;
  /**
   * The name of the project.
   *
   * By default will use the root package.json name
   */
  name?: string;
  /** Whether to include the root workspace as a normal workspace. This overrides any config or env var settings. */
  includeRootWorkspace?: boolean;
};

export type InlineScriptOptions = {
  /** A name to act as a label for the inline script */
  scriptName?: string;
  /** Whether to use the system shell or Bun shell */
  shell?: ShellOption;
};

/** Arguments for `FileSystemProject.runWorkspaceScript` */
export type RunWorkspaceScriptOptions = {
  /** The name of the workspace to run the script in */
  workspaceNameOrAlias: string;
  /** The name of the script to run, or an inline command when `inline` is true */
  script: string;
  /** Whether to run the script as an inline command */
  inline?: boolean | InlineScriptOptions;
  /** The arguments to append to the script command. If passed as a string, the argv will be parsed POSIX-style */
  args?: string | string[];
  /** Set to `true` to ignore all output from the script. This saves memory when you don't need script output. */
  ignoreOutput?: boolean;
};

/** Metadata associated with a workspace script */
export type RunWorkspaceScriptMetadata = {
  /** The workspace that the script was run in */
  workspace: Workspace;
};

export type RunWorkspaceScriptExit = Simplify<
  RunScriptExit<RunWorkspaceScriptMetadata>
>;

export type RunWorkspaceScriptProcessOutput = MultiProcessOutput<
  RunWorkspaceScriptMetadata & { streamName: OutputStreamName }
>;
/** Result of `FileSystemProject.runWorkspaceScript` */
export type RunWorkspaceScriptResult = {
  /** Use to get the output of the script */
  output: RunWorkspaceScriptProcessOutput;
  /** The exit result of the script */
  exit: Promise<RunWorkspaceScriptExit>;
};

export type ParallelOption = boolean | RunScriptsParallelOptions;

export type ScriptEventMetadata = {
  /** The workspace that the script event occurred in */
  workspace: Workspace;
  /** The exit result of the script */
  exitResult: RunScriptExit<RunWorkspaceScriptMetadata> | null;
};

export type OnScriptEventCallback = (
  /** The event that occurred */
  event: ScriptEventName,
  /** The metadata for the script event */
  metadata: ScriptEventMetadata,
) => unknown;

/** Arguments for `FileSystemProject.runScriptAcrossWorkspaces` */
export type RunScriptAcrossWorkspacesOptions = {
  /**
   * Workspace names, aliases, or patterns including a wildcard.
   *
   * When not provided, all workspaces that the script can be ran in will be used.
   */
  workspacePatterns?: string[];
  /** The name of the script to run, or an inline command when `inline` is true */
  script: string;
  /** Whether to run the script as an inline command */
  inline?: boolean | InlineScriptOptions;
  /** The arguments to append to the script command. If passed as a string, the argv will be parsed POSIX-style */
  args?: string | string[];
  /** Whether to run the scripts in parallel (default: `true`). Pass `false` to run in series. */
  parallel?: ParallelOption;
  /** When `true`, run scripts so that dependent workspaces run only after their dependencies */
  dependencyOrder?: boolean;
  /** When `true`, continue running scripts even if a dependency fails (Only relevant when `dependencyOrder` is `true`) */
  ignoreDependencyFailure?: boolean;
  /** Set to `true` to ignore all output from the scripts. This saves memory when you don't need script output. */
  ignoreOutput?: boolean;
  /** Callback to invoke when a script event occurs (start, skip, exit) */
  onScriptEvent?: OnScriptEventCallback;
};

export type RunScriptAcrossWorkspacesSummary = Simplify<
  RunScriptsSummary<RunWorkspaceScriptMetadata>
>;

export type RunScriptAcrossWorkspacesOutput = MultiProcessOutput<
  RunWorkspaceScriptMetadata & { streamName: OutputStreamName }
>;

/** Result of `FileSystemProject.runScriptAcrossWorkspaces` */
export type RunScriptAcrossWorkspacesResult = {
  /** Use to get the output of the scripts */
  output: RunScriptAcrossWorkspacesOutput;
  /** The summary of the script run with exit details for each workspace */
  summary: Promise<RunScriptAcrossWorkspacesSummary>;
  /** The workspaces targeted */
  workspaces: Workspace[];
};

export type RunAffectedWorkspaceScriptOptions = {
  /**
   * Options for resolving the affected workspaces. The `script` field is
   * intentionally omitted — it is derived from `scriptOptions` (the inline
   * script name when running inline, the script name otherwise) so that
   * inputs resolution always tracks the script being run.
   */
  affectedOptions: Omit<GetAffectedWorkspacesOptions, "script">;
  scriptOptions: Omit<RunScriptAcrossWorkspacesOptions, "workspacePatterns">;
};

/**
 * Resolves the script name used to look up script-level inputs in
 * `runAffectedWorkspaceScript`. Uses the inline-script name when running
 * an inline command, or the script name otherwise.
 */
const resolveInputsLookupScriptName = (
  scriptOptions: Omit<RunScriptAcrossWorkspacesOptions, "workspacePatterns">,
): string | undefined => {
  if (!scriptOptions.inline) return scriptOptions.script;
  if (typeof scriptOptions.inline === "object") {
    return scriptOptions.inline.scriptName;
  }
  return undefined;
};

const createEmptyAffectedRunResult = (): RunScriptAcrossWorkspacesResult => {
  const now = new Date().toISOString();
  return {
    output: createMultiProcessOutput([]),
    summary: Promise.resolve({
      totalCount: 0,
      successCount: 0,
      failureCount: 0,
      allSuccess: true,
      startTimeISO: now,
      endTimeISO: now,
      durationMs: 0,
      scriptResults: [],
    }),
    workspaces: [],
  };
};

const quoteArg = (arg: string, shell: ScriptShellOption): string =>
  IS_WINDOWS && shell === "system"
    ? `"${arg.replace(/"/g, '""')}"`
    : quote([arg]);

const serializeArgs = (
  args: string | string[] | undefined,
  metadata: WorkspaceScriptMetadata,
  shell: ScriptShellOption,
): string => {
  if (!args || args.length === 0) return "";

  if (Array.isArray(args)) {
    return args
      .map((arg) =>
        quoteArg(
          interpolateWorkspaceScriptMetadata(arg, metadata, shell),
          shell,
        ),
      )
      .join(" ");
  }

  const interpolated = interpolateWorkspaceScriptMetadata(
    args,
    metadata,
    shell,
  );
  // Escape backslashes in interpolated values before POSIX parse on Windows,
  // so that path separators survive parse's escape processing (\\→\)
  const parseInput =
    IS_WINDOWS && shell === "system"
      ? interpolated.replace(/\\/g, "\\\\")
      : interpolated;
  return parse(parseInput)
    .flatMap((entry): string[] => {
      if (typeof entry === "string") {
        return [quoteArg(entry, shell)];
      }
      if ("comment" in entry) {
        return [];
      }
      if ("pattern" in entry) {
        return [entry.pattern];
      }
      return [entry.op];
    })
    .join(" ");
};

class _FileSystemProject extends ProjectBase implements Project {
  public readonly rootDirectory: string;
  public readonly workspaces: Workspace[];
  public readonly name: string;
  public readonly sourceType = "fileSystem";
  public readonly config: ProjectConfig;
  public readonly rootWorkspace: Workspace;

  constructor(options: CreateFileSystemProjectOptions) {
    super();

    validateJSTypes(
      {
        "rootDirectory option": {
          value: options.rootDirectory,
          typeofName: "string",
          optional: true,
        },
        "name option": {
          value: options.name,
          typeofName: "string",
          optional: true,
        },
        "includeRootWorkspace option": {
          value: options.includeRootWorkspace,
          typeofName: "boolean",
          optional: true,
        },
      },
      { throw: true },
    );

    if (!_FileSystemProject.#initialized) {
      DEFAULT_TEMP_DIR.initialize(true);
      _FileSystemProject.#initialized = true;
    }

    this.rootDirectory = path.resolve(
      process.cwd(),
      expandHomePath(options.rootDirectory ?? ""),
    );

    const rootConfig = loadRootConfig(this.rootDirectory);

    const { workspaces, workspaceMap, rootWorkspace } = findWorkspaces({
      rootDirectory: this.rootDirectory,
      includeRootWorkspace:
        options.includeRootWorkspace ??
        rootConfig.defaults.includeRootWorkspace ??
        getUserEnvVar("includeRootWorkspaceDefault") === "true",
      workspacePatternConfigs: rootConfig.workspacePatternConfigs,
    });

    this.rootWorkspace = rootWorkspace;

    this.workspaces = workspaces;

    this.config = {
      root: rootConfig,
      workspaces: Object.fromEntries(
        Object.entries(workspaceMap)
          .map(([name, { config }]) => [name, config])
          .filter(([_, config]) => config !== undefined),
      ),
    };

    if (!options.name) {
      const packageJson = JSON.parse(
        fs.readFileSync(path.join(this.rootDirectory, "package.json"), "utf8"),
      );
      this.name = packageJson.name ?? "";
    } else {
      this.name = "";
    }
  }

  runWorkspaceScript(
    options: RunWorkspaceScriptOptions,
  ): RunWorkspaceScriptResult {
    validateJSTypes(
      {
        "workspaceNameOrAlias option": {
          value: options.workspaceNameOrAlias,
          typeofName: "string",
        },
        "script option": { value: options.script, typeofName: "string" },
        "inline option": {
          value: options.inline,
          typeofName: ["boolean", "object"],
          optional: true,
        },
        "ignoreOutput option": {
          value: options.ignoreOutput,
          typeofName: "boolean",
          optional: true,
        },
      },
      { throw: true },
    );

    if (options.args !== undefined) {
      if (typeof options.args !== "string" && !Array.isArray(options.args)) {
        throw new InvalidJSTypeError(
          `Type error: args option expects type string | string[], received ${typeof options.args}`,
        );
      }
      if (Array.isArray(options.args)) {
        const argsError = validateJSArray({
          value: options.args,
          valueLabel: "args option",
          itemOptions: { typeofName: "string" },
        });
        if (argsError) throw argsError;
      }
    }

    if (isPlainObject(options.inline)) {
      validateJSTypes(
        {
          "inline.scriptName option": {
            value: options.inline.scriptName,
            typeofName: "string",
            optional: true,
          },
          "inline.shell option": {
            value: options.inline.shell,
            typeofName: "string",
            optional: true,
          },
        },
        { throw: true },
      );
    }

    const workspace = resolveRootWorkspaceSelector(
      options.workspaceNameOrAlias,
      this,
    );

    if (!workspace) {
      throw new PROJECT_ERRORS.ProjectWorkspaceNotFound(
        `Workspace not found: ${JSON.stringify(options.workspaceNameOrAlias)}`,
      );
    }

    const shell = resolveScriptShell(
      options.inline && typeof options.inline === "object"
        ? options.inline.shell
        : this.config.root.defaults.shell,
    );

    logger.debug(
      `Running script ${options.inline ? "inline command" : options.script} in workspace ${workspace.name}${options.inline ? ` using the ${shell} shell` : ""}`,
    );

    const inlineScriptName =
      typeof options.inline === "object"
        ? (options.inline?.scriptName ?? "")
        : "";

    const workspaceScriptMetadata: WorkspaceScriptMetadata = {
      projectPath: this.rootDirectory,
      projectName: this.name,
      workspacePath: resolveWorkspacePath(this, workspace),
      workspaceRelativePath: workspace.path,
      workspaceName: workspace.name,
      scriptName: options.inline ? inlineScriptName : options.script,
    };

    const args = serializeArgs(options.args, workspaceScriptMetadata, shell);

    const script = options.inline
      ? interpolateWorkspaceScriptMetadata(
          options.script,
          workspaceScriptMetadata,
          shell,
        ) + (args ? " " + args : "")
      : options.script;

    if (!options.inline && checkIsRecursiveScript(workspace.name, script)) {
      throw new PROJECT_ERRORS.RecursiveWorkspaceScript(
        `Script "${script}" recursively calls itself in workspace "${workspace.name}"`,
      );
    }

    const scriptCommand = options.inline
      ? {
          command: script,
          workingDirectory: resolveWorkspacePath(this, workspace),
        }
      : this.createScriptCommand({
          workspaceNameOrAlias: options.workspaceNameOrAlias,
          scriptName: script,
          args,
        }).commandDetails;

    const result = runScript({
      scriptCommand,
      metadata: {
        workspace,
      },
      env: createScriptRuntimeEnvVars(workspaceScriptMetadata),
      shell,
      ignoreOutput: options.ignoreOutput ?? false,
    });

    return result;
  }

  runScriptAcrossWorkspaces(
    options: RunScriptAcrossWorkspacesOptions,
  ): RunScriptAcrossWorkspacesResult {
    validateJSTypes(
      {
        "script option": { value: options.script, typeofName: "string" },
        "workspacePatterns option": {
          value: options.workspacePatterns,
          optional: true,
          itemOptions: { typeofName: "string" },
          array: true,
        },
        "inline option": {
          value: options.inline,
          typeofName: ["boolean", "object"],
          optional: true,
        },
        "parallel option": {
          value: options.parallel,
          typeofName: ["boolean", "object"],
          optional: true,
        },
        "dependencyOrder option": {
          value: options.dependencyOrder,
          typeofName: "boolean",
          optional: true,
        },
        "ignoreDependencyFailure option": {
          value: options.ignoreDependencyFailure,
          typeofName: "boolean",
          optional: true,
        },
        "ignoreOutput option": {
          value: options.ignoreOutput,
          typeofName: "boolean",
          optional: true,
        },
        "onScriptEvent option": {
          value: options.onScriptEvent,
          typeofName: "function",
          optional: true,
        },
      },
      { throw: true },
    );

    if (isPlainObject(options.inline)) {
      validateJSTypes(
        {
          "inline.scriptName option": {
            value: options.inline.scriptName,
            typeofName: "string",
            optional: true,
          },
          "inline.shell option": {
            value: options.inline.shell,
            typeofName: "string",
            optional: true,
          },
        },
        { throw: true },
      );
    }

    if (options.args !== undefined) {
      if (typeof options.args !== "string" && !Array.isArray(options.args)) {
        throw new InvalidJSTypeError(
          `Type error: args option expects type string | string[], received ${typeof options.args}`,
        );
      }
      if (Array.isArray(options.args)) {
        const argsError = validateJSArray({
          value: options.args,
          valueLabel: "args option",
          itemOptions: { typeofName: "string" },
        });
        if (argsError) throw argsError;
      }
    }

    if (isPlainObject(options.parallel)) {
      validateJSTypes(
        {
          "parallel.max option": {
            value: options.parallel.max,
            typeofName: ["number", "string"],
          },
        },
        { throw: true },
      );
    }

    const matchedWorkspaces = sortWorkspaces(
      (
        options.workspacePatterns ??
        this.workspaces.map((workspace) => workspace.name)
      ).flatMap((pattern) => this.findWorkspacesByPattern(pattern)),
    );

    let workspaces = matchedWorkspaces
      .filter(
        (workspace) =>
          options.inline || workspace.scripts.includes(options.script),
      )
      .sort((a, b) => {
        const aScriptConfig =
          this.config.workspaces[a.name]?.scripts[options.script];

        const bScriptConfig =
          this.config.workspaces[b.name]?.scripts[options.script];

        if (!aScriptConfig) {
          return bScriptConfig ? 1 : 0;
        }

        if (!bScriptConfig) {
          return aScriptConfig ? -1 : 0;
        }

        return (aScriptConfig.order ?? 0) - (bScriptConfig.order ?? 0);
      });

    if (!workspaces.length) {
      const isSingleMatchNotFound =
        options.workspacePatterns?.length === 1 &&
        !options.workspacePatterns[0].includes("*") &&
        !matchedWorkspaces.length;

      throw new PROJECT_ERRORS.ProjectWorkspaceNotFound(
        isSingleMatchNotFound
          ? `Workspace name or alias not found: ${JSON.stringify(options?.workspacePatterns?.[0])}`
          : `No matching workspaces found with script ${JSON.stringify(options.script)}`,
      );
    }

    if (options.dependencyOrder) {
      const cycleDetection = preventDependencyCycles(workspaces);
      workspaces = cycleDetection.workspaces;
      for (const cycle of cycleDetection.cycles) {
        logger.warn(
          `Dependency cycle detected: ${cycle.dependency} -> ${cycle.dependent} (ignoring)`,
        );
      }
    }

    const recursiveWorkspace = workspaces.find((workspace) =>
      checkIsRecursiveScript(workspace.name, options.script),
    );
    if (recursiveWorkspace && !options.inline) {
      throw new PROJECT_ERRORS.RecursiveWorkspaceScript(
        `Script "${options.script}" recursively calls itself in workspace "${recursiveWorkspace.name}"`,
      );
    }

    const shell = resolveScriptShell(
      options.inline && typeof options.inline === "object"
        ? options.inline.shell
        : this.config.root.defaults.shell,
    );

    logger.debug(
      `Running script ${options.inline ? "inline command" : options.script} across workspaces${options.inline ? ` using the ${shell} shell` : ""}: ${workspaces.map((workspace) => workspace.name).join(", ")}`,
    );

    const result = runScripts({
      scripts: workspaces.map((workspace) => {
        const inlineScriptName =
          typeof options.inline === "object"
            ? (options.inline?.scriptName ?? "")
            : "";

        const workspaceScriptMetadata: WorkspaceScriptMetadata = {
          projectPath: this.rootDirectory,
          projectName: this.name,
          workspacePath: resolveWorkspacePath(this, workspace),
          workspaceRelativePath: workspace.path,
          workspaceName: workspace.name,
          scriptName: options.inline ? inlineScriptName : options.script,
        };

        const args = serializeArgs(
          options.args,
          workspaceScriptMetadata,
          shell,
        );

        const script = options.inline
          ? interpolateWorkspaceScriptMetadata(
              options.script,
              workspaceScriptMetadata,
              shell,
            ) + (args ? " " + args : "")
          : options.script;

        const scriptCommand = options.inline
          ? {
              command: script,
              workingDirectory: resolveWorkspacePath(this, workspace),
            }
          : this.createScriptCommand({
              workspaceNameOrAlias:
                workspace.name === this.rootWorkspace.name
                  ? ROOT_WORKSPACE_SELECTOR
                  : workspace.name,
              scriptName: script,
              args,
            }).commandDetails;

        return {
          metadata: {
            workspace,
          },
          scriptCommand,
          env: createScriptRuntimeEnvVars(workspaceScriptMetadata),
          shell,
          dependsOn: options.dependencyOrder
            ? workspace.dependencies
                .map((dependency) =>
                  workspaces.findIndex((w) => w.name === dependency),
                )
                .filter((index) => index !== -1)
            : undefined,
        };
      }),
      ignoreDependencyFailure: options.ignoreDependencyFailure,
      parallel:
        options.parallel === true || options.parallel === undefined
          ? { max: this.config.root.defaults.parallelMax }
          : (options.parallel ?? true),
      ignoreOutput: options.ignoreOutput ?? false,
      onScriptEvent: (event, index, exitResult) =>
        options.onScriptEvent?.(event, {
          workspace: workspaces[index],
          exitResult,
        }),
    });

    return {
      ...result,
      workspaces,
    };
  }

  /**
   * Determine the affected workspaces based on the given options.
   *
   * Returns a summary of all workspaces, whether they are affected or not,
   * and the reasons why they are affected.
   */
  async getAffectedWorkspaces(
    options: GetAffectedWorkspacesOptions,
  ): Promise<AffectedWorkspacesResult> {
    validateJSTypes(
      {
        "diffSource option": {
          value: options.diffSource,
          typeofName: "string",
        },
        "ignorePackageDependencies option": {
          value: options.ignorePackageDependencies,
          typeofName: "boolean",
          optional: true,
        },
        "script option": {
          value: options.script,
          typeofName: "string",
          optional: true,
        },
      },
      { throw: true },
    );

    if (options.diffSource !== "git" && options.diffSource !== "fileList") {
      throw new InvalidJSTypeError(
        `Type error: diffSource option expects "git" | "fileList", received ${JSON.stringify((options as { diffSource: unknown }).diffSource)}`,
      );
    }

    if (options.diffSource === "git") {
      validateJSTypes(
        {
          "diffOptions option": {
            value: options.diffOptions,
            typeofName: "object",
            optional: true,
          },
        },
        { throw: true },
      );
      if (options.diffOptions !== undefined) {
        validateJSTypes(
          {
            "diffOptions.baseRef option": {
              value: options.diffOptions.baseRef,
              typeofName: "string",
              optional: true,
            },
            "diffOptions.headRef option": {
              value: options.diffOptions.headRef,
              typeofName: "string",
              optional: true,
            },
            "diffOptions.ignoreUntracked option": {
              value: options.diffOptions.ignoreUntracked,
              typeofName: "boolean",
              optional: true,
            },
            "diffOptions.ignoreStaged option": {
              value: options.diffOptions.ignoreStaged,
              typeofName: "boolean",
              optional: true,
            },
            "diffOptions.ignoreUnstaged option": {
              value: options.diffOptions.ignoreUnstaged,
              typeofName: "boolean",
              optional: true,
            },
            "diffOptions.ignoreUncommitted option": {
              value: options.diffOptions.ignoreUncommitted,
              typeofName: "boolean",
              optional: true,
            },
          },
          { throw: true },
        );
      }
    } else {
      validateJSTypes(
        {
          "changedFiles option": {
            value: options.changedFiles,
            array: true,
            itemOptions: { typeofName: "string" },
          },
        },
        { throw: true },
      );
    }

    return getAffectedWorkspaces(this, options);
  }

  /**
   * Run the script across the affected workspaces.
   *
   * Similar to {@link runScriptAcrossWorkspaces}, but only runs the script across the affected workspaces.
   */
  async runAffectedWorkspaceScript({
    affectedOptions,
    scriptOptions,
  }: RunAffectedWorkspaceScriptOptions): Promise<RunScriptAcrossWorkspacesResult> {
    const { workspaceResults } = await this.getAffectedWorkspaces({
      ...affectedOptions,
      script: resolveInputsLookupScriptName(scriptOptions),
    });

    const affectedNames = workspaceResults
      .filter(({ isAffected }) => isAffected)
      .map(({ workspace }) => workspace.name);

    if (affectedNames.length === 0) {
      return createEmptyAffectedRunResult();
    }

    return this.runScriptAcrossWorkspaces({
      ...scriptOptions,
      workspacePatterns: affectedNames,
    });
  }

  static #initialized = false;
}

/** An implementation of {@link Project} that is created from a root directory in the file system. */
export type FileSystemProject = Simplify<_FileSystemProject>;

/**
 * Create a {@link Project} based on a given root directory.
 * Automatically finds workspaces based on the root package.json "workspaces" field
 * and detects and utilizes any provided configuration.
 */
export const createFileSystemProject = (
  options: CreateFileSystemProjectOptions = {},
): FileSystemProject => new _FileSystemProject(options);
