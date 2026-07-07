import type {
  DependencyPatternRule,
  DependencySource,
} from "@pacwich/common/config";
import { WORKSPACE_ERRORS } from "../errors";
import type { ResolvedPackageJsonContent } from "../packageJson";
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

/**
 * The workspace's direct dependencies declared in a specific `package.json`
 * field, restricted to those resolved as workspace deps. These are the roots
 * from which a `bySource` rule walks (root plus its transitive subtree).
 */
const getDirectWorkspaceDepsForSource = (
  workspace: Workspace,
  packageJson: ResolvedPackageJsonContent,
  source: DependencySource,
): string[] => {
  const declared = packageJson[source] ?? {};
  return workspace.dependencies.filter((depName) => depName in declared);
};

/**
 * Collect the in-scope deps for a `bySource` rule: each root plus its full
 * transitive subtree, deduped across roots so a shared dependency is only
 * reported once for this field.
 */
const collectScopedDeps = (
  workspaceName: string,
  roots: string[],
  workspaceMap: WorkspaceMap,
): DepEntry[] => {
  const visited = new Set<string>([workspaceName]);
  const result: DepEntry[] = [];
  for (const root of roots) {
    if (visited.has(root)) continue;
    visited.add(root);
    const chain = [workspaceName, root];
    result.push({ name: root, chain });
    result.push(...getTransitiveDeps(root, workspaceMap, chain, visited));
  }
  return result;
};

type CollectViolationsOptions = {
  workspaceName: string;
  rule: DependencyPatternRule;
  depEntries: DepEntry[];
  workspaceMap: WorkspaceMap;
  rootWorkspace: Workspace;
  /** Appended after "rule" in the message, e.g. " for devDependencies". */
  scopeLabel: string;
};

const collectViolations = ({
  workspaceName,
  rule,
  depEntries,
  workspaceMap,
  rootWorkspace,
  scopeLabel,
}: CollectViolationsOptions): string[] => {
  const violations: string[] = [];

  for (const { name: depName, chain } of depEntries) {
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
          `"${workspaceName}" violates workspaceDependencies rule${scopeLabel}: workspace "${depName}" is not permitted by allowPatterns (dependency chain: ${chainStr})`,
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
          `"${workspaceName}" violates workspaceDependencies rule${scopeLabel}: workspace "${depName}" is denied by denyPatterns (dependency chain: ${chainStr})`,
        );
      }
    }
  }

  return violations;
};

const hasPatterns = (rule: DependencyPatternRule | undefined): boolean =>
  Boolean(rule?.allowPatterns || rule?.denyPatterns);

export type ValidateWorkspaceDependencyRulesOptions = {
  workspaceMap: WorkspaceMap;
  rootWorkspace: Workspace;
};

export const validateWorkspaceDependencyRules = ({
  workspaceMap,
  rootWorkspace,
}: ValidateWorkspaceDependencyRulesOptions): void => {
  const violations: string[] = [];

  for (const [
    workspaceName,
    { config, workspace, packageJson },
  ] of Object.entries(workspaceMap)) {
    const rule = config.rules?.workspaceDependencies;
    if (!rule) continue;

    // Top-level rule: applies to every transitive dependency.
    if (hasPatterns(rule)) {
      const transitiveDeps = getTransitiveDeps(
        workspaceName,
        workspaceMap,
        [workspaceName],
        new Set([workspaceName]),
      );
      violations.push(
        ...collectViolations({
          workspaceName,
          rule,
          depEntries: transitiveDeps,
          workspaceMap,
          rootWorkspace,
          scopeLabel: "",
        }),
      );
    }

    // Field-scoped rules: apply to the direct deps declared in that field
    // plus everything those deps pull in transitively, so a forbidden
    // workspace cannot leak in through a permitted field-scoped dependency.
    if (rule.bySource) {
      for (const source of Object.keys(rule.bySource) as DependencySource[]) {
        const sourceRule = rule.bySource[source];
        if (!sourceRule || !hasPatterns(sourceRule)) continue;

        const roots = getDirectWorkspaceDepsForSource(
          workspace,
          packageJson,
          source,
        );
        if (roots.length === 0) continue;

        violations.push(
          ...collectViolations({
            workspaceName,
            rule: sourceRule,
            depEntries: collectScopedDeps(workspaceName, roots, workspaceMap),
            workspaceMap,
            rootWorkspace,
            scopeLabel: ` for ${source}`,
          }),
        );
      }
    }
  }

  if (violations.length > 0) {
    throw new WORKSPACE_ERRORS.DependencyRuleViolation(
      `Workspace dependency rule violations:\n${violations.map((v) => `  - ${v}`).join("\n")}`,
    );
  }
};
