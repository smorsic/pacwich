import { defineErrors } from "../internal/core";

export const WORKSPACE_ERRORS = defineErrors(
  "PackageNotFound",
  "InvalidPackageJson",
  "DuplicateWorkspaceName",
  "InvalidWorkspaceName",
  "NoWorkspaceName",
  "InvalidScripts",
  "InvalidWorkspaces",
  "InvalidWorkspacePattern",
  "AliasConflict",
  "AliasedWorkspaceNotFound",
  "RootWorkspaceNotFound",
  "DependencyRuleViolation",
);
