import { defineErrors } from "../internal/core";

export const PROJECT_ERRORS = defineErrors(
  "ProjectWorkspaceNotFound",
  "WorkspaceScriptDoesNotExist",
  "RecursiveWorkspaceScript",
);
