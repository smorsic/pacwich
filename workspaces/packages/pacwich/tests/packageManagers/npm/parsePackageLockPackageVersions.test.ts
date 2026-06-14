import { NPM_ERRORS } from "../../../src/packageManager/backends/npm/errors";
import {
  parsePackageLockPackageVersions,
  type NpmLockVersionMap,
} from "../../../src/packageManager/backends/npm/packageLock";
import { describe, expect, test } from "../../util/testFramework";

/**
 * npm-specific tests for `parsePackageLockPackageVersions` — the npm
 * adapter's helper that extracts `<pkg> → <resolvedVersion>` from a
 * `package-lock.json` (v2/v3) `packages` map. The PM-agnostic
 * comparator that consumes this output is tested in
 * tests/features/affected/externalDependencyChanges.test.ts.
 */
describe("parsePackageLockPackageVersions", () => {
  test("extracts name and version from node_modules/* entries", () => {
    const lock = JSON.stringify({
      lockfileVersion: 3,
      packages: {
        "": { name: "root" },
        "node_modules/lodash": { version: "4.17.21" },
        "node_modules/react": { version: "18.0.0" },
      },
    });
    const result = parsePackageLockPackageVersions(lock) as NpmLockVersionMap;
    expect(result.get("lodash")).toBe("4.17.21");
    expect(result.get("react")).toBe("18.0.0");
  });

  test("handles scoped names (node_modules/@scope/foo)", () => {
    const lock = JSON.stringify({
      lockfileVersion: 3,
      packages: {
        "node_modules/@scope/foo": { version: "1.2.3" },
        "node_modules/@types/node": { version: "20.10.0" },
      },
    });
    const result = parsePackageLockPackageVersions(lock) as NpmLockVersionMap;
    expect(result.get("@scope/foo")).toBe("1.2.3");
    expect(result.get("@types/node")).toBe("20.10.0");
  });

  test("skips workspace symlinks (link: true)", () => {
    const lock = JSON.stringify({
      lockfileVersion: 3,
      packages: {
        "": { name: "root" },
        "node_modules/workspace-a": {
          resolved: "packages/a",
          link: true,
        },
        "node_modules/lodash": { version: "4.17.21" },
      },
    });
    const result = parsePackageLockPackageVersions(lock) as NpmLockVersionMap;
    expect(result.has("workspace-a")).toBe(false);
    expect(result.get("lodash")).toBe("4.17.21");
  });

  test("skips nested node_modules entries (only top-level hoisted counts)", () => {
    const lock = JSON.stringify({
      lockfileVersion: 3,
      packages: {
        "node_modules/lodash": { version: "4.17.21" },
        "node_modules/some-pkg/node_modules/lodash": { version: "3.10.1" },
      },
    });
    const result = parsePackageLockPackageVersions(lock) as NpmLockVersionMap;
    expect(result.get("lodash")).toBe("4.17.21");
    expect(result.size).toBe(1);
  });

  test("skips entries without a string version", () => {
    const lock = JSON.stringify({
      lockfileVersion: 3,
      packages: {
        "node_modules/no-version": {},
        "node_modules/empty-version": { version: "" },
        "node_modules/numeric-version": { version: 1.0 },
        "node_modules/ok": { version: "1.0.0" },
      },
    });
    const result = parsePackageLockPackageVersions(lock) as NpmLockVersionMap;
    expect(result.has("no-version")).toBe(false);
    expect(result.has("empty-version")).toBe(false);
    expect(result.has("numeric-version")).toBe(false);
    expect(result.get("ok")).toBe("1.0.0");
  });

  test("returns empty map when packages field is absent", () => {
    const lock = JSON.stringify({ lockfileVersion: 3 });
    const result = parsePackageLockPackageVersions(lock) as NpmLockVersionMap;
    expect(result.size).toBe(0);
  });

  test("extracts versions from a v2 lockfile (v2 is also supported)", () => {
    const lock = JSON.stringify({
      lockfileVersion: 2,
      packages: {
        "": { name: "root" },
        "node_modules/lodash": { version: "4.17.21" },
      },
    });
    const result = parsePackageLockPackageVersions(lock) as NpmLockVersionMap;
    expect(result.get("lodash")).toBe("4.17.21");
  });

  test("propagates UnsupportedNpmLockVersion for an unsupported version (v1)", () => {
    const result = parsePackageLockPackageVersions(
      JSON.stringify({ lockfileVersion: 1 }),
    );
    expect(result).toBeInstanceOf(NPM_ERRORS.UnsupportedNpmLockVersion);
  });

  test("returns an error for malformed JSON", () => {
    const result = parsePackageLockPackageVersions("{ not valid }");
    expect(result).toBeInstanceOf(Error);
  });
});
