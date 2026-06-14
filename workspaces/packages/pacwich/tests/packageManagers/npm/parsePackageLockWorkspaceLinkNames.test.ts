import { PacwichError } from "../../../src/internal/core";
import { NPM_ERRORS } from "../../../src/packageManager/backends/npm";
import { parsePackageLockWorkspaceLinkNames } from "../../../src/packageManager/backends/npm/packageLock";
import { describe, expect, test } from "../../util/testFramework";

/**
 * Tests for `parsePackageLockWorkspaceLinkNames` — the set of dep names
 * package-lock.json records as resolving to a local workspace (hoisted
 * `node_modules/<name>` entries with `"link": true`).
 */
describe("parsePackageLockWorkspaceLinkNames", () => {
  const lockOf = (packages: Record<string, unknown>) =>
    JSON.stringify({ lockfileVersion: 3, packages });

  test("collects top-level node_modules entries with link: true", () => {
    const result = parsePackageLockWorkspaceLinkNames(
      lockOf({
        "": { workspaces: ["packages/*"] },
        "node_modules/pkg-a": { resolved: "packages/pkg-a", link: true },
        "node_modules/lodash": { version: "4.17.21" },
        "packages/pkg-a": { version: "1.2.3" },
      }),
    ) as Set<string>;
    expect(result.has("pkg-a")).toBe(true);
    expect(result.has("lodash")).toBe(false);
  });

  test("keeps the @scope/ prefix on scoped names", () => {
    const result = parsePackageLockWorkspaceLinkNames(
      lockOf({
        "node_modules/@scope/pkg": {
          resolved: "packages/pkg",
          link: true,
        },
      }),
    ) as Set<string>;
    expect(result.has("@scope/pkg")).toBe(true);
  });

  test("ignores nested node_modules symlinks", () => {
    const result = parsePackageLockWorkspaceLinkNames(
      lockOf({
        "node_modules/a/node_modules/pkg-a": {
          resolved: "packages/pkg-a",
          link: true,
        },
      }),
    ) as Set<string>;
    expect(result.has("pkg-a")).toBe(false);
    expect(result.size).toBe(0);
  });

  test("returns an empty set when nothing links", () => {
    const result = parsePackageLockWorkspaceLinkNames(
      lockOf({ "node_modules/lodash": { version: "4.17.21" } }),
    ) as Set<string>;
    expect(result.size).toBe(0);
  });

  test("returns MalformedNpmLock for invalid JSON", () => {
    const result = parsePackageLockWorkspaceLinkNames("{ not json");
    expect(result).toBeInstanceOf(NPM_ERRORS.MalformedNpmLock);
    expect(result).toBeInstanceOf(PacwichError);
  });
});
