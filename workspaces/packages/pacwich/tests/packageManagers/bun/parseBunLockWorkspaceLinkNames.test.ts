import { PacwichError } from "../../../src/internal/core";
import {
  BUN_LOCK_ERRORS,
  parseBunLockWorkspaceLinkNames,
} from "../../../src/packageManager/backends/bun/lockfile/parseBunLock";
import { describe, expect, test } from "../../util/testFramework";

/**
 * Tests for `parseBunLockWorkspaceLinkNames` — the set of dep names
 * bun.lock records as resolving to a local workspace (a
 * `<name>@workspace:<path>` resolution string in the `packages` block).
 */
describe("parseBunLockWorkspaceLinkNames", () => {
  const lockOf = (packages: Record<string, unknown>) =>
    JSON.stringify({ lockfileVersion: 1, packages });

  test("collects names whose resolution is a workspace path", () => {
    const result = parseBunLockWorkspaceLinkNames(
      lockOf({
        "pkg-a": ["pkg-a@workspace:packages/pkg-a"],
        "pkg-b": ["pkg-b@workspace:packages/pkg-b"],
        lodash: ["lodash@4.17.21", "", { integrity: "sha512-fake" }],
      }),
    ) as Set<string>;
    expect(result.has("pkg-a")).toBe(true);
    expect(result.has("pkg-b")).toBe(true);
    expect(result.has("lodash")).toBe(false);
  });

  test("handles scoped workspace names", () => {
    const result = parseBunLockWorkspaceLinkNames(
      lockOf({
        "@scope/pkg": ["@scope/pkg@workspace:packages/pkg"],
      }),
    ) as Set<string>;
    expect(result.has("@scope/pkg")).toBe(true);
  });

  test("returns an empty set when the packages block is absent", () => {
    const result = parseBunLockWorkspaceLinkNames(
      JSON.stringify({ lockfileVersion: 1 }),
    ) as Set<string>;
    expect(result.size).toBe(0);
  });

  test("returns MalformedBunLock for invalid JSON", () => {
    const result = parseBunLockWorkspaceLinkNames("{ not json");
    expect(result).toBeInstanceOf(BUN_LOCK_ERRORS.MalformedBunLock);
    expect(result).toBeInstanceOf(PacwichError);
  });
});
