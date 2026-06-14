export const WORKSPACE_PATTERN_TARGETS = [
  "path",
  "alias",
  "name",
  "tag",
] as const;

export type WorkspacePatternTarget = (typeof WORKSPACE_PATTERN_TARGETS)[number];
