import type {
  ResolvedWorkspaceConfig,
  RawWorkspace,
  WorkspacePatternConfigEntry,
} from "@pacwich/common/config";
import { mergeWorkspaceConfig, resolveWorkspaceConfig } from "../config";
import type { WorkspaceMap } from "./dependencyGraph";
import type { Workspace } from "./workspace";
import { matchWorkspacesByPatterns } from "./workspacePattern";

const resolvedToWorkspaceConfig = ({
  aliases,
  tags,
  scripts,
  rules,
  defaultInputs,
}: ResolvedWorkspaceConfig) => ({
  alias: aliases,
  tags,
  scripts,
  rules,
  ...(defaultInputs && { defaultInputs }),
});

const makeContext = (workspace: Workspace): RawWorkspace => ({
  name: workspace.name,
  isRoot: workspace.isRoot,
  path: workspace.path,
  matchPattern: workspace.matchPattern,
  scripts: workspace.scripts,
  dependencies: workspace.dependencies,
  dependents: workspace.dependents,
});

export const applyWorkspacePatternConfigs = (
  workspaces: Workspace[],
  workspaceMap: WorkspaceMap,
  workspaceAliases: Record<string, string>,
  patternConfigs: WorkspacePatternConfigEntry[],
  rootWorkspace: Workspace,
): void => {
  for (const entry of patternConfigs) {
    const matched = matchWorkspacesByPatterns(
      entry.patterns,
      workspaces,
      rootWorkspace,
    );

    for (const workspace of matched) {
      const mapEntry = workspaceMap[workspace.name];
      const prevConfig = mapEntry.config;

      const configToMerge =
        typeof entry.config === "function"
          ? entry.config(makeContext(workspace), prevConfig)
          : entry.config;

      const resolved = resolveWorkspaceConfig(
        mergeWorkspaceConfig(
          resolvedToWorkspaceConfig(prevConfig),
          configToMerge,
        ),
      );

      // Register any new aliases for validation
      const previousAliases = new Set(workspace.aliases);
      for (const alias of resolved.aliases) {
        if (!previousAliases.has(alias)) {
          workspaceAliases[alias] = workspace.name;
        }
      }

      // Update workspace object so subsequent pattern entries see accumulated aliases/tags
      workspace.aliases = resolved.aliases;
      workspace.tags = resolved.tags;

      mapEntry.config = resolved;
    }
  }
};
