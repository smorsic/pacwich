import { getUserEnvVarName } from "@pacwich/common/config";
import { createFileSystemProject } from "../../../src";
import { getProjectRoot } from "../../fixtures/testProjects";
import { afterEach, describe, expect, test } from "../../util/testFramework";

/**
 * End-to-end precedence chain for the `packageManager` resolution
 * inside `createFileSystemProject`:
 *
 *   factory option > root config > env var > "auto" → lockfile probe
 *
 * Uses the `projectConfigPackageManagerNpm` fixture (pins
 * `packageManager: "npm"` in root config + ships a bun.lock) so we
 * can verify each higher-precedence source actually overrides the
 * one below it. Hitting the npm stub during project assembly
 * throws — that's the signal that npm "won" the precedence battle.
 */
describe("createFileSystemProject packageManager option", () => {
  const ENV_VAR = getUserEnvVarName("packageManager");
  const npmConfigFixture = getProjectRoot("projectConfigPackageManagerNpm");

  afterEach(() => {
    delete process.env[ENV_VAR];
  });

  describe("explicit factory option values", () => {
    test("'bun' uses the bun adapter (project.packageManager === 'bun')", () => {
      const project = createFileSystemProject({
        rootDirectory: npmConfigFixture,
        packageManager: "bun",
      });
      expect(project.packageManager).toBe("bun");
    });

    test("'auto' resolves via lockfile probe to bun (only bun.lock present)", () => {
      const project = createFileSystemProject({
        rootDirectory: npmConfigFixture,
        packageManager: "auto",
      });
      expect(project.packageManager).toBe("bun");
    });

    test("'npm' routes through the npm adapter (fails with npm-specific lockfile error on this fixture)", () => {
      // The projectConfigPackageManagerNpm fixture has no
      // package-lock.json — when npm is selected, the npm adapter's
      // discoverWorkspacePaths surfaces NpmLockNotFound. The error
      // message is the signal that npm (not bun) was selected.
      expect(() =>
        createFileSystemProject({
          rootDirectory: npmConfigFixture,
          packageManager: "npm",
        }),
      ).toThrow(/No package-lock\.json found/);
    });
  });

  describe("invalid values rejected before adapter selection", () => {
    test("non-enum string throws with the accepted-values list", () => {
      expect(() =>
        createFileSystemProject({
          rootDirectory: npmConfigFixture,
          packageManager: "yarn" as unknown as "auto",
        }),
      ).toThrow(/Invalid packageManager option/);
    });

    test("non-string type throws", () => {
      expect(() =>
        createFileSystemProject({
          rootDirectory: npmConfigFixture,
          packageManager: 5 as unknown as "auto",
        }),
      ).toThrow();
    });
  });

  describe("falls through to root config when factory option is omitted", () => {
    test("root config 'npm' wins → npm adapter selected (surfaces lockfile-missing on this fixture)", () => {
      expect(() =>
        createFileSystemProject({
          rootDirectory: npmConfigFixture,
        }),
      ).toThrow(/No package-lock\.json found/);
    });
  });

  describe("falls through to env var when factory option and config are absent", () => {
    test("PACWICH_PACKAGE_MANAGER='bun' on a project without a config field uses bun", () => {
      process.env[ENV_VAR] = "bun";
      const project = createFileSystemProject({
        rootDirectory: getProjectRoot("default"),
      });
      expect(project.packageManager).toBe("bun");
    });
  });

  describe("factory option beats root config", () => {
    test("--pm bun-equivalent (factory option 'bun') overrides config 'npm'", () => {
      const project = createFileSystemProject({
        rootDirectory: npmConfigFixture,
        packageManager: "bun",
      });
      expect(project.packageManager).toBe("bun");
    });

    test("factory option 'auto' overrides config 'npm' and probes lockfile", () => {
      const project = createFileSystemProject({
        rootDirectory: npmConfigFixture,
        packageManager: "auto",
      });
      expect(project.packageManager).toBe("bun");
    });
  });

  describe("default behavior on a project without any pin", () => {
    test("no option, no config, no env → 'auto' probes lockfile → bun", () => {
      const project = createFileSystemProject({
        rootDirectory: getProjectRoot("default"),
      });
      expect(project.packageManager).toBe("bun");
    });
  });
});
