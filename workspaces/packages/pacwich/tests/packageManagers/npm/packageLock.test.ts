import { NPM_ERRORS } from "../../../src/packageManager/backends/npm/errors";
import {
  extractWorkspaceRelativePaths,
  parsePackageLock,
  type RelevantPackageLock,
} from "../../../src/packageManager/backends/npm/packageLock";
import { describe, expect, test } from "../../util/testFramework";

/**
 * npm-specific tests for `parsePackageLock` (the lockfile shape
 * validator) and `extractWorkspaceRelativePaths` (the workspace path
 * enumerator). Both are dependencies of the npm adapter's
 * `discoverWorkspacePaths` and `lockfile.loadCurrentVersions`.
 */
describe("parsePackageLock", () => {
  test("parses a minimal v3 lockfile", () => {
    expect(parsePackageLock('{"lockfileVersion":3,"packages":{}}')).toEqual({
      lockfileVersion: 3,
      packages: {},
    });
  });

  test("parses v2 lockfile (v2 is supported)", () => {
    const result = parsePackageLock(
      '{"lockfileVersion":2,"packages":{"":{"name":"root"}}}',
    );
    expect(result).toEqual({
      lockfileVersion: 2,
      packages: { "": { name: "root" } },
    });
  });

  test("returns UnsupportedNpmLockVersion for v1 (no top-level packages map)", () => {
    expect(parsePackageLock('{"lockfileVersion":1}')).toBeInstanceOf(
      NPM_ERRORS.UnsupportedNpmLockVersion,
    );
  });

  test("parses a newer-than-supported version leniently", () => {
    // Versions above the supported max are parsed anyway (the version is
    // clamped to the max) on the bet that the shape we read stayed
    // compatible. parsePackageLock logs a warning in this case.
    expect(parsePackageLock('{"lockfileVersion":99,"packages":{}}')).toEqual({
      lockfileVersion: 3,
      packages: {},
    });
  });

  test("returns MalformedNpmLock for missing lockfileVersion", () => {
    expect(parsePackageLock('{"packages":{}}')).toBeInstanceOf(
      NPM_ERRORS.MalformedNpmLock,
    );
  });

  test("returns MalformedNpmLock for non-number lockfileVersion", () => {
    expect(parsePackageLock('{"lockfileVersion":"3"}')).toBeInstanceOf(
      NPM_ERRORS.MalformedNpmLock,
    );
  });

  test("returns MalformedNpmLock for invalid JSON", () => {
    expect(parsePackageLock("{ not json }")).toBeInstanceOf(
      NPM_ERRORS.MalformedNpmLock,
    );
  });

  test("returns MalformedNpmLock for non-object JSON types", () => {
    expect(parsePackageLock("[]")).toBeInstanceOf(NPM_ERRORS.MalformedNpmLock);
    expect(parsePackageLock("1")).toBeInstanceOf(NPM_ERRORS.MalformedNpmLock);
    expect(parsePackageLock('"a"')).toBeInstanceOf(NPM_ERRORS.MalformedNpmLock);
  });

  test("returns MalformedNpmLock when packages is not an object", () => {
    expect(
      parsePackageLock('{"lockfileVersion":3,"packages":"oops"}'),
    ).toBeInstanceOf(NPM_ERRORS.MalformedNpmLock);
  });

  test("accepts missing packages field (defaults to empty)", () => {
    const result = parsePackageLock('{"lockfileVersion":3}');
    expect(result).toEqual({ lockfileVersion: 3, packages: {} });
  });
});

describe("extractWorkspaceRelativePaths", () => {
  const makeLock = (keys: string[]): RelevantPackageLock => ({
    lockfileVersion: 3,
    packages: Object.fromEntries(keys.map((k) => [k, {}])),
  });

  test("excludes the empty-key (root) entry", () => {
    expect(extractWorkspaceRelativePaths(makeLock(["", "packages/a"]))).toEqual(
      ["packages/a"],
    );
  });

  test("excludes node_modules/* entries (external deps)", () => {
    expect(
      extractWorkspaceRelativePaths(
        makeLock([
          "packages/a",
          "node_modules/lodash",
          "node_modules/@scope/x",
        ]),
      ),
    ).toEqual(["packages/a"]);
  });

  test("excludes nested node_modules entries", () => {
    expect(
      extractWorkspaceRelativePaths(
        makeLock([
          "packages/a",
          "packages/a/node_modules/lodash",
          "node_modules/some/node_modules/dep",
        ]),
      ),
    ).toEqual(["packages/a"]);
  });

  test("preserves lockfile-declared order", () => {
    expect(
      extractWorkspaceRelativePaths(
        makeLock(["", "packages/b", "node_modules/x", "packages/a"]),
      ),
    ).toEqual(["packages/b", "packages/a"]);
  });
});
