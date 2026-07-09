import { getUserEnvVarName } from "@pacwich/common/config";
import type { WarningId } from "@pacwich/common/warnings";
import { createFileSystemProject } from "../../../src";
import { logger } from "../../../src/internal/logger";
import { getProjectRoot } from "../../fixtures/testProjects";
import { afterEach, describe, expect, test } from "../../util/testFramework";

// Test ids are unregistered WarningId values, cast for the sake of exercising suppression.
const asWarningIds = (ids: string[]) => ids as WarningId[];

describe("createFileSystemProject suppressWarnings option", () => {
  const ENV_VAR = getUserEnvVarName("suppressWarningsDefault");
  const defaultFixture = getProjectRoot("default");
  const suppressWarningsConfigFixture = getProjectRoot(
    "projectConfigSuppressWarnings",
  );

  afterEach(() => {
    delete process.env[ENV_VAR];
    logger.suppressWarnings = [];
  });

  test("defaults to [] when option, config, and env var are all absent", () => {
    createFileSystemProject({ rootDirectory: defaultFixture });
    expect(logger.suppressWarnings).toEqual([]);
  });

  test("a single-item option value is applied", () => {
    createFileSystemProject({
      rootDirectory: defaultFixture,
      suppressWarnings: asWarningIds(["warningA"]),
    });
    expect(logger.suppressWarnings).toEqual(["warningA"]);
  });

  test("a multi-item option value is applied", () => {
    createFileSystemProject({
      rootDirectory: defaultFixture,
      suppressWarnings: asWarningIds(["warningA", "warningB"]),
    });
    expect(logger.suppressWarnings).toEqual(["warningA", "warningB"]);
  });

  test("an empty-array option value applies no suppression", () => {
    createFileSystemProject({
      rootDirectory: defaultFixture,
      suppressWarnings: [],
    });
    expect(logger.suppressWarnings).toEqual([]);
  });

  test("unions with the project config's defaults.suppressWarnings field", () => {
    createFileSystemProject({
      rootDirectory: suppressWarningsConfigFixture,
      suppressWarnings: asWarningIds(["fromOption"]),
    });
    expect([...logger.suppressWarnings].sort()).toEqual(
      ["fromConfig", "fromOption"].sort(),
    );
  });

  test("unions with the PACWICH_SUPPRESS_WARNINGS_DEFAULT env var", () => {
    process.env[ENV_VAR] = "fromEnv";
    createFileSystemProject({
      rootDirectory: defaultFixture,
      suppressWarnings: asWarningIds(["fromOption"]),
    });
    expect([...logger.suppressWarnings].sort()).toEqual(
      ["fromEnv", "fromOption"].sort(),
    );
  });

  test("deduplicates ids shared across option, config, and env var", () => {
    process.env[ENV_VAR] = "shared";
    createFileSystemProject({
      rootDirectory: suppressWarningsConfigFixture,
      suppressWarnings: asWarningIds(["shared"]),
    });
    expect([...logger.suppressWarnings].sort()).toEqual(
      ["fromConfig", "shared"].sort(),
    );
  });

  describe("invalid values rejected before project assembly", () => {
    test("non-array value throws", () => {
      expect(() =>
        createFileSystemProject({
          rootDirectory: defaultFixture,
          suppressWarnings: "warningA" as unknown as WarningId[],
        }),
      ).toThrow();
    });

    test("non-string array entries throw", () => {
      expect(() =>
        createFileSystemProject({
          rootDirectory: defaultFixture,
          suppressWarnings: [5 as unknown as WarningId],
        }),
      ).toThrow();
    });
  });
});
