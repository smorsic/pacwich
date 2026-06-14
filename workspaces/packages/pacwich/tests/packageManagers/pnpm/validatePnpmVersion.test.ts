import {
  PACKAGE_MANAGER_VERSION_ERRORS,
  validatePackageManagerVersion,
  validatePnpmVersion,
} from "../../../src/packageManager/validatePackageManagerVersion";
import { describe, expect, test } from "../../util/testFramework";

/**
 * Synchronous pnpm version validation. The bun/node runtime validators
 * live in `validateRuntime`; this is the pnpm-specific equivalent.
 * Tests pass an explicit version string so they don't depend on
 * whichever pnpm happens to be on PATH in the test environment.
 */

describe("validatePnpmVersion", () => {
  test("returns undefined for an in-range version", () => {
    expect(validatePnpmVersion("10.5.0")).toBeUndefined();
    expect(validatePnpmVersion("11.0.0")).toBeUndefined();
  });

  test("returns UnsupportedPnpmVersion for an out-of-range version", () => {
    const result = validatePnpmVersion("9.0.0");
    expect(result).toBeInstanceOf(
      PACKAGE_MANAGER_VERSION_ERRORS.UnsupportedPnpmVersion,
    );
    expect(result?.message).toContain("9.0.0");
    expect(result?.message).toContain("Required version");
  });

  test("returns undefined when no version is given (binary missing on PATH)", () => {
    // The empty-string sentinel is what detectViaShellSync returns when
    // pnpm isn't installed; validation should stay quiet rather than
    // page the user about a tool they don't have.
    expect(validatePnpmVersion("")).toBeUndefined();
  });
});

describe("validatePackageManagerVersion", () => {
  test("bun has no version check (handled by validateRuntime)", () => {
    expect(validatePackageManagerVersion("bun")).toBeUndefined();
  });

  test("npm has no declared range (no validation)", () => {
    expect(validatePackageManagerVersion("npm")).toBeUndefined();
  });

  test("pnpm dispatches to validatePnpmVersion (smoke)", () => {
    // Whatever pnpm version is installed (or none) shouldn't throw;
    // the function returns undefined or a PacwichError instance.
    const result = validatePackageManagerVersion("pnpm");
    expect(
      result === undefined ||
        result instanceof PACKAGE_MANAGER_VERSION_ERRORS.UnsupportedPnpmVersion,
    ).toBe(true);
  });
});
