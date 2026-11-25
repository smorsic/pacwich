import { getUserEnvVarName } from "@pacwich/common/config";
import { setupCliTest, assertOutputMatches } from "../util/cliTestUtils";
import { makeTestWorkspace } from "../util/testData";
import { test, describe, expect } from "../util/testFramework";

const LOG_LEVEL_ENV_VAR = getUserEnvVarName("logLevel");

const expectedOneWorkspace = makeTestWorkspace({
  name: "application-a",
  path: "applications/applicationA",
  matchPattern: "applications/*",
  scripts: ["a-workspaces", "all-workspaces", "application-a"],
});

/** Serialize workspace in CLI key order for JSON output assertions */
const expectedOneWorkspaceJson = () => ({
  name: expectedOneWorkspace.name,
  isRoot: expectedOneWorkspace.isRoot,
  matchPattern: expectedOneWorkspace.matchPattern,
  path: expectedOneWorkspace.path,
  scripts: expectedOneWorkspace.scripts,
  aliases: expectedOneWorkspace.aliases,
  tags: expectedOneWorkspace.tags,
  dependencies: expectedOneWorkspace.dependencies,
  dependents: expectedOneWorkspace.dependents,
  externalDependencies: expectedOneWorkspace.externalDependencies,
});

describe("CLI Log Level", () => {
  describe("silent", () => {
    test("ls shows workspace details", async () => {
      const { run } = setupCliTest({ testProject: "oneWorkspace" });
      assertOutputMatches(
        (await run("--log-level=silent", "ls")).stdoutAndErr.raw,
        `Workspace: application-a
 - Aliases: 
 - Path: applications/applicationA
 - Glob Match: applications/*
 - Scripts: a-workspaces, all-workspaces, application-a
 - Tags: 
 - Dependencies: 
 - Dependents: `,
      );
    });

    test("ls --json shows JSON output", async () => {
      const { run } = setupCliTest({ testProject: "oneWorkspace" });
      assertOutputMatches(
        (await run("--log-level=silent", "ls", "--json")).stdoutAndErr.raw,
        JSON.stringify([expectedOneWorkspaceJson()]),
      );
    });

    test("ls --name-only shows names", async () => {
      const { run } = setupCliTest({ testProject: "oneWorkspace" });
      assertOutputMatches(
        (await run("--log-level=silent", "ls", "--name-only")).stdoutAndErr.raw,
        `application-a`,
      );
    });

    test("info shows workspace details", async () => {
      const { run } = setupCliTest({ testProject: "oneWorkspace" });
      assertOutputMatches(
        (await run("--log-level=silent", "info", "application-a")).stdoutAndErr
          .raw,
        `Workspace: application-a
 - Aliases: 
 - Path: applications/applicationA
 - Glob Match: applications/*
 - Scripts: a-workspaces, all-workspaces, application-a
 - Tags: 
 - Dependencies: 
 - Dependents: `,
      );
    });

    test("info --json shows JSON output", async () => {
      const { run } = setupCliTest({ testProject: "oneWorkspace" });
      assertOutputMatches(
        (await run("--log-level=silent", "info", "application-a", "--json"))
          .stdoutAndErr.raw,
        JSON.stringify(expectedOneWorkspaceJson()),
      );
    });

    test("info suppresses not-found error", async () => {
      const { run } = setupCliTest({ testProject: "oneWorkspace" });
      assertOutputMatches(
        (await run("--log-level=silent", "info", "does-not-exist")).stdoutAndErr
          .raw,
        /^$/,
      );
    });

    test("list-scripts shows details", async () => {
      const { run } = setupCliTest({ testProject: "oneWorkspace" });
      assertOutputMatches(
        (await run("--log-level=silent", "list-scripts")).stdoutAndErr.raw,
        `Script: a-workspaces
 - application-a
Script: all-workspaces
 - application-a
Script: application-a
 - application-a`,
      );
    });

    test("list-scripts --json shows JSON output", async () => {
      const { run } = setupCliTest({ testProject: "oneWorkspace" });
      assertOutputMatches(
        (await run("--log-level=silent", "list-scripts", "--json")).stdoutAndErr
          .raw,
        JSON.stringify([
          {
            name: "a-workspaces",
            workspaces: ["application-a"],
          },
          {
            name: "all-workspaces",
            workspaces: ["application-a"],
          },
          {
            name: "application-a",
            workspaces: ["application-a"],
          },
        ]),
      );
    });

    test("list-scripts --name-only shows names", async () => {
      const { run } = setupCliTest({ testProject: "oneWorkspace" });
      assertOutputMatches(
        (await run("--log-level=silent", "list-scripts", "--name-only"))
          .stdoutAndErr.raw,
        `a-workspaces
all-workspaces
application-a`,
      );
    });

    test("script-info shows details", async () => {
      const { run } = setupCliTest({ testProject: "oneWorkspace" });
      assertOutputMatches(
        (await run("--log-level=silent", "script-info", "all-workspaces"))
          .stdoutAndErr.raw,
        `Script: all-workspaces
 - application-a`,
      );
    });

    test("script-info --json shows JSON output", async () => {
      const { run } = setupCliTest({ testProject: "oneWorkspace" });
      assertOutputMatches(
        (
          await run(
            "--log-level=silent",
            "script-info",
            "all-workspaces",
            "--json",
          )
        ).stdoutAndErr.raw,
        JSON.stringify({
          name: "all-workspaces",
          workspaces: ["application-a"],
        }),
      );
    });

    test("script-info suppresses not-found error", async () => {
      const { run } = setupCliTest({ testProject: "oneWorkspace" });
      assertOutputMatches(
        (await run("--log-level=silent", "script-info", "does-not-exist"))
          .stdoutAndErr.raw,
        /^$/,
      );
    });

    test("run-script produces output in silent", async () => {
      const { run } = setupCliTest({ testProject: "oneWorkspace" });
      assertOutputMatches(
        (await run("--log-level=silent", "run-script", "all-workspaces"))
          .stdoutAndErr.sanitized,
        /^\[application-a\] script for all workspaces$/,
      );
    });

    test("run-script suppresses not-found error", async () => {
      const { run } = setupCliTest({ testProject: "oneWorkspace" });
      assertOutputMatches(
        (await run("--log-level=silent", "run-script", "does-not-exist"))
          .stdoutAndErr.raw,
        /^$/,
      );
    });

    test("info does not show not-found error", async () => {
      const { run } = setupCliTest({ testProject: "oneWorkspace" });
      assertOutputMatches(
        (await run("--log-level=silent", "info", "does-not-exist")).stdoutAndErr
          .sanitized,
        /^$/,
      );
    });
  });

  describe("error", () => {
    test("ls shows workspace details", async () => {
      const { run } = setupCliTest({ testProject: "oneWorkspace" });
      assertOutputMatches(
        (await run("--log-level=error", "ls")).stdoutAndErr.raw,
        `Workspace: application-a
 - Aliases: 
 - Path: applications/applicationA
 - Glob Match: applications/*
 - Scripts: a-workspaces, all-workspaces, application-a
 - Tags: 
 - Dependencies: 
 - Dependents: `,
      );
    });

    test("ls --json shows JSON output", async () => {
      const { run } = setupCliTest({ testProject: "oneWorkspace" });
      assertOutputMatches(
        (await run("--log-level=error", "ls", "--json")).stdoutAndErr.raw,
        JSON.stringify([expectedOneWorkspaceJson()]),
      );
    });

    test("ls --name-only shows names", async () => {
      const { run } = setupCliTest({ testProject: "oneWorkspace" });
      assertOutputMatches(
        (await run("--log-level=error", "ls", "--name-only")).stdoutAndErr.raw,
        `application-a`,
      );
    });

    test("info shows workspace details", async () => {
      const { run } = setupCliTest({ testProject: "oneWorkspace" });
      assertOutputMatches(
        (await run("--log-level=error", "info", "application-a")).stdoutAndErr
          .raw,
        `Workspace: application-a
 - Aliases: 
 - Path: applications/applicationA
 - Glob Match: applications/*
 - Scripts: a-workspaces, all-workspaces, application-a
 - Tags: 
 - Dependencies: 
 - Dependents: `,
      );
    });

    test("info --json shows JSON output", async () => {
      const { run } = setupCliTest({ testProject: "oneWorkspace" });
      assertOutputMatches(
        (await run("--log-level=error", "info", "application-a", "--json"))
          .stdoutAndErr.raw,
        JSON.stringify(expectedOneWorkspaceJson()),
      );
    });

    test("info shows not-found error", async () => {
      const { run } = setupCliTest({ testProject: "oneWorkspace" });
      assertOutputMatches(
        (await run("--log-level=error", "info", "does-not-exist")).stdoutAndErr
          .sanitized,
        'Workspace "does-not-exist" not found',
      );
    });

    test("list-scripts shows details", async () => {
      const { run } = setupCliTest({ testProject: "oneWorkspace" });
      assertOutputMatches(
        (await run("--log-level=error", "list-scripts")).stdoutAndErr.raw,
        `Script: a-workspaces
 - application-a
Script: all-workspaces
 - application-a
Script: application-a
 - application-a`,
      );
    });

    test("list-scripts --json shows JSON output", async () => {
      const { run } = setupCliTest({ testProject: "oneWorkspace" });
      assertOutputMatches(
        (await run("--log-level=error", "list-scripts", "--json")).stdoutAndErr
          .raw,
        JSON.stringify([
          {
            name: "a-workspaces",
            workspaces: ["application-a"],
          },
          {
            name: "all-workspaces",
            workspaces: ["application-a"],
          },
          {
            name: "application-a",
            workspaces: ["application-a"],
          },
        ]),
      );
    });

    test("list-scripts --name-only shows names", async () => {
      const { run } = setupCliTest({ testProject: "oneWorkspace" });
      assertOutputMatches(
        (await run("--log-level=error", "list-scripts", "--name-only"))
          .stdoutAndErr.raw,
        `a-workspaces
all-workspaces
application-a`,
      );
    });

    test("script-info shows details", async () => {
      const { run } = setupCliTest({ testProject: "oneWorkspace" });
      assertOutputMatches(
        (await run("--log-level=error", "script-info", "all-workspaces"))
          .stdoutAndErr.raw,
        `Script: all-workspaces
 - application-a`,
      );
    });

    test("script-info --json shows JSON output", async () => {
      const { run } = setupCliTest({ testProject: "oneWorkspace" });
      assertOutputMatches(
        (
          await run(
            "--log-level=error",
            "script-info",
            "all-workspaces",
            "--json",
          )
        ).stdoutAndErr.raw,
        JSON.stringify({
          name: "all-workspaces",
          workspaces: ["application-a"],
        }),
      );
    });

    test("script-info shows not-found error", async () => {
      const { run } = setupCliTest({ testProject: "oneWorkspace" });
      assertOutputMatches(
        (await run("--log-level=error", "script-info", "does-not-exist"))
          .stdoutAndErr.sanitized,
        'Script not found: "does-not-exist"',
      );
    });

    test("run-script shows script output", async () => {
      const { run } = setupCliTest({ testProject: "oneWorkspace" });
      assertOutputMatches(
        (await run("--log-level=error", "run-script", "all-workspaces"))
          .stdoutAndErr.sanitized,
        /^\[application-a\] script for all workspaces$/,
      );
    });

    test("run-script shows not-found error", async () => {
      const { run } = setupCliTest({ testProject: "oneWorkspace" });
      assertOutputMatches(
        (await run("--log-level=error", "run-script", "does-not-exist"))
          .stdoutAndErr.sanitized,
        'No matching workspaces found with script "does-not-exist"',
      );
    });
  });

  describe("debug level", () => {
    test("shows debug output", async () => {
      const { run } = setupCliTest({ testProject: "oneWorkspace" });
      const result = await run("--log-level=debug", "ls");
      expect(result.exitCode).toBe(0);
      // Debug output should include internal logging
      expect(result.stderr.raw).toContain("[pacwich DEBUG]");
    });
  });

  describe("warn level", () => {
    test("run-script does not show summary", async () => {
      const { run } = setupCliTest({ testProject: "oneWorkspace" });
      const result = await run(
        "--log-level=warn",
        "run-script",
        "all-workspaces",
      );
      expect(result.exitCode).toBe(0);
      expect(result.stdout.raw).not.toContain("script ran successfully");
    });
  });

  describe("info level", () => {
    test("run-script shows summary", async () => {
      const { run } = setupCliTest({ testProject: "oneWorkspace" });
      const result = await run(
        "--log-level=info",
        "run-script",
        "all-workspaces",
      );
      expect(result.exitCode).toBe(0);
      expect(result.stdout.raw).toContain("script ran successfully");
    });
  });

  describe("PACWICH_LOG_LEVEL env var", () => {
    test("sets the default level when no flag is passed", async () => {
      const { run } = setupCliTest({
        testProject: "oneWorkspace",
        env: { [LOG_LEVEL_ENV_VAR]: "debug" },
      });
      const result = await run("ls");
      expect(result.exitCode).toBe(0);
      expect(result.stderr.raw).toContain("[pacwich DEBUG]");
    });

    test("a silent env var suppresses the not-found error", async () => {
      const { run } = setupCliTest({
        testProject: "oneWorkspace",
        env: { [LOG_LEVEL_ENV_VAR]: "silent" },
      });
      assertOutputMatches(
        (await run("info", "does-not-exist")).stdoutAndErr.raw,
        /^$/,
      );
    });

    test("an explicit --log-level flag overrides the env var", async () => {
      const { run } = setupCliTest({
        testProject: "oneWorkspace",
        env: { [LOG_LEVEL_ENV_VAR]: "silent" },
      });
      const result = await run("--log-level=debug", "ls");
      expect(result.exitCode).toBe(0);
      expect(result.stderr.raw).toContain("[pacwich DEBUG]");
    });

    test("an invalid env var value is ignored without crashing", async () => {
      const { run } = setupCliTest({
        testProject: "oneWorkspace",
        env: { [LOG_LEVEL_ENV_VAR]: "oops" },
      });
      const result = await run("ls");
      expect(result.exitCode).toBe(0);
      expect(result.stderr.raw).not.toContain("[pacwich DEBUG]");
      assertOutputMatches(result.stdout.raw, /Workspace: application-a/);
    });
  });
});
