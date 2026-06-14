import { getDoctorInfo } from "../../src/doctor";
import { IS_BUN } from "../../src/internal/core";
import { PACKAGE_MANAGER_NAMES } from "../../src/packageManager/adapter";
import { describe, expect, test } from "../util/testFramework";

/**
 * Project-agnostic doctor info. The package-manager surface here is
 * intentionally a flat `Record<PackageManagerName, string>` of
 * what's installed on the host — NOT a resolution of which backend
 * the current project would use.
 */
describe("getDoctorInfo", () => {
  test("packageManagers contains every supported PackageManagerName as a key", async () => {
    const info = await getDoctorInfo();
    expect(Object.keys(info.packageManagers).sort()).toEqual(
      [...PACKAGE_MANAGER_NAMES].sort(),
    );
  });

  test("every packageManagers value is a string (empty when not installed)", async () => {
    const info = await getDoctorInfo();
    for (const value of Object.values(info.packageManagers)) {
      expect(typeof value).toBe("string");
    }
  });

  test("bun's entry is a non-empty semver-like version on the bun runtime", async () => {
    if (!IS_BUN) return;
    const info = await getDoctorInfo();
    expect(info.packageManagers.bun).toMatch(/^\d+\.\d+\.\d+/);
  });

  test("shell-probed backends report '' when unresolvable on PATH", async () => {
    // npm and pnpm always go through `execFile` (only bun can
    // short-circuit to Bun.version), so blanking PATH deterministically
    // drives them down the "not installed" path regardless of the host.
    const originalPath = process.env.PATH;
    process.env.PATH = "";
    try {
      const info = await getDoctorInfo();
      expect(info.packageManagers.npm).toBe("");
      expect(info.packageManagers.pnpm).toBe("");
    } finally {
      process.env.PATH = originalPath;
    }
  });
});
