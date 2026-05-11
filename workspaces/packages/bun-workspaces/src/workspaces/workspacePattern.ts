import bun from "bun";
import {
  WORKSPACE_PATTERN_TARGETS,
  type WorkspacePatternTarget,
} from "bw-common/workspaces";
import { defineErrors, createWildcardRegex } from "../internal/core";
import type { Workspace } from "./workspace";

const TARGETS = WORKSPACE_PATTERN_TARGETS;

export const WORKSPACE_PATTERN_ERRORS = defineErrors("InvalidWorkspacePattern");

export type WorkspacePattern = {
  target: WorkspacePatternTarget | "default";
  value: string;
  isNegated: boolean;
  isRegex: boolean;
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
    };
  }

  return {
    target,
    value: afterTarget,
    isNegated,
    isRegex: false,
  };
};

const PATTERN_TARGET_HANDLERS: Record<
  WorkspacePatternTarget | "default",
  (pattern: WorkspacePattern, workspaces: Workspace[]) => Workspace[]
> = {
  default: (pattern, workspaces) => {
    if (pattern.isRegex) {
      const regex = new RegExp(pattern.value);
      return workspaces.filter(
        (workspace) =>
          regex.test(workspace.name) ||
          workspace.aliases.some((alias) => regex.test(alias)),
      );
    }
    if (pattern.value.includes("*")) {
      const wildcardRegex = createWildcardRegex(pattern.value);
      return workspaces.filter(
        (workspace) =>
          wildcardRegex.test(workspace.name) ||
          workspace.aliases.some((alias) => wildcardRegex.test(alias)),
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
      new bun.Glob(pattern.value.replace(/\/+$/, "")).match(workspace.path),
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
) => PATTERN_TARGET_HANDLERS[pattern.target](pattern, workspaces);

export const matchWorkspacesByPatterns = (
  patterns: string[],
  workspaces: Workspace[],
) => {
  const parsedPatterns = patterns.map(parseWorkspacePattern);

  const excludePatterns = parsedPatterns.filter((pattern) => pattern.isNegated);
  const includePatterns = parsedPatterns.filter(
    (pattern) => !pattern.isNegated,
  );

  const excludeWorkspaces = excludePatterns.flatMap((pattern) =>
    matchWorkspacesByPattern(pattern, workspaces),
  );

  const includeWorkspaces = includePatterns.flatMap((pattern) =>
    matchWorkspacesByPattern(pattern, workspaces),
  );

  return includeWorkspaces.filter(
    (workspace, index, arr) =>
      !excludeWorkspaces.some(
        (excludeWorkspace) => excludeWorkspace.name === workspace.name,
      ) &&
      !arr
        .slice(index + 1)
        .some((nextWorkspace) => nextWorkspace.name === workspace.name),
  );
};
