import { expect } from "bun:test";
import { type WorkspaceConfig } from "bw-common/config";
import type { Workspace } from "../../src";
import { resolveWorkspaceConfig } from "../../src/config";
import type { WorkspaceMap } from "../../src/workspaces/dependencyGraph";
import { withWindowsPath } from "./windows";

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
  path: withWindowsPath(data.path ?? ""),
});

export const makeWorkspaceMapEntry = (
  config: WorkspaceConfig,
): WorkspaceMap[string] => ({
  workspace: expect.any(Object),
  config: resolveWorkspaceConfig(config),
  packageJson: expect.any(Object),
});
