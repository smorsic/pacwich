import {
  parseBunLockPackageVersions,
  type BunLockVersionMap,
} from "../../../src/packageManager/backends/bun/lockfile/parseBunLock";
import { describe, expect, test } from "../../util/testFramework";

/**
 * Bun-specific tests for `parseBunLockPackageVersions` — the bun
 * adapter's helper that extracts `<pkg> → <resolvedVersion>` from a
 * bun.lock `packages` map. The PM-agnostic comparator that consumes
 * this output (`computeExternalDependencyChanges`) is tested in
 * tests/features/affected/externalDependencyChanges.test.ts against a
 * plain `Map<string, string>` shape.
 */

describe("parseBunLockPackageVersions", () => {
  test("extracts name and version from each packages entry", () => {
    const lock = JSON.stringify({
      lockfileVersion: 1,
      workspaces: { "": { name: "test-root" } },
      packages: {
        lodash: ["lodash@4.17.21", {}, "<sha>"],
        react: ["react@18.0.0", {}, "<sha>"],
      },
    });
    const result = parseBunLockPackageVersions(lock) as BunLockVersionMap;
    expect(result.get("lodash")).toBe("4.17.21");
    expect(result.get("react")).toBe("18.0.0");
  });

  test("handles scoped names by splitting on the last @", () => {
    const lock = JSON.stringify({
      lockfileVersion: 1,
      packages: {
        "@scope/foo": ["@scope/foo@1.2.3", {}, "<sha>"],
        "@types/node": ["@types/node@20.10.0", {}, "<sha>"],
      },
    });
    const result = parseBunLockPackageVersions(lock) as BunLockVersionMap;
    expect(result.get("@scope/foo")).toBe("1.2.3");
    expect(result.get("@types/node")).toBe("20.10.0");
  });

  test("returns empty map when packages field is absent", () => {
    const lock = JSON.stringify({ lockfileVersion: 1 });
    const result = parseBunLockPackageVersions(lock) as BunLockVersionMap;
    expect(result.size).toBe(0);
  });

  test("skips entries that do not follow name@version", () => {
    const lock = JSON.stringify({
      lockfileVersion: 1,
      packages: {
        ok: ["ok@1.0.0", {}, "<sha>"],
        // missing version segment
        weird: ["weird", {}, "<sha>"],
        // empty version after @
        emptyVersion: ["emptyVersion@", {}, "<sha>"],
        // not an array
        notAnArray: "huh",
      },
    });
    const result = parseBunLockPackageVersions(lock) as BunLockVersionMap;
    expect(result.get("ok")).toBe("1.0.0");
    expect(result.has("weird")).toBe(false);
    expect(result.has("emptyVersion")).toBe(false);
    expect(result.has("notAnArray")).toBe(false);
  });

  test("skips entries whose resolved version is a workspace: pseudo-version", () => {
    const lock = JSON.stringify({
      lockfileVersion: 1,
      packages: {
        // bun hoists workspace packages here with a `workspace:<path>`
        // pseudo-version rather than a registry version.
        "pkg-a": ["pkg-a@workspace:packages/a", {}, "<sha>"],
        "@scope/pkg-b": ["@scope/pkg-b@workspace:packages/b", {}, "<sha>"],
        lodash: ["lodash@4.17.21", {}, "<sha>"],
      },
    });
    const result = parseBunLockPackageVersions(lock) as BunLockVersionMap;
    expect(result.has("pkg-a")).toBe(false);
    expect(result.has("@scope/pkg-b")).toBe(false);
    // a real registry-resolved sibling is still tracked
    expect(result.get("lodash")).toBe("4.17.21");
  });

  test("returns an error for malformed JSON", () => {
    const result = parseBunLockPackageVersions("{ not valid }");
    expect(result).toBeInstanceOf(Error);
  });
});
