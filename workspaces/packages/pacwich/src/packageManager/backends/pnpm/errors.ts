import { defineErrors } from "../../../internal/core";

export const PNPM_ERRORS = defineErrors(
  "PnpmLockNotFound",
  "MalformedPnpmLock",
  "UnsupportedPnpmLockVersion",
  "MalformedPnpmWorkspaceYaml",
);
