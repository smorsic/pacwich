export type {
  RootConfig,
  ResolvedRootConfig,
  WorkspaceConfig,
  WorkspaceDependenciesRule,
  ResolvedWorkspaceConfig,
  WorkspaceRules,
  WorkspaceInputsConfig,
  ScriptConfig,
  RawWorkspace,
  WorkspacePatternConfigFactory,
  WorkspacePatternConfigEntry,
} from "bw-common/config";
export { defineRootConfig } from "./rootConfig/defineRootConfig";
export {
  mergeRootConfig,
  type RootConfigFactory,
  type RootConfigInput,
} from "./rootConfig/mergeRootConfig";
export { defineWorkspaceConfig } from "./workspaceConfig/defineWorkspaceConfig";
export {
  mergeWorkspaceConfig,
  type WorkspaceConfigFactory,
  type WorkspaceConfigInput,
} from "./workspaceConfig/mergeWorkspaceConfig";
