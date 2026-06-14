import semver from "../../../internal/bundledDeps/semver";

/**
 * Options for {@link versionMatchesWorkspace}.
 */
export type VersionMatchesWorkspaceOptions = {
  /**
   * The package.json dep range as the user wrote it (e.g. `"*"`,
   * `"1.0.0"`, `"^1.0.0"`, `">=1 <2"`).
   *
   * `workspace:`-prefixed strings should be handled by the caller
   * (the bun adapter accepts them, npm does not). This helper only
   * deals with vanilla semver-style ranges.
   */
  rawVersion: string;
  /**
   * The target workspace's own `package.json` `version` field, or
   * `undefined` when the workspace declares no version.
   */
  workspaceVersion: string | undefined;
};

/**
 * Decide whether a dep version range is satisfied by a target
 * workspace's own version. Mirrors how npm and bun actually resolve
 * workspace deps at install time (verified empirically against npm
 * 11.12.1 and bun 1.3.14).
 *
 *  - `rawVersion === "*"` → always true (both PMs link unconditionally,
 *    even when the workspace has no `version` field).
 *  - Workspace has no version + non-`*` range → false (both PMs fall
 *    through to registry resolution in this case).
 *  - Otherwise → `semver.satisfies(workspaceVersion, rawVersion)`. An
 *    invalid range string is caught and returns false rather than
 *    propagating the semver throw, which keeps the hook total.
 *
 * Pure: no I/O, no logger. Safe to call repeatedly.
 */
export const versionMatchesWorkspace = ({
  rawVersion,
  workspaceVersion,
}: VersionMatchesWorkspaceOptions): boolean => {
  if (rawVersion === "*") return true;
  if (!workspaceVersion) return false;
  try {
    return semver.satisfies(workspaceVersion, rawVersion);
  } catch {
    return false;
  }
};
