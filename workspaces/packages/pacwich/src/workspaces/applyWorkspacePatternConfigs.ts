import type {
  ResolvedWorkspaceConfig,
  RawWorkspace,
  WorkspacePatternConfigEntry,
} from "@pacwich/common/config";
import { mergeWorkspaceConfig, resolveWorkspaceConfig } from "../config";
import { isPacwichError, prefixPacwichErrorMessage } from "../internal/core";
import type { WorkspaceMap } from "./dependencyGraph";
import { WORKSPACE_ERRORS } from "./errors";
import type { Workspace } from "./workspace";
import { matchWorkspacesByPatterns } from "./workspacePattern";

const resolvedToWorkspaceConfig = ({
  aliases,
  tags,
  scripts,
  rules,
  defaultInputs,
  verify,
}: ResolvedWorkspaceConfig) => ({
  alias: aliases,
  tags,
  scripts,
  rules,
  ...(defaultInputs && { defaultInputs }),
  verify,
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
  projectConfigPath?: string,
): void => {
  patternConfigs.forEach((entry, entryIndex) => {
    const matched = matchWorkspacesByPatterns(
      entry.patterns,
      workspaces,
      rootWorkspace,
    );

    for (const workspace of matched) {
      const mapEntry = workspaceMap[workspace.name];
      const prevConfig = mapEntry.config;

      let resolved: ResolvedWorkspaceConfig;
      try {
        const configToMerge =
          typeof entry.config === "function"
            ? entry.config(makeContext(workspace), prevConfig)
            : entry.config;

        resolved = resolveWorkspaceConfig(
          mergeWorkspaceConfig(
            resolvedToWorkspaceConfig(prevConfig),
            configToMerge,
          ),
        );
      } catch (error) {
        const prefix = `${projectConfigPath ?? "project config"}: workspacePatternConfigs[${entryIndex}] (workspace ${JSON.stringify(workspace.name)})`;
        if (isPacwichError(error)) {
          throw prefixPacwichErrorMessage(error, prefix);
        }
        // Non-Pacwich throws (e.g. a bug in a user's factory function)
        // would otherwise lose the entry/workspace context entirely
        throw new WORKSPACE_ERRORS.WorkspacePatternConfigError(
          `${prefix}: ${(error as Error).message}`,
        );
      }

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
  });
};
