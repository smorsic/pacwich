import path from "path";
import { ROOT_WORKSPACE_SELECTOR } from "@pacwich/common/project";
import {
  WORKSPACE_PATTERN_TARGETS,
  type WorkspacePatternTarget,
} from "@pacwich/common/workspaces";
import { defineErrors, createWildcardRegex } from "../internal/core";
import type { Workspace } from "./workspace";

const TARGETS = WORKSPACE_PATTERN_TARGETS;

/** Errors thrown when a workspace pattern string is malformed (bad
 * prefix, missing value, etc.). Subclass of {@link PacwichError}. */
export const WORKSPACE_PATTERN_ERRORS = defineErrors("InvalidWorkspacePattern");

export type WorkspacePattern = {
  target: WorkspacePatternTarget | "default";
  value: string;
  isNegated: boolean;
  isRegex: boolean;
  isRootSelector: boolean;
};

export const WORKSPACE_PATTERN_NEGATION_PREFIX = "not:";

export const WORKSPACE_PATTERN_NEGATION_SHORT_PREFIX = "!";

export const WORKSPACE_PATTERN_NEGATION_PREFIXES = [
  WORKSPACE_PATTERN_NEGATION_PREFIX,
  WORKSPACE_PATTERN_NEGATION_SHORT_PREFIX,
] as const;

export const WORKSPACE_PATTERN_SEPARATOR = ":";

export const WORKSPACE_PATTERN_REGEX_PREFIX = "re:";

const validateRegexSource = (source: string, originalPattern: string) => {
  try {
    new RegExp(source);
  } catch (cause) {
    throw new WORKSPACE_PATTERN_ERRORS.InvalidWorkspacePattern(
      `Invalid regex in workspace pattern "${originalPattern}": ${
        (cause as Error).message
      }`,
    );
  }
};

export const parseWorkspacePattern = (pattern: string): WorkspacePattern => {
  const negationPrefix = WORKSPACE_PATTERN_NEGATION_PREFIXES.find((prefix) =>
    pattern.startsWith(prefix),
  );

  const isNegated = !!negationPrefix;

  const afterNegation = negationPrefix
    ? pattern.slice(negationPrefix.length)
    : pattern;

  // The "@root" selector resolves to the project's root workspace. Recognized
  // immediately after optional negation, so "not:@root" / "!@root" also work.
  // A target-scoped value of "@root" (e.g. "name:@root") is treated as a literal,
  // not a root selector.
  if (afterNegation === ROOT_WORKSPACE_SELECTOR) {
    return {
      target: "default",
      value: ROOT_WORKSPACE_SELECTOR,
      isNegated,
      isRegex: false,
      isRootSelector: true,
    };
  }

  // "re:" before any target consumes the rest as a regex against the default target.
  // e.g. "re:path:foo" → default-target regex over literal source "path:foo".
  if (afterNegation.startsWith(WORKSPACE_PATTERN_REGEX_PREFIX)) {
    const value = afterNegation.slice(WORKSPACE_PATTERN_REGEX_PREFIX.length);
    validateRegexSource(value, pattern);
    return {
      target: "default",
      value,
      isNegated,
      isRegex: true,
      isRootSelector: false,
    };
  }

  const target = TARGETS.find((target) =>
    afterNegation.startsWith(target + WORKSPACE_PATTERN_SEPARATOR),
  );

  if (!target) {
    return {
      target: "default",
      value: afterNegation,
      isNegated,
      isRegex: false,
      isRootSelector: false,
    };
  }

  const afterTarget = afterNegation.slice(
    target.length + WORKSPACE_PATTERN_SEPARATOR.length,
  );

  if (afterTarget.startsWith(WORKSPACE_PATTERN_REGEX_PREFIX)) {
    const value = afterTarget.slice(WORKSPACE_PATTERN_REGEX_PREFIX.length);
    validateRegexSource(value, pattern);
    return {
      target,
      value,
      isNegated,
      isRegex: true,
      isRootSelector: false,
    };
  }

  return {
    target,
    value: afterTarget,
    isNegated,
    isRegex: false,
    isRootSelector: false,
  };
};

const PATTERN_TARGET_HANDLERS: Record<
  WorkspacePatternTarget | "default",
  (pattern: WorkspacePattern, workspaces: Workspace[]) => Workspace[]
> = {
  default: (pattern, workspaces) => {
    // Plain string at the default target matches name OR alias. Wildcard and
    // regex forms intentionally narrow to name only to avoid ambiguity. Use
    // an explicit "alias:" prefix to match aliases by wildcard/regex.
    if (pattern.isRegex) {
      const regex = new RegExp(pattern.value);
      return workspaces.filter((workspace) => regex.test(workspace.name));
    }
    if (pattern.value.includes("*")) {
      const wildcardRegex = createWildcardRegex(pattern.value);
      return workspaces.filter((workspace) =>
        wildcardRegex.test(workspace.name),
      );
    }
    return workspaces.filter(
      (workspace) =>
        workspace.name === pattern.value ||
        workspace.aliases.includes(pattern.value),
    );
  },
  name: (pattern, workspaces) => {
    if (pattern.isRegex) {
      const regex = new RegExp(pattern.value);
      return workspaces.filter((workspace) => regex.test(workspace.name));
    }
    if (pattern.value.includes("*")) {
      const wildcardRegex = createWildcardRegex(pattern.value);
      return workspaces.filter((workspace) =>
        wildcardRegex.test(workspace.name),
      );
    }
    return workspaces.filter((workspace) => workspace.name === pattern.value);
  },
  alias: (pattern, workspaces) => {
    if (pattern.isRegex) {
      const regex = new RegExp(pattern.value);
      return workspaces.filter((workspace) =>
        workspace.aliases.some((alias) => regex.test(alias)),
      );
    }
    if (pattern.value.includes("*")) {
      const wildcardRegex = createWildcardRegex(pattern.value);
      return workspaces.filter((workspace) =>
        workspace.aliases.some((alias) => wildcardRegex.test(alias)),
      );
    }
    return workspaces.filter((workspace) =>
      workspace.aliases.includes(pattern.value),
    );
  },
  path: (pattern, workspaces) => {
    if (pattern.isRegex) {
      const regex = new RegExp(pattern.value);
      return workspaces.filter((workspace) => regex.test(workspace.path));
    }
    return workspaces.filter((workspace) =>
      path.matchesGlob(workspace.path, pattern.value.replace(/\/+$/, "")),
    );
  },
  tag: (pattern, workspaces) => {
    if (pattern.isRegex) {
      const regex = new RegExp(pattern.value);
      return workspaces.filter((workspace) =>
        workspace.tags.some((tag) => regex.test(tag)),
      );
    }
    if (pattern.value.includes("*")) {
      const wildcardRegex = createWildcardRegex(pattern.value);
      return workspaces.filter((workspace) =>
        workspace.tags.some((tag) => wildcardRegex.test(tag)),
      );
    }
    return workspaces.filter((workspace) =>
      workspace.tags.includes(pattern.value),
    );
  },
};

const matchWorkspacesByPattern = (
  pattern: WorkspacePattern,
  workspaces: Workspace[],
  rootWorkspace: Workspace | undefined,
): Workspace[] => {
  if (pattern.isRootSelector) {
    return rootWorkspace ? [rootWorkspace] : [];
  }
  return PATTERN_TARGET_HANDLERS[pattern.target](pattern, workspaces);
};

export const matchWorkspacesByPatterns = (
  patterns: string[],
  workspaces: Workspace[],
  rootWorkspace?: Workspace,
) => {
  const parsedPatterns = patterns.map(parseWorkspacePattern);

  const excludePatterns = parsedPatterns.filter((pattern) => pattern.isNegated);
  const includePatterns = parsedPatterns.filter(
    (pattern) => !pattern.isNegated,
  );

  const excludeWorkspaceNameSet = new Set(
    excludePatterns.flatMap((pattern) =>
      matchWorkspacesByPattern(pattern, workspaces, rootWorkspace).map(
        (w) => w.name,
      ),
    ),
  );

  const includeWorkspaces = includePatterns.reduce<Record<string, Workspace>>(
    (acc, pattern) => {
      const matchedWorkspaces = matchWorkspacesByPattern(
        pattern,
        workspaces,
        rootWorkspace,
      );
      for (const workspace of matchedWorkspaces) {
        acc[workspace.name] = workspace;
      }
      return acc;
    },
    {},
  );

  return Object.values(includeWorkspaces).filter(
    (workspace) => !excludeWorkspaceNameSet.has(workspace.name),
  );
};
