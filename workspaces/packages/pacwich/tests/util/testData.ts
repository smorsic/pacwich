import { type WorkspaceConfig } from "@pacwich/common/config";
import type { Workspace } from "../../src";
import { resolveWorkspaceConfig } from "../../src/config";
import type { WorkspaceMap } from "../../src/workspaces/dependencyGraph";
import type { ResolvedPackageJsonContent } from "../../src/workspaces/packageJson";
import { expect } from "./testFramework";

export const makeTestWorkspace = (data: Partial<Workspace>): Workspace => ({
  name: "",
  isRoot: false,
  matchPattern: "",
  scripts: [],
  aliases: [],
  tags: [],
  dependencies: [],
  dependents: [],
  externalDependencies: [],
  ...data,
  path: data.path ?? "",
});

/**
 * Build a resolved package.json content with the four dependency-field maps
 * defaulted to empty. Useful for exercising `bySource` dependency rules, which
 * read the field a dependency was declared in.
 */
export const makeTestPackageJson = (
  data: Partial<ResolvedPackageJsonContent> = {},
): ResolvedPackageJsonContent => ({
  name: "",
  scripts: {},
  dependencies: {},
  devDependencies: {},
  peerDependencies: {},
  optionalDependencies: {},
  ...data,
});

export const makeWorkspaceMapEntry = (
  config: WorkspaceConfig,
  workspace = expect.any(Object),
  packageJson = expect.any(Object),
): WorkspaceMap[string] => ({
  workspace,
  config: resolveWorkspaceConfig(config),
  packageJson,
});
