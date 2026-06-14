import { createDefaultProjectConfig } from "../../config";
import type { Simplify } from "../../internal/core";
import { PacwichError, validateJSTypes } from "../../internal/core";
import {
  PACKAGE_MANAGER_NAMES,
  type PackageManagerName,
} from "../../packageManager/adapter";
import {
  validateWorkspaceAliases,
  WORKSPACE_ERRORS,
  type Workspace,
} from "../../workspaces";
import type { Project } from "../project";
import { ProjectBase } from "./projectBase";

/**
 * Arguments for {@link createMemoryProject}.
 *
 * @experimental MemoryProject is a minimal in-memory stand-in for
 * {@link FileSystemProject} that today only supports the read-only
 * `Project` surface (find/list/scriptMap/tagMap). Expanding
 * the surface to parity with FileSystemProject will depend on demand
 * or contribution currently.
 */
export type CreateMemoryProjectOptions = {
  /** The list of workspaces in the project */
  workspaces: Workspace[];
  /** The name of the project */
  name?: string;
  /**
   * Package manager backend driving workspace/lockfile semantics.
   *
   * Required: pacwich has no permanent default package manager, and
   * a memory project has no filesystem to probe for lockfiles, so
   * there's no way to derive one automatically. Pass a concrete
   * {@link PackageManagerName} (`"bun"`, `"npm"`).
   */
  packageManager: PackageManagerName;
  /** The root directory of the project (not used in any actual file system interactions in a {@link MemoryProject}) */
  rootDirectory?: string;
  /** The root workspace */
  rootWorkspace?: Workspace;
  /** Whether to include the root workspace as a normal workspace. */
  includeRootWorkspace?: boolean;
};

const validateMemoryProjectPackageManager = (
  value: PackageManagerName | undefined,
): void => {
  if (value === undefined) {
    throw new PacwichError(
      "createMemoryProject requires a `packageManager` option (one of: " +
        `${PACKAGE_MANAGER_NAMES.join(", ")}). There is no default package manager.`,
    );
  }
  if (typeof value !== "string") {
    throw new PacwichError(
      `Type error: packageManager option expects type string, received ${typeof value}`,
    );
  }
  if (!(PACKAGE_MANAGER_NAMES as readonly string[]).includes(value)) {
    throw new PacwichError(
      `Invalid packageManager option: ${JSON.stringify(value)} (accepted values: ${PACKAGE_MANAGER_NAMES.join(", ")})`,
    );
  }
};

class _MemoryProject extends ProjectBase implements Project {
  public readonly rootDirectory: string;
  public readonly workspaces: Workspace[];
  public readonly name: string;
  public readonly sourceType = "memory";
  public readonly config = {
    project: createDefaultProjectConfig(),
    root: createDefaultProjectConfig(),
    workspaces: {},
  };
  public readonly rootWorkspace: Workspace;

  constructor(options: CreateMemoryProjectOptions) {
    validateMemoryProjectPackageManager(options.packageManager);
    super({
      packageManager: options.packageManager,
      ignoreBunVersion: true,
    });

    validateJSTypes(
      {
        "workspaces option": {
          value: options.workspaces,
          itemOptions: { typeofName: "object" },
          array: true,
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
        "rootDirectory option": {
          value: options.rootDirectory,
          typeofName: "string",
          optional: true,
        },
        "rootWorkspace option": {
          value: options.rootWorkspace,
          typeofName: "object",
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

    const validateWorkspace = (workspace: Workspace) =>
      validateJSTypes(
        {
          "workspace name": { value: workspace.name, typeofName: "string" },
          "workspace path": { value: workspace.path, typeofName: "string" },
          "workspace scripts": {
            value: workspace.scripts,
            array: true,
            itemOptions: { typeofName: "string" },
          },
          "workspace aliases": {
            value: workspace.aliases,
            array: true,
            itemOptions: { typeofName: "string" },
          },
          "workspace dependencies": {
            value: workspace.dependencies,
            array: true,
            itemOptions: { typeofName: "string" },
          },
          "workspace dependents": {
            value: workspace.dependents,
            array: true,
            itemOptions: { typeofName: "string" },
          },
        },
        { throw: true },
      );

    for (const workspace of options.workspaces) {
      validateWorkspace(workspace);
    }

    this.name = options.name ?? "";
    this.rootDirectory = options.rootDirectory ?? "";
    this.workspaces = options.workspaces;
    this.rootWorkspace =
      options.rootWorkspace ??
      ({
        name: "default-root-workspace",
        isRoot: true,
        matchPattern: "",
        path: "",
        scripts: [],
        aliases: [],
        tags: [],
        dependencies: [],
        dependents: [],
        externalDependencies: [],
      } as Workspace);

    validateWorkspace(this.rootWorkspace);

    for (const workspace of this.workspaces) {
      if (
        this.workspaces.find(
          (ws) => ws !== workspace && ws.name === workspace.name,
        )
      ) {
        throw new WORKSPACE_ERRORS.DuplicateWorkspaceName(
          `Duplicate workspace name found: ${JSON.stringify(workspace.name)}`,
        );
      }
    }

    validateWorkspaceAliases(
      this.workspaces,
      this.workspaces.reduce(
        (acc, workspace) => {
          for (const alias of workspace.aliases) {
            acc[alias] = workspace.name;
          }
          return acc;
        },
        {} as Record<string, string>,
      ),
      this.name,
    );
  }
}

/**
 * An implementation of {@link Project} that is created from a list of
 * workspaces in memory. Mainly used for testing without needing a
 * real file system project.
 *
 * @experimental Only the read-only `Project` surface is implemented:
 * `runWorkspaceScript`, `runScriptAcrossWorkspaces`,
 * `determineAffectedWorkspaces`, `runAffectedWorkspaceScript`, and
 * `verify` live on {@link FileSystemProject} only. The constructor
 * shape and supported feature set may change in a future release.
 */
export type MemoryProject = Simplify<InstanceType<typeof _MemoryProject>>;

/**
 * Create a {@link Project} from a provided list of workspace objects.
 * Mainly used for testing without needing a real file system project.
 *
 * @experimental See {@link MemoryProject} for the current coverage and
 * planned changes.
 *
 * @example
 * import { createMemoryProject } from "pacwich";
 *
 * const project = createMemoryProject({
 *   packageManager: "bun",
 *   workspaces: [
 *     {
 *       name: "core",
 *       isRoot: false,
 *       path: "packages/core",
 *       matchPattern: "packages/*",
 *       scripts: ["build"],
 *       aliases: [],
 *       tags: [],
 *       dependencies: [],
 *       dependents: [],
 *       externalDependencies: [],
 *     },
 *   ],
 * });
 */
export const createMemoryProject = (
  options: CreateMemoryProjectOptions,
): MemoryProject => new _MemoryProject(options);
