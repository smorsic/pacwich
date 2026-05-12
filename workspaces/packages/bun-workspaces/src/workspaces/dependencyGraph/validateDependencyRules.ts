import { WORKSPACE_ERRORS } from "../errors";
import type { Workspace } from "../workspace";
import { matchWorkspacesByPatterns } from "../workspacePattern";
import type { WorkspaceMap } from "./resolveDependencies";

type DepEntry = {
  name: string;
  chain: string[];
};

const getTransitiveDeps = (
  workspaceName: string,
  workspaceMap: WorkspaceMap,
  chain: string[],
  visited: Set<string>,
): DepEntry[] => {
  const entry = workspaceMap[workspaceName];
  if (!entry) return [];

  const result: DepEntry[] = [];

  for (const depName of entry.workspace.dependencies) {
    if (visited.has(depName)) continue;
    visited.add(depName);

    const depChain = [...chain, depName];
    result.push({ name: depName, chain: depChain });
    result.push(...getTransitiveDeps(depName, workspaceMap, depChain, visited));
  }

  return result;
};

export type ValidateWorkspaceDependencyRulesOptions = {
  workspaceMap: WorkspaceMap;
  rootWorkspace: Workspace;
};

export const validateWorkspaceDependencyRules = ({
  workspaceMap,
  rootWorkspace,
}: ValidateWorkspaceDependencyRulesOptions): void => {
  const violations: string[] = [];

  for (const [workspaceName, { config }] of Object.entries(workspaceMap)) {
    const rule = config.rules?.workspaceDependencies;
    if (!rule?.allowPatterns && !rule?.denyPatterns) continue;

    const transitiveDeps = getTransitiveDeps(
      workspaceName,
      workspaceMap,
      [workspaceName],
      new Set([workspaceName]),
    );

    for (const { name: depName, chain } of transitiveDeps) {
      const depWorkspace = workspaceMap[depName]?.workspace;
      if (!depWorkspace) continue;

      const chainStr = chain.join(" -> ");

      // matchWorkspacesByPatterns can inject the root workspace when an
      // "@root" pattern is present, even if it isn't in the input universe.
      // We're only asking "does the single dep match?" so confirm by name.
      if (rule.allowPatterns) {
        const isAllowed = matchWorkspacesByPatterns(
          rule.allowPatterns,
          [depWorkspace],
          rootWorkspace,
        ).some((matched) => matched.name === depWorkspace.name);
        if (!isAllowed) {
          violations.push(
            `"${workspaceName}" violates workspaceDependencies rule: workspace "${depName}" is not permitted by allowPatterns (dependency chain: ${chainStr})`,
          );
          continue;
        }
      }

      if (rule.denyPatterns) {
        const isDenied = matchWorkspacesByPatterns(
          rule.denyPatterns,
          [depWorkspace],
          rootWorkspace,
        ).some((matched) => matched.name === depWorkspace.name);
        if (isDenied) {
          violations.push(
            `"${workspaceName}" violates workspaceDependencies rule: workspace "${depName}" is denied by denyPatterns (dependency chain: ${chainStr})`,
          );
        }
      }
    }
  }

  if (violations.length > 0) {
    throw new WORKSPACE_ERRORS.DependencyRuleViolation(
      `Workspace dependency rule violations:\n${violations.map((v) => `  - ${v}`).join("\n")}`,
    );
  }
};
