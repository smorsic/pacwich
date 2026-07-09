import fs from "fs";
import os from "os";
import path from "path";
import type {
  ScriptShellOption,
  ShellOption,
} from "@pacwich/common/parameters";
import type { WorkspaceScriptMetadata } from "@pacwich/common/runScript";
import { loadProjectConfig } from "../../../config";
import { getUserBoolEnvVar, getUserEnvVar } from "../../../config/userEnvVars";
import { parse, quote } from "../../../internal/bundledDeps/shellQuote";
import type { Simplify } from "../../../internal/core";
import {
  DEFAULT_TEMP_DIR,
  IS_WINDOWS,
  InvalidJSTypeError,
  PacwichError,
  expandHomePath,
  isPlainObject,
  validateJSArray,
  validateJSTypes,
} from "../../../internal/core";
import { logger } from "../../../internal/logger";
import {
  PACKAGE_MANAGER_VALUES,
  resolvePackageManagerValue,
  type PackageManagerName,
  type PackageManagerValue,
  type ScriptCommand,
} from "../../../packageManager/adapter";
import {
  runScript,
  runScriptInteractive,
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
import { sortWorkspaces, type Workspace } from "../../../workspaces";
import { preventDependencyCycles } from "../../../workspaces/dependencyGraph";
import { PROJECT_ERRORS } from "../../errors";
import type { Project, ProjectConfigs } from "../../project";
import {
  ProjectBase,
  resolveRootWorkspaceSelector,
  resolveWorkspacePath,
} from "../projectBase";
import {
  determineAffectedWorkspaces,
  type AffectedWorkspacesResult,
  type DetermineAffectedWorkspacesOptions,
} from "./affectedWorkspaces";
import { assembleProject } from "./assembleProject";
import { findProjectRoot } from "./findProjectRoot";
import { verifyProject, type VerifyOptions, type VerifyResult } from "./verify";

/** Arguments for {@link createFileSystemProject} */
export type CreateFileSystemProjectOptions = {
  /**
   * Where to start looking for the project root. The actual project
   * root is resolved by walking up from this directory until a
   * `package.json` with a `workspaces` field is found, falling back
   * to this directory itself when no such ancestor exists.
   *
   * Relative to `process.cwd()`. Default: `process.cwd()`.
   *
   * @example
   * // From a sub-workspace directory. The project's rootDirectory
   * // will be the monorepo root, not "packages/foo".
   * createFileSystemProject({ rootDirectory: "packages/foo" });
   */
  rootDirectory?: string;
  /**
   * The name of the project.
   *
   * By default will use the root package.json name
   */
  name?: string;
  /**
   * Package manager backend driving workspace/lockfile semantics.
   *
   * Accepts a concrete name (`"bun"`, `"npm"`) or `"auto"` to pick
   * one based on the lockfiles present in `rootDirectory`. When
   * omitted, the project config `packageManager` field is consulted
   * (which itself falls back to the `PACWICH_PACKAGE_MANAGER` env
   * var, then `"auto"`).
   */
  packageManager?: PackageManagerValue;
  /** Whether to include the root workspace as a normal workspace. This overrides any config or env var settings. */
  includeRootWorkspace?: boolean;
  /**
   * When true, skip discovery of `.ts`/`.js` config files (`pacwich.project.{ts,js}`,
   * `pacwich.workspace.{ts,js}`) so no executable code is loaded from the project,
   * for untrusted contexts.
   *
   * `.jsonc`/`.json` configs and the `package.json` `pacwich` key still resolve.
   *
   * When omitted, the `PACWICH_DISABLE_EXECUTABLE_CONFIGS_DEFAULT` user env var is
   * consulted (`"true"` or `"false"`). If neither is set, defaults to false.
   */
  disableExecutableConfigs?: boolean;
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
  /**
   * Pass `true` to inherit the terminal's stdio instead of capturing output.
   *
   * See {@link RunWorkspaceScriptInteractiveOptions}
   */
  interactive?: false;
};

/**
 * Arguments for the interactive overload of
 * `FileSystemProject.runWorkspaceScript`. The child inherits the
 * terminal's stdio directly (stdin/stdout/stderr), so the script can
 * read user input and render to the terminal. Because nothing is
 * captured, `ignoreOutput` is not applicable and is omitted.
 */
export type RunWorkspaceScriptInteractiveOptions = Omit<
  RunWorkspaceScriptOptions,
  "ignoreOutput" | "interactive"
> & {
  /** Run the script with the terminal's stdio inherited. */
  interactive: true;
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

/**
 * Result of the interactive overload of
 * `FileSystemProject.runWorkspaceScript`. There is no `output` stream:
 * the script's stdio is wired straight to the terminal.
 */
export type RunWorkspaceScriptInteractiveResult = {
  /** The exit result of the script */
  exit: Promise<RunWorkspaceScriptExit>;
};

export type ParallelOption = boolean | RunScriptsParallelOptions;

export type ScriptEventMetadata = {
  /** The workspace that the script event occurred in */
  workspace: Workspace;
  /** The exit result of the script */
  exitResult: RunWorkspaceScriptExit | null;
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
   * intentionally omitted. It is derived from `scriptOptions` (the inline
   * script name when running inline, the script name otherwise) so that
   * inputs resolution always tracks the script being run.
   */
  affectedOptions: DetermineAffectedWorkspacesOptions<false>;
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

/**
 * A bare workspace name carries no specifier prefix (`tag:`,
 * `alias:`, `not:`, etc.) and no wildcard, so a no-match result
 * genuinely means "no such workspace name/alias." Used to route
 * the run-script no-match error toward the more specific
 * "Workspace name or alias not found" message only when the input
 * really was a name lookup.
 */
const isBareWorkspaceName = (pattern: string): boolean =>
  !pattern.includes("*") && !pattern.includes(":");

const buildWorkspacesNotFoundMessage = ({
  script,
  patterns,
  matchedWorkspacesCount,
}: {
  script: string;
  patterns: string[] | undefined;
  matchedWorkspacesCount: number;
}): string => {
  if (
    matchedWorkspacesCount === 0 &&
    patterns?.length === 1 &&
    isBareWorkspaceName(patterns[0])
  ) {
    return `Workspace name or alias not found: ${JSON.stringify(patterns[0])}`;
  }
  return `No matching workspaces found with script ${JSON.stringify(script)}`;
};

const quoteArg = (arg: string, shell: ScriptShellOption): string =>
  IS_WINDOWS && shell === "system"
    ? `"${arg.replace(/"/g, '""')}"`
    : quote([arg]);

/**
 * bunx writes its Node-impersonation shims under the system temp dir.
 * The path varies by platform: `/tmp` on Linux; `$TMPDIR` (typically
 * `/var/folders/.../T`) on macOS, which also resolves through
 * `/private/var/folders/...`; `%TEMP%` (e.g.
 * `C:\Users\...\AppData\Local\Temp`) on Windows. Derive the prefixes
 * at load time from `os.tmpdir()` and the various tmpdir env vars
 * (+ realpath, + `/tmp` Linux fallback) and emit both separator
 * variants. On Windows we also lowercase both sides for matching
 * since the same directory can appear in PATH with mixed case.
 */
const normalizeForCompare = (p: string): string =>
  IS_WINDOWS ? p.toLowerCase() : p;

const BUN_NODE_SHIM_PREFIXES: readonly string[] = (() => {
  const tmpDirs = new Set<string>();
  const add = (p: string | undefined) => {
    if (!p) return;
    tmpDirs.add(p);
    try {
      tmpDirs.add(fs.realpathSync(p));
    } catch {
      // best-effort: tmpdir may not exist in unusual environments
    }
  };
  add(os.tmpdir());
  add(process.env.TMPDIR);
  add(process.env.TEMP);
  add(process.env.TMP);
  add("/tmp");
  // Emit both separators so prefix matching works regardless of which
  // form ends up in PATH on Windows (bun and Node disagree at times).
  return [...tmpDirs]
    .flatMap((d) => [
      `${d}/bun-node-`,
      `${d}/bunx-`,
      `${d}\\bun-node-`,
      `${d}\\bunx-`,
    ])
    .map(normalizeForCompare);
})();

const isBunNodeShimPath = (p: string): boolean => {
  const candidate = normalizeForCompare(p);
  return BUN_NODE_SHIM_PREFIXES.some((prefix) => candidate.startsWith(prefix));
};

/**
 * Strip Bun's `bunx --bun` Node-impersonation from a child env.
 *
 * `bunx --bun <tool>` writes a `node` shim to `/tmp/bun-node-<hash>/`
 * (which is actually Bun) and prepends that dir to PATH, plus sets
 * NODE / npm_node_execpath to point at it. That makes any subprocess
 * doing `exec node …` resolve to Bun. Tools depending on Node-only
 * built-ins (e.g. pnpm 11, which imports `node:sqlite` at startup)
 * then fail on Bun's missing modules.
 *
 * Pacwich's non-inline path delegates to a PM binary (`pnpm run …`,
 * `npm run …`, `bun run …`), which is pacwich's own one-line
 * invocation, not user-authored. The PM should resolve its own runtime
 * cleanly, so we scrub the bun-as-node injection from spawned children
 * here. Inline (user-authored) commands keep the env untouched, since
 * that's the user's environment to control.
 *
 * Returned overrides are spread into the env passed to runScript (any
 * key present overrides the corresponding `process.env` entry that
 * runScript merges in).
 */
const buildBunAsNodeScrubOverride = (
  env: NodeJS.ProcessEnv,
): Record<string, string> => {
  const overrides: Record<string, string> = {};
  if (env.PATH) {
    const filtered = env.PATH.split(path.delimiter)
      .filter((p) => !isBunNodeShimPath(p))
      .join(path.delimiter);
    if (filtered !== env.PATH) overrides.PATH = filtered;
  }
  if (env.NODE && isBunNodeShimPath(env.NODE)) overrides.NODE = "";
  if (env.npm_node_execpath && isBunNodeShimPath(env.npm_node_execpath)) {
    overrides.npm_node_execpath = "";
  }
  return overrides;
};

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
          interpolateWorkspaceScriptMetadata({ text: arg, metadata, shell }),
          shell,
        ),
      )
      .join(" ");
  }

  const interpolated = interpolateWorkspaceScriptMetadata({
    text: args,
    metadata,
    shell,
    quoteValues: true,
  });
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

/**
 * Pre-resolved inputs handed from the {@link createFileSystemProject}
 * factory to the private constructor. Centralizing this resolution in
 * the factory keeps the precedence chain (option > config > env > auto)
 * in one place and lets the constructor receive a concrete
 * {@link PackageManagerName}. Necessary because the adapter has to be
 * built in `super()`, which JS disallows running code before.
 */
type FileSystemProjectInternals = {
  rootDirectory: string;
  loadConfigOptions: { disableExecutableConfigs: boolean };
  projectConfig: ReturnType<typeof loadProjectConfig>;
  /** Already mapped through {@link resolvePackageManagerValue}. */
  packageManagerName: PackageManagerName;
};

class _FileSystemProject extends ProjectBase implements Project {
  public readonly rootDirectory: string;
  public readonly workspaces: Workspace[];
  public readonly name: string;
  public readonly sourceType = "fileSystem";
  public readonly config: ProjectConfigs;
  public readonly rootWorkspace: Workspace;

  constructor(
    options: CreateFileSystemProjectOptions,
    internals: FileSystemProjectInternals,
  ) {
    super({ packageManager: internals.packageManagerName });

    if (!_FileSystemProject.#initialized) {
      DEFAULT_TEMP_DIR.initialize(true);
      _FileSystemProject.#initialized = true;
    }

    this.rootDirectory = internals.rootDirectory;
    const { loadConfigOptions, projectConfig } = internals;

    const { workspaces, workspaceMap, rootWorkspace } = assembleProject({
      rootDirectory: this.rootDirectory,
      adapter: this.__adapter,
      includeRootWorkspace:
        options.includeRootWorkspace ??
        projectConfig.defaults.includeRootWorkspace ??
        getUserEnvVar("includeRootWorkspaceDefault") === "true",
      workspacePatternConfigs: projectConfig.workspacePatternConfigs,
      loadConfigOptions,
    });

    this.rootWorkspace = rootWorkspace;

    this.workspaces = workspaces;

    this.config = {
      project: projectConfig,
      root: projectConfig,
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

  /**
   * Run a single `package.json` script in one workspace, or an
   * inline command when `inline` is true. Returns an
   * {@link RunWorkspaceScriptResult} containing an iterable
   * `output` stream and an `exit` promise.
   *
   * @example
   * const result = project.runWorkspaceScript({
   *   workspaceNameOrAlias: "core",
   *   script: "build",
   * });
   * for await (const { chunk, metadata } of result.output.text()) {
   *   process.stdout.write(chunk);
   * }
   * const exitResult = await result.exit;
   */
  runWorkspaceScript(
    options: RunWorkspaceScriptInteractiveOptions,
  ): RunWorkspaceScriptInteractiveResult;
  runWorkspaceScript(
    options: RunWorkspaceScriptOptions,
  ): RunWorkspaceScriptResult;
  runWorkspaceScript(
    options: RunWorkspaceScriptOptions | RunWorkspaceScriptInteractiveOptions,
  ): RunWorkspaceScriptResult | RunWorkspaceScriptInteractiveResult {
    if (!options.interactive) {
      validateJSTypes(
        {
          "ignoreOutput option": {
            value: options.ignoreOutput,
            typeofName: "boolean",
            optional: true,
          },
        },
        { throw: true },
      );
    }

    const { workspace, scriptCommand, env, shell } =
      this.#prepareWorkspaceScriptRun(options);

    if (options.interactive) {
      const { exit } = runScriptInteractive({
        scriptCommand,
        metadata: { workspace },
        env,
        shell,
      });
      return { exit };
    }

    return runScript({
      scriptCommand,
      metadata: { workspace },
      env,
      shell,
      ignoreOutput: options.ignoreOutput ?? false,
    });
  }

  /**
   * Resolve the metadata needed to run a workspace script
   * from user options
   */
  #prepareWorkspaceScriptRun(
    options: RunWorkspaceScriptOptions | RunWorkspaceScriptInteractiveOptions,
  ): {
    workspace: Workspace;
    scriptCommand: ScriptCommand;
    env: Record<string, string>;
    shell: ScriptShellOption;
  } {
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

    const shell = options.inline
      ? resolveScriptShell(
          typeof options.inline === "object"
            ? options.inline.shell
            : this.config.project.defaults.shell,
        )
      : "system";

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
      ? interpolateWorkspaceScriptMetadata({
          text: options.script,
          metadata: workspaceScriptMetadata,
          shell,
          quoteValues: true,
        }) + (args ? " " + args : "")
      : options.script;

    if (!options.inline && checkIsRecursiveScript(workspace.name, script)) {
      throw new PROJECT_ERRORS.RecursiveWorkspaceScript(
        `Script "${script}" recursively calls itself in workspace "${workspace.name}"`,
      );
    }

    if (!options.inline && !workspace.scripts.includes(script)) {
      throw new PROJECT_ERRORS.WorkspaceScriptDoesNotExist(
        `Script not found in workspace ${JSON.stringify(
          workspace.name,
        )}: ${JSON.stringify(script)} (available: ${
          workspace.scripts.join(", ") || "none"
        })`,
      );
    }

    const scriptCommand = options.inline
      ? {
          command: script,
          workingDirectory: resolveWorkspacePath(this, workspace),
        }
      : this.__adapter.createScriptCommand({
          scriptName: script,
          args,
          workspace,
          rootDirectory: path.resolve(this.rootDirectory),
        });

    const env = {
      ...createScriptRuntimeEnvVars(workspaceScriptMetadata),
      ...(options.inline ? {} : buildBunAsNodeScrubOverride(process.env)),
    };

    return { workspace, scriptCommand, env, shell };
  }

  /**
   * Run a `package.json` script in every workspace that has it (or in
   * workspaces matched by `workspacePatterns`), or an inline command
   * when `inline` is true. Returns a single
   * {@link RunScriptAcrossWorkspacesResult} with one combined output
   * stream, a `summary` promise, and the list of targeted workspaces.
   *
   * @example
   * const result = project.runScriptAcrossWorkspaces({
   *   script: "build",
   *   dependencyOrder: true,
   *   parallel: { max: 2 },
   * });
   * for await (const { chunk, metadata } of result.output.text()) {
   *   process.stdout.write(`[${metadata.workspace.name}] ${chunk}`);
   * }
   * const summary = await result.summary;
   */
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

    // Resolve all patterns together so the workspace-pattern grammar
    // (negation, prefixed specifiers, regex) applies across the set
    // instead of being matched per-pattern in isolation.
    const matchedWorkspaces = options.workspacePatterns
      ? this.findWorkspacesByPattern(...options.workspacePatterns)
      : sortWorkspaces(this.workspaces);

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
      throw new PROJECT_ERRORS.ProjectWorkspaceNotFound(
        buildWorkspacesNotFoundMessage({
          script: options.script,
          patterns: options.workspacePatterns,
          matchedWorkspacesCount: matchedWorkspaces.length,
        }),
      );
    }

    if (options.dependencyOrder) {
      const cycleDetection = preventDependencyCycles(workspaces);
      workspaces = cycleDetection.workspaces;
      for (const cycle of cycleDetection.cycles) {
        logger.warn("DependencyCycleDetected", {
          dependency: cycle.dependency,
          dependent: cycle.dependent,
        });
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

    // See note on the same construct in runWorkspaceScript: the
    // user-configured shell only governs inline commands (non-inline
    // PM-delegation pins to "system").
    const shell = options.inline
      ? resolveScriptShell(
          typeof options.inline === "object"
            ? options.inline.shell
            : this.config.project.defaults.shell,
        )
      : "system";

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
          ? interpolateWorkspaceScriptMetadata({
              text: options.script,
              metadata: workspaceScriptMetadata,
              shell,
              quoteValues: true,
            }) + (args ? " " + args : "")
          : options.script;

        const scriptCommand = options.inline
          ? {
              command: script,
              workingDirectory: resolveWorkspacePath(this, workspace),
            }
          : this.__adapter.createScriptCommand({
              scriptName: script,
              args,
              workspace,
              rootDirectory: path.resolve(this.rootDirectory),
            });

        return {
          metadata: {
            workspace,
          },
          scriptCommand,
          env: {
            ...createScriptRuntimeEnvVars(workspaceScriptMetadata),
            ...(options.inline ? {} : buildBunAsNodeScrubOverride(process.env)),
          },
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
          ? { max: this.config.project.defaults.parallelMax }
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
   * Determine which workspaces are affected by a set of changes. The
   * returned `workspaceResults` includes every workspace (with
   * `isAffected: true | false`) and per-workspace reasons (changed
   * files, dependency cascade, external dep version deltas).
   *
   * Pass `diffSource: "git"` to diff a base ref against a head ref
   * (uncommitted changes included by default), or `diffSource: "fileList"`
   * to pass changed paths/globs explicitly and bypass git entirely.
   *
   * @example
   * // git mode against the configured base ref (default "main")
   * const result = await project.determineAffectedWorkspaces({
   *   diffSource: "git",
   * });
   *
   * @example
   * // explicit file list, scoped to the "build" script's inputs
   * const result = await project.determineAffectedWorkspaces({
   *   diffSource: "fileList",
   *   changedFiles: ["packages/a/src/**\/*.ts"],
   *   script: "build",
   * });
   */
  async determineAffectedWorkspaces(
    options: DetermineAffectedWorkspacesOptions,
  ): Promise<AffectedWorkspacesResult> {
    validateJSTypes(
      {
        "diffSource option": {
          value: options.diffSource,
          typeofName: "string",
        },
        "ignoreWorkspaceDependencies option": {
          value: options.ignoreWorkspaceDependencies,
          typeofName: "boolean",
          optional: true,
        },
        "ignoreExternalDependencies option": {
          value: options.ignoreExternalDependencies,
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

    return determineAffectedWorkspaces(this, this.__adapter, options);
  }

  /**
   * Detect implicit workspace dependencies in workspace source files.
   *
   * Scans each workspace's git-trackable JS/TS files (`.js`, `.jsx`,
   * `.mjs`, `.cjs`, `.ts`, `.tsx`, `.mts`, `.cts`) for `import`,
   * `require`, and `export ... from` references whose target is
   * another project workspace's package name that the importing
   * workspace does NOT declare in any of the four `package.json`
   * dependency maps. Each finding includes the importing workspace,
   * the imported workspace, every file and line in which it appears,
   * and a per-pm fix hint.
   *
   * Project-instantiation errors fail before this method runs and
   * therefore throw. They don't surface as a non-`ok` result.
   *
   * @example
   * const result = await project.verify({ strict: true });
   * if (!result.ok) process.exit(1);
   */
  async verify(options: VerifyOptions = {}): Promise<VerifyResult> {
    validateJSTypes(
      {
        "workspacePatterns option": {
          value: options.workspacePatterns,
          optional: true,
          itemOptions: { typeofName: "string" },
          array: true,
        },
        "strict option": {
          value: options.strict,
          typeofName: "boolean",
          optional: true,
        },
      },
      { throw: true },
    );
    return verifyProject(this, this.__adapter, options);
  }

  /**
   * Run a script across only the workspaces flagged affected by the
   * given {@link DetermineAffectedWorkspacesOptions}. Composes
   * {@link determineAffectedWorkspaces} with
   * {@link runScriptAcrossWorkspaces}. Returns an empty-but-shaped
   * {@link RunScriptAcrossWorkspacesResult} when no workspaces are
   * affected, so callers don't have to special-case the empty path.
   *
   * The `script` field on `affectedOptions` is intentionally omitted
   * from the type. The script name is derived from `scriptOptions` so
   * inputs resolution always tracks the script being run.
   *
   * @example
   * const result = await project.runAffectedWorkspaceScript({
   *   affectedOptions: { diffSource: "git" },
   *   scriptOptions: { script: "build", dependencyOrder: true },
   * });
   * const summary = await result.summary;
   */
  async runAffectedWorkspaceScript({
    affectedOptions,
    scriptOptions,
  }: RunAffectedWorkspaceScriptOptions): Promise<RunScriptAcrossWorkspacesResult> {
    const { workspaceResults } = await this.determineAffectedWorkspaces({
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

const validateCreateFileSystemProjectOptions = (
  options: CreateFileSystemProjectOptions,
): void => {
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
      "packageManager option": {
        value: options.packageManager,
        typeofName: "string",
        optional: true,
      },
      "includeRootWorkspace option": {
        value: options.includeRootWorkspace,
        typeofName: "boolean",
        optional: true,
      },
      "disableExecutableConfigs option": {
        value: options.disableExecutableConfigs,
        typeofName: "boolean",
        optional: true,
      },
    },
    { throw: true },
  );

  if (
    options.packageManager !== undefined &&
    !(PACKAGE_MANAGER_VALUES as readonly string[]).includes(
      options.packageManager,
    )
  ) {
    throw new PacwichError(
      `Invalid packageManager option: ${JSON.stringify(
        options.packageManager,
      )} (accepted values: ${PACKAGE_MANAGER_VALUES.join(", ")})`,
    );
  }
};

/**
 * Create a {@link Project} based on a given root directory.
 * Automatically finds workspaces based on the root package.json
 * "workspaces" field and detects and utilizes any provided
 * configuration.
 *
 * Precedence for the active package manager backend (highest first):
 *   1. `options.packageManager`
 *   2. Project config `packageManager` field
 *   3. `PACWICH_PACKAGE_MANAGER` env var
 *   4. `"auto"`, which probes for a lockfile in the project root
 *
 * @example
 * import { createFileSystemProject } from "pacwich";
 *
 * const project = createFileSystemProject();
 * for (const workspace of project.workspaces) {
 *   console.log(workspace.name, workspace.path);
 * }
 *
 * @example
 * // Point at a specific root and pin the package manager
 * const project = createFileSystemProject({
 *   rootDirectory: "/path/to/monorepo",
 *   packageManager: "pnpm",
 * });
 */
export const createFileSystemProject = (
  options: CreateFileSystemProjectOptions = {},
): FileSystemProject => {
  validateCreateFileSystemProjectOptions(options);

  const startDirectory = path.resolve(
    process.cwd(),
    expandHomePath(options.rootDirectory ?? ""),
  );
  const rootDirectory = findProjectRoot(startDirectory);

  // Project config can't supply a default for this. The config file itself
  // is what we're deciding whether to evaluate. Precedence is therefore
  // option > PACWICH_DISABLE_EXECUTABLE_CONFIGS_DEFAULT env var > false.
  const loadConfigOptions = {
    disableExecutableConfigs:
      options.disableExecutableConfigs ??
      getUserBoolEnvVar("disableExecutableConfigsDefault") ??
      false,
  };

  const projectConfig = loadProjectConfig(rootDirectory, loadConfigOptions);

  const effectivePackageManagerValue =
    options.packageManager ?? projectConfig.packageManager;

  const packageManagerName = resolvePackageManagerValue({
    value: effectivePackageManagerValue,
    rootDirectory,
  });

  return new _FileSystemProject(options, {
    rootDirectory,
    loadConfigOptions,
    projectConfig,
    packageManagerName,
  });
};
