import { WORKSPACE_ERRORS } from "./errors";
import type { Workspace } from "./workspace";

/**
 * Cross-workspace alias validation. Throws on:
 *   - alias collisions with workspace names,
 *   - alias collisions across workspaces,
 *   - aliases pointing at workspaces that don't exist (except the root).
 *
 * The `workspaceAliases` map is keyed by alias → owning workspace name.
 */
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
