import { test, expect, describe } from "bun:test";
import {
  setupCliTest,
  assertOutputMatches,
  listCommandAndAliases,
} from "../../util/cliTestUtils";
import { withWindowsPath } from "../../util/windows";

const APPLICATION_1A_PLAIN_OUTPUT = `Workspace: application-1a
 - Aliases: appA
 - Path: ${withWindowsPath("applications/applicationA")}
 - Glob Match: applications/*
 - Scripts: a-workspaces, all-workspaces, application-a
 - Tags: 
 - Dependencies: 
 - Dependents: `;

const EXPECTED_APPLICATION_1A_JSON = {
  name: "application-1a",
  isRoot: false,
  matchPattern: "applications/*",
  path: withWindowsPath("applications/applicationA"),
  scripts: ["a-workspaces", "all-workspaces", "application-a"],
  aliases: ["appA"],
  tags: [],
  dependencies: [],
  dependents: [],
  externalDependencies: [],
};

describe("Workspace Info", () => {
  describe("output format", () => {
    test.each(listCommandAndAliases("workspaceInfo"))(
      "plain output for workspace: %s",
      async (command) => {
        const { run } = setupCliTest({ testProject: "simple1" });
        const result = await run(command, "application-1a");
        expect(result.stderr.raw).toBeEmpty();
        expect(result.exitCode).toBe(0);
        assertOutputMatches(result.stdout.raw, APPLICATION_1A_PLAIN_OUTPUT);
      },
    );

    test("--json outputs workspace info as JSON", async () => {
      const { run } = setupCliTest({ testProject: "simple1" });
      const result = await run("info", "application-1a", "--json");
      expect(result.stderr.raw).toBeEmpty();
      expect(result.exitCode).toBe(0);
      assertOutputMatches(
        result.stdout.raw,
        JSON.stringify(EXPECTED_APPLICATION_1A_JSON),
      );
    });

    test("-j outputs workspace info as JSON", async () => {
      const { run } = setupCliTest({ testProject: "simple1" });
      const result = await run("info", "application-1a", "-j");
      expect(result.stderr.raw).toBeEmpty();
      expect(result.exitCode).toBe(0);
      assertOutputMatches(
        result.stdout.raw,
        JSON.stringify(EXPECTED_APPLICATION_1A_JSON),
      );
    });

    test("--json --pretty outputs pretty-printed JSON", async () => {
      const { run } = setupCliTest({ testProject: "simple1" });
      const result = await run("info", "application-1a", "--json", "--pretty");
      expect(result.stderr.raw).toBeEmpty();
      expect(result.exitCode).toBe(0);
      assertOutputMatches(
        result.stdout.raw,
        JSON.stringify(EXPECTED_APPLICATION_1A_JSON, null, 2),
      );
    });

    test("-j -p outputs pretty-printed JSON", async () => {
      const { run } = setupCliTest({ testProject: "simple1" });
      const result = await run("info", "application-1a", "-j", "-p");
      expect(result.stderr.raw).toBeEmpty();
      expect(result.exitCode).toBe(0);
      assertOutputMatches(
        result.stdout.raw,
        JSON.stringify(EXPECTED_APPLICATION_1A_JSON, null, 2),
      );
    });
  });

  test("exits with error when workspace does not exist", async () => {
    const { run } = setupCliTest({ testProject: "simple1" });
    const result = await run("info", "does-not-exist");
    expect(result.stdout.raw).toBeEmpty();
    expect(result.exitCode).toBe(1);
    assertOutputMatches(
      result.stderr.sanitized,
      'Workspace "does-not-exist" not found',
    );
  });

  test("with dependencies and dependents", async () => {
    const { run } = setupCliTest({ testProject: "withDependenciesSimple" });
    const result = await run("info", "d-depends-e");
    expect(result.stderr.raw).toBeEmpty();
    expect(result.exitCode).toBe(0);
    assertOutputMatches(
      result.stdout.raw,
      `Workspace: d-depends-e
 - Aliases: 
 - Path: ${withWindowsPath("packages/d-depends-e")}
 - Glob Match: packages/*
 - Scripts: test-script
 - Tags: 
 - Dependencies: e
 - Dependents: b-depends-cd`,
    );
  });
});
