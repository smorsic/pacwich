import { defineErrors } from "../../../internal/core";

export const NPM_ERRORS = defineErrors(
  "NpmLockNotFound",
  "MalformedNpmLock",
  "UnsupportedNpmLockVersion",
);
