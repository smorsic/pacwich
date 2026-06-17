import { type WorkspaceConfig } from "@pacwich/common/config";
import type { Workspace } from "../../src";
import { resolveWorkspaceConfig } from "../../src/config";
import type { WorkspaceMap } from "../../src/workspaces/dependencyGraph";
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

export const makeWorkspaceMapEntry = (
  config: WorkspaceConfig,
  workspace = expect.any(Object),
): WorkspaceMap[string] => ({
  workspace,
  config: resolveWorkspaceConfig(config),
  packageJson: expect.any(Object),
});
