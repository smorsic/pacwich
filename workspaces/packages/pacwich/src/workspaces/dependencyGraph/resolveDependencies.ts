import type { ResolvedWorkspaceConfig } from "@pacwich/common/config";
import type {
  CatalogSet,
  PackageManagerAdapter,
  WorkspaceLinkResolver,
} from "../../packageManager/adapter";
import type { ResolvedPackageJsonContent } from "../packageJson";
import type {
  ExternalDependency,
  ExternalDependencyCatalog,
  ExternalDependencySource,
  Workspace,
} from "../workspace";

export type WorkspaceMap = {
  [workspaceName: string]: {
    workspace: Workspace;
    config: ResolvedWorkspaceConfig;
    packageJson: ResolvedPackageJsonContent;
  };
};

type ExternalDependencyAccumulator = {
  source: ExternalDependencySource;
  version: string;
  catalog?: ExternalDependencyCatalog;
};

const EMPTY_CATALOG_SET: CatalogSet = {
  defaultCatalog: {},
  namedCatalogs: {},
};

export const resolveWorkspaceDependencies = (
  workspaceMap: WorkspaceMap,
  includeRootWorkspace: boolean,
  adapter: PackageManagerAdapter,
  catalogs: CatalogSet = EMPTY_CATALOG_SET,
  /**
   * Lockfile-derived workspace-link classifier. When present, it is the
   * authoritative source of truth for whether a dep resolved to a local
   * workspace; the static `adapter.isDependencyVersionWorkspaceFallback` heuristic is
   * consulted only for pairs the lockfile reports as `"unknown"`.
   */
  workspaceLinks: WorkspaceLinkResolver | null = null,
): Workspace[] => {
  const workspacePackages = Object.values(workspaceMap).filter(
    ({ workspace }) => includeRootWorkspace || !workspace.isRoot,
  );

  const workspacesWithDependencies = workspacePackages.map(
    ({ workspace, packageJson }) => {
      const externalAccumulator = new Map<
        string,
        ExternalDependencyAccumulator
      >();
      const dependencyMaps: {
        map: Record<string, string>;
        source: ExternalDependencySource;
      }[] = [
        { map: packageJson.dependencies, source: "dependencies" },
        { map: packageJson.devDependencies, source: "devDependencies" },
        { map: packageJson.peerDependencies, source: "peerDependencies" },
        {
          map: packageJson.optionalDependencies,
          source: "optionalDependencies",
        },
      ];
      for (const { map, source } of dependencyMaps) {
        for (const [dependencyName, dependencyVersion] of Object.entries(map)) {
          const catalogRef = adapter.resolveCatalogReference({
            packageName: dependencyName,
            rawVersion: dependencyVersion,
            catalogs,
          });
          const catalog = catalogRef?.catalog;
          const resolvedVersion = catalogRef
            ? catalogRef.version || dependencyVersion
            : dependencyVersion;
          const matchedWorkspace = workspaceMap[dependencyName];
          const candidateWorkspace = matchedWorkspace
            ? {
                name: matchedWorkspace.workspace.name,
                version: matchedWorkspace.packageJson.version,
              }
            : null;
          // Lockfile verdict wins when known; otherwise fall back to the
          // adapter's static heuristic. A `"link"` verdict still requires
          // a matched workspace to push an edge to (the lockfile could
          // name a workspace not discovered here — falling back is safe).
          const linkVerdict =
            workspaceLinks?.classify({
              workspacePath: workspace.path,
              depName: dependencyName,
            }) ?? "unknown";
          const isWorkspaceDep =
            linkVerdict === "link"
              ? candidateWorkspace !== null
              : linkVerdict === "external"
                ? false
                : adapter.isDependencyVersionWorkspaceFallback({
                    depName: dependencyName,
                    rawVersion: resolvedVersion,
                    candidateWorkspace,
                  });
          if (isWorkspaceDep) {
            workspace.dependencies.push(dependencyName);
            // candidateWorkspace is non-null when the hook returns true
            // (per the adapter contract).
            matchedWorkspace.workspace.dependents.push(workspace.name);
            continue;
          }
          // External dep, record. Source precedence: a non-`devDependencies`
          // source overrides `devDependencies`. Otherwise the first source
          // seen wins. Version/catalog reflect the last entry seen for the name.
          const existing = externalAccumulator.get(dependencyName);
          if (!existing) {
            externalAccumulator.set(dependencyName, {
              source,
              version: resolvedVersion,
              catalog,
            });
          } else {
            existing.version = resolvedVersion;
            existing.catalog = catalog;
            if (
              existing.source === "devDependencies" &&
              source !== "devDependencies"
            ) {
              existing.source = source;
            }
          }
        }
      }
      workspace.externalDependencies = [...externalAccumulator.entries()]
        .map(([name, { source, version, catalog }]): ExternalDependency => {
          const entry: ExternalDependency = { name, version, source };
          if (catalog) entry.catalog = catalog;
          return entry;
        })
        .sort((a, b) => a.name.localeCompare(b.name));
      return workspace;
    },
  );

  return workspacesWithDependencies.map((workspace) => {
    workspace.dependencies = [...new Set(workspace.dependencies)].sort();
    workspace.dependents = [...new Set(workspace.dependents)].sort();
    return workspace;
  });
};
