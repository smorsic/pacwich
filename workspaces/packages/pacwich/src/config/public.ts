export type {
  ProjectConfig,
  ResolvedProjectConfig,
  ProjectVerifyConfig,
  ProjectVerifyWorkspaceDependenciesConfig,
  ResolvedProjectVerifyConfig,
  ResolvedProjectVerifyWorkspaceDependenciesConfig,
  WorkspaceConfig,
  WorkspaceDependenciesRule,
  DependencyPatternRule,
  DependencySource,
  ResolvedWorkspaceConfig,
  WorkspaceRules,
  WorkspaceInputsConfig,
  ScriptConfig,
  RawWorkspace,
  WorkspacePatternConfigFactory,
  WorkspacePatternConfigEntry,
} from "@pacwich/common/config";
// Parameter value types referenced by the config field types above
// (e.g. `ProjectConfig.defaults.parallelMax` / `.shell`,
// `ResolvedProjectConfig.defaults.cliScriptOutputStyle`), re-exported so
// they remain importable from the `pacwich/config` entry point.
export type {
  PercentageValue,
  ParallelMaxValue,
  ScriptShellOption,
  ShellOption,
  OutputStyleName,
} from "@pacwich/common/parameters";
export { defineProjectConfig } from "./projectConfig/defineProjectConfig";
export {
  mergeProjectConfig,
  type ProjectConfigFactory,
  type ProjectConfigInput,
} from "./projectConfig/mergeProjectConfig";
export { defineWorkspaceConfig } from "./workspaceConfig/defineWorkspaceConfig";
export {
  mergeWorkspaceConfig,
  type WorkspaceConfigFactory,
  type WorkspaceConfigInput,
} from "./workspaceConfig/mergeWorkspaceConfig";
export * from "./deprecations";
