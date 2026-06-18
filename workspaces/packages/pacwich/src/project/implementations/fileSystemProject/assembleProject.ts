import fs from "fs";
import path from "path";
import type { WorkspacePatternConfigEntry } from "@pacwich/common/config";
import {
  createDefaultWorkspaceConfig,
  loadWorkspaceConfig,
} from "../../../config";
import type { LoadConfigOptions } from "../../../config/util/loadConfig";
import { toPosixPath } from "../../../internal/core";
import { logger } from "../../../internal/logger/logger";
import type { PackageManagerAdapter } from "../../../packageManager/adapter";
import { applyWorkspacePatternConfigs } from "../../../workspaces/applyWorkspacePatternConfigs";
import {
  resolveWorkspaceDependencies,
  validateWorkspaceDependencyRules,
  type WorkspaceMap,
} from "../../../workspaces/dependencyGraph";
import { WORKSPACE_ERRORS } from "../../../workspaces/errors";
import {
  readPackageJson,
  resolvePackageJsonContent,
  resolvePackageJsonPath,
} from "../../../workspaces/packageJson";
import { sortWorkspaces } from "../../../workspaces/sortWorkspaces";
import { validateWorkspaceAliases } from "../../../workspaces/validateWorkspaceAliases";
import type { Workspace } from "../../../workspaces/workspace";

export interface AssembleProjectOptions {
  rootDirectory: string;
  /** Package manager adapter that owns workspace discovery + catalog/lockfile semantics. */
  adapter: PackageManagerAdapter;
  /** If provided, overrides the workspaces declared in `package.json`. Mainly for testing. */
  workspaceGlobs?: string[];
  /** Whether to include the root workspace as a normal workspace. */
  includeRootWorkspace?: boolean;
  /** Workspace pattern config entries from the project config to apply after local configs are loaded. */
  workspacePatternConfigs?: WorkspacePatternConfigEntry[];
  /** Options forwarded to {@link loadWorkspaceConfig} for each workspace. */
  loadConfigOptions?: LoadConfigOptions;
}

const validateWorkspace = (workspace: Workspace, workspaces: Workspace[]) => {
  if (workspaces.find((ws) => ws.path === workspace.path)) {
    return false;
  }

  if (workspaces.find((ws) => ws.name === workspace.name)) {
    throw new WORKSPACE_ERRORS.DuplicateWorkspaceName(
      `Duplicate workspace name found: ${JSON.stringify(workspace.name)}`,
    );
  }

  return true;
};

const EMPTY_CATALOGS = {
  defaultCatalog: {},
  namedCatalogs: {},
} as const;

/**
 * Assemble a populated workspace list for a project on disk. Turns a root
 * directory + a package manager adapter into a fully-resolved set of
 * `Workspace` objects (with dependency edges, aliases, tags, and external
 * deps populated), plus the supporting `workspaceMap` and `rootWorkspace`.
 *
 * This is the filesystem-driven assembly path used by
 * {@link FileSystemProject}; `MemoryProject` skips it and accepts a
 * pre-built workspaces array. PM-specific concerns (lockfile reads,
 * catalog parsing, workspace-protocol detection) all flow through the
 * supplied `adapter`.
 */
export const assembleProject = ({
  rootDirectory,
  adapter,
  workspaceGlobs: _workspaceGlobs,
  includeRootWorkspace = false,
  workspacePatternConfigs,
  loadConfigOptions,
}: AssembleProjectOptions) => {
  rootDirectory = path.resolve(rootDirectory);

  logger.debug(`Assembling project workspaces in ${rootDirectory}`);

  let workspaces: Workspace[] = [];

  const workspaceMap: WorkspaceMap = {};

  const rootPackageJsonPath = path.join(rootDirectory, "package.json");
  if (!fs.existsSync(rootPackageJsonPath)) {
    throw new WORKSPACE_ERRORS.PackageNotFound(
      `No package.json found for project root at ${rootPackageJsonPath}`,
    );
  }

  const rootPackageJson = readPackageJson(rootPackageJsonPath);

  const { workspaceGlobs, catalogs } = _workspaceGlobs
    ? { workspaceGlobs: _workspaceGlobs, catalogs: EMPTY_CATALOGS }
    : adapter.loadRootMetadata({ rootDirectory, rootPackageJson });

  logger.debug(`Discovering workspace paths via ${adapter.name} adapter`);
  const { absolutePaths } = adapter.discoverWorkspacePaths({
    rootDirectory,
    workspaceGlobs,
  });

  if (absolutePaths.length <= 1 && adapter.describeMissingWorkspacesHint) {
    const hint = adapter.describeMissingWorkspacesHint({
      rootDirectory,
      rootPackageJson,
    });
    if (hint) logger.warn(hint);
  }

  let rootWorkspace: Workspace | undefined;

  const workspaceAliases: Record<string, string> = {};

  for (const workspacePath of absolutePaths) {
    const packageJsonPath = resolvePackageJsonPath(workspacePath);
    if (packageJsonPath) {
      const packageJsonContent = resolvePackageJsonContent(packageJsonPath, [
        "name",
        "scripts",
      ]);

      const workspaceConfig = loadWorkspaceConfig(
        path.dirname(packageJsonPath),
        loadConfigOptions,
      );

      if (workspaceConfig) {
        for (const alias of workspaceConfig.aliases) {
          workspaceAliases[alias] = packageJsonContent.name;
        }
      }

      const relativePath = toPosixPath(
        path.relative(rootDirectory, path.dirname(packageJsonPath)),
      );

      const matchPattern =
        workspaceGlobs.find((glob) =>
          path.matchesGlob(relativePath, glob.replace(/\/+$/, "")),
        ) ?? "";

      const isRootWorkspace = workspacePath === rootDirectory;

      if (!matchPattern && !isRootWorkspace) {
        logger.debug(`No match pattern found for ${relativePath}`);
      }

      const workspace: Workspace = {
        name: packageJsonContent.name ?? "",
        isRoot: isRootWorkspace,
        matchPattern: workspacePath === rootDirectory ? "" : matchPattern,
        path: relativePath,
        scripts: Object.keys(packageJsonContent.scripts ?? {}).sort(),
        aliases: [
          ...new Set(
            Object.entries(workspaceAliases ?? {})
              .filter(([_, value]) => value === packageJsonContent.name)
              .map(([key]) => key)
              .concat(workspaceConfig?.aliases ?? []),
          ),
        ],
        tags: workspaceConfig?.tags ?? [],
        dependencies: [],
        dependents: [],
        externalDependencies: [],
      };

      if (workspace.isRoot) {
        logger.debug(`Found root workspace: ${workspace.name}`);
        rootWorkspace = workspace;
      }

      if (validateWorkspace(workspace, workspaces)) {
        if (!workspace.isRoot || includeRootWorkspace) {
          workspaces.push(workspace);
        }
        workspaceMap[workspace.name] = {
          workspace,
          config: workspaceConfig ?? createDefaultWorkspaceConfig(),
          packageJson: packageJsonContent,
        };
      }
    }
  }

  if (!rootWorkspace) {
    throw new WORKSPACE_ERRORS.RootWorkspaceNotFound("No root workspace found");
  }

  const lockfileWorkspaceLinks =
    adapter.parseLockfileWorkspaceLinks?.({ rootDirectory }) ?? null;

  workspaces = sortWorkspaces(
    resolveWorkspaceDependencies(
      workspaceMap,
      includeRootWorkspace,
      adapter,
      catalogs,
      lockfileWorkspaceLinks,
    ),
  );

  if (workspacePatternConfigs?.length) {
    applyWorkspacePatternConfigs(
      workspaces,
      workspaceMap,
      workspaceAliases,
      workspacePatternConfigs,
      rootWorkspace,
    );
  }

  validateWorkspaceDependencyRules({ workspaceMap, rootWorkspace });

  validateWorkspaceAliases(workspaces, workspaceAliases, rootWorkspace.name);

  logger.debug(
    `Assembled ${workspaces.length} workspaces: ${workspaces.map((ws) => ws.name).join(", ")}`,
  );

  return { workspaces, workspaceMap, rootWorkspace };
};
