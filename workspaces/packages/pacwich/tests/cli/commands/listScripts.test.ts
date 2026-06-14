import fs from "fs";
import os from "os";
import path from "path";
import {
  setupCliTest,
  assertOutputMatches,
  listCommandAndAliases,
} from "../../util/cliTestUtils";
import { test, expect, describe } from "../../util/testFramework";

const EXPECTED_SCRIPTS_JSON_SIMPLE1 = [
  { name: "a-workspaces", workspaces: ["application-1a", "library-1a"] },
  {
    name: "all-workspaces",
    workspaces: [
      "application-1a",
      "application-1b",
      "library-1a",
      "library-1b",
    ],
  },
  { name: "application-a", workspaces: ["application-1a"] },
  { name: "application-b", workspaces: ["application-1b"] },
  { name: "b-workspaces", workspaces: ["application-1b", "library-1b"] },
  { name: "library-a", workspaces: ["library-1a"] },
  { name: "library-b", workspaces: ["library-1b"] },
];

const PLAIN_OUTPUT_SIMPLE1 = `Script: a-workspaces
 - application-1a
 - library-1a
Script: all-workspaces
 - application-1a
 - application-1b
 - library-1a
 - library-1b
Script: application-a
 - application-1a
Script: application-b
 - application-1b
Script: b-workspaces
 - application-1b
 - library-1b
Script: library-a
 - library-1a
Script: library-b
 - library-1b`;

describe("List Scripts", () => {
  describe("output format", () => {
    test.each(listCommandAndAliases("listScripts"))(
      "plain output lists scripts with workspaces: %s",
      async (command) => {
        const { run } = setupCliTest({ testProject: "simple1" });
        const result = await run(command);
        assertOutputMatches(result.stdout.raw, PLAIN_OUTPUT_SIMPLE1);
        expect(result.stderr.raw).toBeEmpty();
      },
    );

    test("--json outputs script list as JSON", async () => {
      const { run } = setupCliTest({ testProject: "simple1" });
      const result = await run("ls-scripts", "--json");
      expect(result.stderr.raw).toBeEmpty();
      expect(result.exitCode).toBe(0);
      assertOutputMatches(
        result.stdout.raw,
        JSON.stringify(EXPECTED_SCRIPTS_JSON_SIMPLE1),
      );
    });

    test("-j outputs script list as JSON", async () => {
      const { run } = setupCliTest({ testProject: "simple1" });
      const result = await run("ls-scripts", "-j");
      expect(result.stderr.raw).toBeEmpty();
      expect(result.exitCode).toBe(0);
      assertOutputMatches(
        result.stdout.raw,
        JSON.stringify(EXPECTED_SCRIPTS_JSON_SIMPLE1),
      );
    });

    test("--json --pretty outputs pretty-printed JSON", async () => {
      const { run } = setupCliTest({ testProject: "simple1" });
      const result = await run("ls-scripts", "--json", "--pretty");
      expect(result.stderr.raw).toBeEmpty();
      expect(result.exitCode).toBe(0);
      assertOutputMatches(
        result.stdout.raw,
        JSON.stringify(EXPECTED_SCRIPTS_JSON_SIMPLE1, null, 2),
      );
    });

    test("-j -p outputs pretty-printed JSON", async () => {
      const { run } = setupCliTest({ testProject: "simple1" });
      const result = await run("ls-scripts", "-j", "-p");
      expect(result.stderr.raw).toBeEmpty();
      expect(result.exitCode).toBe(0);
      assertOutputMatches(
        result.stdout.raw,
        JSON.stringify(EXPECTED_SCRIPTS_JSON_SIMPLE1, null, 2),
      );
    });

    test("--name-only --json outputs script names only", async () => {
      const { run } = setupCliTest({ testProject: "simple1" });
      const result = await run("ls-scripts", "--name-only", "--json");
      expect(result.stderr.raw).toBeEmpty();
      expect(result.exitCode).toBe(0);
      assertOutputMatches(
        result.stdout.raw,
        JSON.stringify(EXPECTED_SCRIPTS_JSON_SIMPLE1.map(({ name }) => name)),
      );
    });

    test("-n -j outputs script names only", async () => {
      const { run } = setupCliTest({ testProject: "simple1" });
      const result = await run("ls-scripts", "-n", "-j");
      expect(result.stderr.raw).toBeEmpty();
      expect(result.exitCode).toBe(0);
      assertOutputMatches(
        result.stdout.raw,
        JSON.stringify(EXPECTED_SCRIPTS_JSON_SIMPLE1.map(({ name }) => name)),
      );
    });

    test("--name-only --json --pretty outputs pretty script names", async () => {
      const { run } = setupCliTest({ testProject: "simple1" });
      const result = await run(
        "ls-scripts",
        "--name-only",
        "--json",
        "--pretty",
      );
      expect(result.stderr.raw).toBeEmpty();
      expect(result.exitCode).toBe(0);
      assertOutputMatches(
        result.stdout.raw,
        JSON.stringify(
          EXPECTED_SCRIPTS_JSON_SIMPLE1.map(({ name }) => name),
          null,
          2,
        ),
      );
    });

    test("-n -j -p outputs pretty script names", async () => {
      const { run } = setupCliTest({ testProject: "simple1" });
      const result = await run("ls-scripts", "-n", "-j", "-p");
      expect(result.stderr.raw).toBeEmpty();
      expect(result.exitCode).toBe(0);
      assertOutputMatches(
        result.stdout.raw,
        JSON.stringify(
          EXPECTED_SCRIPTS_JSON_SIMPLE1.map(({ name }) => name),
          null,
          2,
        ),
      );
    });
  });

  describe("project states", () => {
    // "exits with error when project has no bun.lock" moved to
    // tests/packageManagers/bun/cli/missingLockfileErrors.test.ts
    // (consolidated with the equivalent tests for ls and list-tags).

    test("outputs 'No scripts found' when project has no scripts", async () => {
      const { run } = setupCliTest({ testProject: "emptyScripts" });
      const result = await run("ls-scripts");
      expect(result.stderr.raw).toBeEmpty();
      expect(result.exitCode).toBe(0);
      assertOutputMatches(result.stdout.raw, "No scripts found");
    });
  });

  test("exits with error for invalid project", async () => {
    // Stage the malformed package.json in an isolated tmp dir so the
    // default walk-up can't escape to an ancestor monorepo. The test
    // target is pacwich's package.json shape validation; --pm bun
    // skips lockfile auto-detection so we reach that validation.
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pacwich-badjson-"));
    try {
      fs.writeFileSync(path.join(tmpDir, "package.json"), "[]");

      const { run } = setupCliTest({ workingDirectory: tmpDir });
      const result = await run("--pm", "bun", "ls-scripts");
      expect(result.exitCode).toBe(1);
      assertOutputMatches(
        result.stderr.sanitizedCompactLines,
        "Expected package.json to be an object, got object",
      );
    } finally {
      fs.rmSync(tmpDir, { force: true, recursive: true });
    }
  });
});
