import { GIT_AFFECTED_ERRORS } from "./affected";
import {
  LOAD_CONFIG_ERRORS,
  PROJECT_CONFIG_ERRORS,
  WORKSPACE_CONFIG_ERRORS,
} from "./config";
import {
  RUNTIME_ERRORS,
  VALIDATE_NUMBER_ERRORS,
  VALIDATE_TYPEOF_ERRORS,
  type ErrorMap,
} from "./internal/core";
import { LOGGER_ERRORS } from "./internal/logger";
import {
  PACKAGE_MANAGER_VALUE_ERRORS,
  PACKAGE_MANAGER_VERSION_ERRORS,
} from "./packageManager";
import { BUN_LOCK_ERRORS } from "./packageManager/backends/bun";
import { NPM_ERRORS } from "./packageManager/backends/npm";
import { PNPM_ERRORS } from "./packageManager/backends/pnpm";
import { PROJECT_ERRORS } from "./project";
import { SCRIPT_SHELL_ERRORS } from "./runScript";
import { WORKSPACE_ERRORS, WORKSPACE_PATTERN_ERRORS } from "./workspaces";

/**
 * Grouped registry of pacwich's user-facing error classes. Each entry
 * is a map of error-class name to constructor so callers can use
 * `instanceof` for narrow `try`/`catch` handling.
 *
 * Provided as a single entry point so consumers don't have to import
 * each per-feature registry separately. Every entry's classes are
 * sub-classes of {@link PacwichError}, so generic
 * `instanceof PacwichError` catches still work.
 *
 * @example
 * import { PACWICH_ERRORS } from "pacwich";
 *
 * try {
 *   project.runWorkspaceScript({ workspaceNameOrAlias: "core", script: "build" });
 * } catch (err) {
 *   if (err instanceof PACWICH_ERRORS.project.WorkspaceScriptDoesNotExist) {
 *     // handle missing script
 *   }
 * }
 */
export const PACWICH_ERRORS = {
  project: PROJECT_ERRORS,
  projectConfig: PROJECT_CONFIG_ERRORS,
  workspace: WORKSPACE_ERRORS,
  workspaceConfig: WORKSPACE_CONFIG_ERRORS,
  workspacePattern: WORKSPACE_PATTERN_ERRORS,
  loadConfig: LOAD_CONFIG_ERRORS,
  packageManagerValue: PACKAGE_MANAGER_VALUE_ERRORS,
  packageManagerVersion: PACKAGE_MANAGER_VERSION_ERRORS,
  bunLock: BUN_LOCK_ERRORS,
  npm: NPM_ERRORS,
  pnpm: PNPM_ERRORS,
  gitAffected: GIT_AFFECTED_ERRORS,
  runtime: RUNTIME_ERRORS,
  logger: LOGGER_ERRORS,
  scriptShell: SCRIPT_SHELL_ERRORS,
  validateJSNumber: VALIDATE_NUMBER_ERRORS,
  validateJSType: VALIDATE_TYPEOF_ERRORS,
} as const satisfies Record<string, ErrorMap>;
