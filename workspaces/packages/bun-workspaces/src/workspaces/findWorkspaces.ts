import fs from "fs";
import path from "path";
import bun from "bun";
import type { WorkspacePatternConfigEntry } from "bw-common/config";
import { createDefaultWorkspaceConfig, loadWorkspaceConfig } from "../config";
import { BUN_LOCK_ERRORS, readBunLockfile } from "../internal/bun";
import { BunWorkspacesError } from "../internal/core";
import { logger } from "../internal/logger/logger";
import { applyWorkspacePatternConfigs } from "./applyWorkspacePatternConfigs";
import {
  resolveWorkspaceDependencies,
  validateWorkspaceDependencyRules,
  type WorkspaceMap,
} from "./dependencyGraph";
import { WORKSPACE_ERRORS } from "./errors";
import {
  resolvePackageJsonContent,
  resolvePackageJsonPath,
  type BunCatalogSet,
} from "./packageJson";
import type { Workspace } from "./workspace";

export interface FindWorkspacesOptions {
  rootDirectory: string;
  /** If provided, will override the workspaces found in the package.json. Mainly for testing purposes */
  workspaceGlobs?: string[];
  /** Whether to include the root workspace as a normal workspace.*/
  includeRootWorkspace?: boolean;
  /** Workspace pattern config entries from the root config to apply after local configs are loaded. */
  workspacePatternConfigs?: WorkspacePatternConfigEntry[];
}

export const sortWorkspaces = (workspaces: Workspace[]) =>
  [...workspaces]
    .sort((a, b) =>
      a.isRoot
        ? -1
        : a.path.localeCompare(b.path) || a.name.localeCompare(b.name),
    )
    .reduce<Workspace[]>((acc, workspace, i, arr) => {
      const previousWorkspace = arr[i - 1];
      if (previousWorkspace && previousWorkspace.path === workspace.path) {
        return acc;
      }
      return [...acc, workspace];
    }, []);

const getRootPackageJsonWorkspaceData = ({
  rootDirectory,
}: {
  rootDirectory: string;
}) => {
  const packageJsonPath = path.join(rootDirectory, "package.json");
  if (!fs.existsSync(packageJsonPath)) {
    throw new WORKSPACE_ERRORS.PackageNotFound(
      `No package.json found for project root at ${packageJsonPath}`,
    );
  }

  const { workspaces, catalog, catalogs } = resolvePackageJsonContent(
    packageJsonPath,
    rootDirectory,
    ["workspaces"],
  );

  return { workspaceGlobs: workspaces ?? [], catalog, catalogs };
};

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

export const findWorkspaces = ({
  rootDirectory,
  workspaceGlobs: _workspaceGlobs,
  includeRootWorkspace = false,
  workspacePatternConfigs,
}: FindWorkspacesOptions) => {
  rootDirectory = path.resolve(rootDirectory);

  logger.debug(`Finding workspaces in ${rootDirectory}`);

  let workspaces: Workspace[] = [];

  const workspaceMap: WorkspaceMap = {};

  logger.debug(`Reading bun.lock`);
  const bunLock = readBunLockfile(rootDirectory);

  if (bunLock instanceof BunWorkspacesError) {
    if (bunLock instanceof BUN_LOCK_ERRORS.BunLockNotFound) {
      bunLock.message =
        `No bun.lock found at ${rootDirectory}. Check that this is the directory of your project and that you've ran 'bun install'.` +
        " If you have ran 'bun install', you may simply have no workspaces or dependencies in your project.";
    }
    throw bunLock;
  }

  const { workspaceGlobs, catalog, catalogs } = _workspaceGlobs
    ? { workspaceGlobs: _workspaceGlobs, catalog: {}, catalogs: {} }
    : getRootPackageJsonWorkspaceData({ rootDirectory });

  const bunCatalogs: BunCatalogSet = {
    defaultCatalog: catalog,
    namedCatalogs: catalogs,
  };

  let rootWorkspace: Workspace | undefined;

  const workspaceAliases: Record<string, string> = {};

  for (const workspacePath of Object.keys(bunLock.workspaces).map((p) =>
    path.join(rootDirectory, p),
  )) {
    const packageJsonPath = resolvePackageJsonPath(workspacePath);
    if (packageJsonPath) {
      const packageJsonContent = resolvePackageJsonContent(
        packageJsonPath,
        rootDirectory,
        ["name", "scripts"],
      );

      const workspaceConfig = loadWorkspaceConfig(
        path.dirname(packageJsonPath),
      );

      if (workspaceConfig) {
        for (const alias of workspaceConfig.aliases) {
          workspaceAliases[alias] = packageJsonContent.name;
        }
      }

      const relativePath = path.relative(
        rootDirectory,
        path.dirname(packageJsonPath),
      );

      const matchPattern =
        workspaceGlobs.find((glob) =>
          new bun.Glob(glob.replace(/\/+$/, "")).match(relativePath),
        ) ?? "";

      const isRootWorkspace = workspacePath === rootDirectory;

      if (!matchPattern && !isRootWorkspace) {
        logger.debug(`No match pattern found for ${relativePath}`);
      }

      const workspace: Workspace = {
        name: packageJsonContent.name ?? "",
        isRoot: isRootWorkspace,
        matchPattern: workspacePath === rootDirectory ? "" : matchPattern,
        path: path.relative(rootDirectory, path.dirname(packageJsonPath)),
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

  workspaces = sortWorkspaces(
    resolveWorkspaceDependencies(
      workspaceMap,
      includeRootWorkspace,
      bunCatalogs,
    ),
  );

  if (workspacePatternConfigs?.length) {
    applyWorkspacePatternConfigs(
      workspaces,
      workspaceMap,
      workspaceAliases,
      workspacePatternConfigs,
    );
  }

  validateWorkspaceDependencyRules({ workspaceMap });

  validateWorkspaceAliases(workspaces, workspaceAliases, rootWorkspace.name);

  logger.debug(
    `Found ${workspaces.length} workspaces: ${workspaces.map((ws) => ws.name).join(", ")}`,
  );

  return { workspaces, workspaceMap, rootWorkspace };
};

export const validateWorkspaceAliases = (
  workspaces: Workspace[],
  workspaceAliases: Record<string, string>,
  rootWorkspaceName: string,
) => {
  for (const [alias, name] of Object.entries(workspaceAliases ?? {})) {
    if (workspaces.find((ws) => ws.name === alias)) {
      throw new WORKSPACE_ERRORS.AliasConflict(
        `Alias ${JSON.stringify(alias)} conflicts with workspace name ${JSON.stringify(name)}`,
      );
    }
    const workspaceWithDuplicateAlias = workspaces.find(
      (ws) => ws.name !== name && ws.aliases.includes(alias),
    );
    if (workspaceWithDuplicateAlias) {
      throw new WORKSPACE_ERRORS.AliasConflict(
        `Workspaces ${JSON.stringify(name)} and ${JSON.stringify(workspaceWithDuplicateAlias.name)} have the same alias ${JSON.stringify(alias)}`,
      );
    }
    if (
      !workspaces.find((ws) => ws.name === name) &&
      name !== rootWorkspaceName
    ) {
      throw new WORKSPACE_ERRORS.AliasedWorkspaceNotFound(
        `Workspace ${JSON.stringify(name)} was aliased by ${JSON.stringify(
          alias,
        )} but was not found`,
      );
    }
  }
};
