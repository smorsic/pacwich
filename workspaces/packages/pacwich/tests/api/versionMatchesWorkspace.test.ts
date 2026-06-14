import { versionMatchesWorkspace } from "../../src/packageManager";
import { describe, expect, test } from "../util/testFramework";

/**
 * Shared semver-matching helper used by both bun and npm adapters'
 * `isDependencyVersionWorkspaceFallback` hooks. Mirrors install-time behavior of
 * both PMs (see `ignore-me/pm-experiments/FINDINGS.md`).
 */
describe("versionMatchesWorkspace", () => {
  test("'*' always matches, even when the workspace has no version", () => {
    expect(
      versionMatchesWorkspace({
        rawVersion: "*",
        workspaceVersion: "1.0.0",
      }),
    ).toBe(true);
    expect(
      versionMatchesWorkspace({
        rawVersion: "*",
        workspaceVersion: undefined,
      }),
    ).toBe(true);
  });

  test("non-'*' range returns false when workspace has no version", () => {
    expect(
      versionMatchesWorkspace({
        rawVersion: "1.0.0",
        workspaceVersion: undefined,
      }),
    ).toBe(false);
    expect(
      versionMatchesWorkspace({
        rawVersion: "^1.0.0",
        workspaceVersion: undefined,
      }),
    ).toBe(false);
  });

  test("returns true when the workspace version satisfies the range", () => {
    expect(
      versionMatchesWorkspace({
        rawVersion: "1.0.0",
        workspaceVersion: "1.0.0",
      }),
    ).toBe(true);
    expect(
      versionMatchesWorkspace({
        rawVersion: "^1.0.0",
        workspaceVersion: "1.2.3",
      }),
    ).toBe(true);
    expect(
      versionMatchesWorkspace({
        rawVersion: "~1.2.0",
        workspaceVersion: "1.2.3",
      }),
    ).toBe(true);
    expect(
      versionMatchesWorkspace({
        rawVersion: ">=1.0.0 <2.0.0",
        workspaceVersion: "1.5.0",
      }),
    ).toBe(true);
  });

  test("returns false when the workspace version does NOT satisfy the range", () => {
    expect(
      versionMatchesWorkspace({
        rawVersion: "^2.0.0",
        workspaceVersion: "1.0.0",
      }),
    ).toBe(false);
    expect(
      versionMatchesWorkspace({
        rawVersion: "1.0.0",
        workspaceVersion: "1.0.1",
      }),
    ).toBe(false);
  });

  test("returns false for ranges semver can't parse (e.g. workspace:* style strings)", () => {
    // Adapter-level callers handle `workspace:` prefixed strings
    // BEFORE delegating to this helper; the helper itself should
    // simply return false for anything semver rejects.
    expect(
      versionMatchesWorkspace({
        rawVersion: "workspace:*",
        workspaceVersion: "1.0.0",
      }),
    ).toBe(false);
    expect(
      versionMatchesWorkspace({
        rawVersion: "garbage range",
        workspaceVersion: "1.0.0",
      }),
    ).toBe(false);
  });
});
