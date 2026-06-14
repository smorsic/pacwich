import {
  setupCliTest,
  assertOutputMatches,
  listCommandAndAliases,
} from "../../util/cliTestUtils";
import { test, expect, describe } from "../../util/testFramework";

const ALL_WORKSPACES_PLAIN_OUTPUT = `Script: all-workspaces
 - application-1a
 - application-1b
 - library-1a
 - library-1b`;

const APPLICATION_A_PLAIN_OUTPUT = `Script: application-a
 - application-1a`;

const EXPECTED_ALL_WORKSPACES_JSON = {
  name: "all-workspaces",
  workspaces: ["application-1a", "application-1b", "library-1a", "library-1b"],
};

describe("Script Info", () => {
  describe("output format", () => {
    test.each(listCommandAndAliases("scriptInfo"))(
      "plain output for script with multiple workspaces: %s",
      async (command) => {
        const { run } = setupCliTest({ testProject: "simple1" });
        const result = await run(command, "all-workspaces");
        expect(result.stderr.raw).toBeEmpty();
        expect(result.exitCode).toBe(0);
        assertOutputMatches(result.stdout.raw, ALL_WORKSPACES_PLAIN_OUTPUT);
      },
    );

    test("plain output for script with single workspace", async () => {
      const { run } = setupCliTest({ testProject: "simple1" });
      const result = await run("script-info", "application-a");
      expect(result.stderr.raw).toBeEmpty();
      expect(result.exitCode).toBe(0);
      assertOutputMatches(result.stdout.raw, APPLICATION_A_PLAIN_OUTPUT);
    });

    test("--json outputs script info as JSON", async () => {
      const { run } = setupCliTest({ testProject: "simple1" });
      const result = await run("script-info", "all-workspaces", "--json");
      expect(result.stderr.raw).toBeEmpty();
      expect(result.exitCode).toBe(0);
      assertOutputMatches(
        result.stdout.raw,
        JSON.stringify(EXPECTED_ALL_WORKSPACES_JSON),
      );
    });

    test("-j outputs script info as JSON", async () => {
      const { run } = setupCliTest({ testProject: "simple1" });
      const result = await run("script-info", "all-workspaces", "-j");
      expect(result.stderr.raw).toBeEmpty();
      expect(result.exitCode).toBe(0);
      assertOutputMatches(
        result.stdout.raw,
        JSON.stringify(EXPECTED_ALL_WORKSPACES_JSON),
      );
    });

    test("--json --pretty outputs pretty-printed JSON", async () => {
      const { run } = setupCliTest({ testProject: "simple1" });
      const result = await run(
        "script-info",
        "all-workspaces",
        "--json",
        "--pretty",
      );
      expect(result.stderr.raw).toBeEmpty();
      expect(result.exitCode).toBe(0);
      assertOutputMatches(
        result.stdout.raw,
        JSON.stringify(EXPECTED_ALL_WORKSPACES_JSON, null, 2),
      );
    });

    test("-j -p outputs pretty-printed JSON", async () => {
      const { run } = setupCliTest({ testProject: "simple1" });
      const result = await run("script-info", "all-workspaces", "-j", "-p");
      expect(result.stderr.raw).toBeEmpty();
      expect(result.exitCode).toBe(0);
      assertOutputMatches(
        result.stdout.raw,
        JSON.stringify(EXPECTED_ALL_WORKSPACES_JSON, null, 2),
      );
    });

    test("--workspaces-only outputs only workspace names", async () => {
      const { run } = setupCliTest({ testProject: "simple1" });
      const result = await run(
        "script-info",
        "all-workspaces",
        "--workspaces-only",
      );
      expect(result.stderr.raw).toBeEmpty();
      expect(result.exitCode).toBe(0);
      assertOutputMatches(
        result.stdout.raw,
        "application-1a\napplication-1b\nlibrary-1a\nlibrary-1b",
      );
    });

    test("-w outputs only workspace names", async () => {
      const { run } = setupCliTest({ testProject: "simple1" });
      const result = await run("script-info", "all-workspaces", "-w");
      expect(result.stderr.raw).toBeEmpty();
      expect(result.exitCode).toBe(0);
      assertOutputMatches(
        result.stdout.raw,
        "application-1a\napplication-1b\nlibrary-1a\nlibrary-1b",
      );
    });
  });

  test("exits with error when script does not exist", async () => {
    const { run } = setupCliTest({ testProject: "simple1" });
    const result = await run("script-info", "does-not-exist");
    expect(result.stdout.raw).toBeEmpty();
    expect(result.exitCode).toBe(1);
    assertOutputMatches(
      result.stderr.sanitized,
      'Script not found: "does-not-exist"',
    );
  });
});
