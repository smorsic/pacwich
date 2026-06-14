import {
  assertOutputMatches,
  listCommandAndAliases,
  setupCliTest,
} from "../../util/cliTestUtils";
import { describe, expect, test } from "../../util/testFramework";

const EXPECTED_TAGS_JSON = [
  { tag: "app", workspaces: ["application-1a", "application-1b"] },
  { tag: "lib", workspaces: ["library-1a", "library-1b"] },
  {
    tag: "workspace",
    workspaces: [
      "application-1a",
      "application-1b",
      "library-1a",
      "library-1b",
    ],
  },
];

const PLAIN_OUTPUT = `Tag: app
 - application-1a
 - application-1b
Tag: lib
 - library-1a
 - library-1b
Tag: workspace
 - application-1a
 - application-1b
 - library-1a
 - library-1b`;

describe("List Tags", () => {
  describe("output format", () => {
    test.each(listCommandAndAliases("listTags"))(
      "plain output lists tags with workspaces: %s",
      async (command) => {
        const { run } = setupCliTest({ testProject: "workspaceTags" });
        const result = await run(command);
        expect(result.stderr.raw).toBeEmpty();
        expect(result.exitCode).toBe(0);
        assertOutputMatches(result.stdout.raw, PLAIN_OUTPUT);
      },
    );

    test("--json outputs tag list as JSON", async () => {
      const { run } = setupCliTest({ testProject: "workspaceTags" });
      const result = await run("list-tags", "--json");
      expect(result.stderr.raw).toBeEmpty();
      expect(result.exitCode).toBe(0);
      assertOutputMatches(
        result.stdout.raw,
        JSON.stringify(EXPECTED_TAGS_JSON),
      );
    });

    test("-j outputs tag list as JSON", async () => {
      const { run } = setupCliTest({ testProject: "workspaceTags" });
      const result = await run("list-tags", "-j");
      expect(result.stderr.raw).toBeEmpty();
      expect(result.exitCode).toBe(0);
      assertOutputMatches(
        result.stdout.raw,
        JSON.stringify(EXPECTED_TAGS_JSON),
      );
    });

    test("--json --pretty outputs pretty-printed JSON", async () => {
      const { run } = setupCliTest({ testProject: "workspaceTags" });
      const result = await run("list-tags", "--json", "--pretty");
      expect(result.stderr.raw).toBeEmpty();
      expect(result.exitCode).toBe(0);
      assertOutputMatches(
        result.stdout.raw,
        JSON.stringify(EXPECTED_TAGS_JSON, null, 2),
      );
    });

    test("-j -p outputs pretty-printed JSON", async () => {
      const { run } = setupCliTest({ testProject: "workspaceTags" });
      const result = await run("list-tags", "-j", "-p");
      expect(result.stderr.raw).toBeEmpty();
      expect(result.exitCode).toBe(0);
      assertOutputMatches(
        result.stdout.raw,
        JSON.stringify(EXPECTED_TAGS_JSON, null, 2),
      );
    });

    test("--name-only outputs tag names only", async () => {
      const { run } = setupCliTest({ testProject: "workspaceTags" });
      const result = await run("list-tags", "--name-only");
      expect(result.stderr.raw).toBeEmpty();
      expect(result.exitCode).toBe(0);
      assertOutputMatches(result.stdout.raw, "app\nlib\nworkspace");
    });

    test("-n outputs tag names only", async () => {
      const { run } = setupCliTest({ testProject: "workspaceTags" });
      const result = await run("list-tags", "-n");
      expect(result.stderr.raw).toBeEmpty();
      expect(result.exitCode).toBe(0);
      assertOutputMatches(result.stdout.raw, "app\nlib\nworkspace");
    });

    test("--name-only --json outputs tag names as JSON", async () => {
      const { run } = setupCliTest({ testProject: "workspaceTags" });
      const result = await run("list-tags", "--name-only", "--json");
      expect(result.stderr.raw).toBeEmpty();
      expect(result.exitCode).toBe(0);
      assertOutputMatches(
        result.stdout.raw,
        JSON.stringify(EXPECTED_TAGS_JSON.map(({ tag }) => tag)),
      );
    });

    test("-n -j outputs tag names as JSON", async () => {
      const { run } = setupCliTest({ testProject: "workspaceTags" });
      const result = await run("list-tags", "-n", "-j");
      expect(result.stderr.raw).toBeEmpty();
      expect(result.exitCode).toBe(0);
      assertOutputMatches(
        result.stdout.raw,
        JSON.stringify(EXPECTED_TAGS_JSON.map(({ tag }) => tag)),
      );
    });

    test("--name-only --json --pretty outputs pretty tag names", async () => {
      const { run } = setupCliTest({ testProject: "workspaceTags" });
      const result = await run(
        "list-tags",
        "--name-only",
        "--json",
        "--pretty",
      );
      expect(result.stderr.raw).toBeEmpty();
      expect(result.exitCode).toBe(0);
      assertOutputMatches(
        result.stdout.raw,
        JSON.stringify(
          EXPECTED_TAGS_JSON.map(({ tag }) => tag),
          null,
          2,
        ),
      );
    });

    test("-n -j -p outputs pretty tag names", async () => {
      const { run } = setupCliTest({ testProject: "workspaceTags" });
      const result = await run("list-tags", "-n", "-j", "-p");
      expect(result.stderr.raw).toBeEmpty();
      expect(result.exitCode).toBe(0);
      assertOutputMatches(
        result.stdout.raw,
        JSON.stringify(
          EXPECTED_TAGS_JSON.map(({ tag }) => tag),
          null,
          2,
        ),
      );
    });
  });

  describe("project states", () => {
    // "exits with error when project has no bun.lock" moved to
    // tests/packageManagers/bun/cli/missingLockfileErrors.test.ts
    // (consolidated with the equivalent tests for ls-scripts and ls).

    test("outputs 'No tags found' when project has no tags", async () => {
      const { run } = setupCliTest({ testProject: "emptyScripts" });
      const result = await run("list-tags");
      expect(result.stderr.raw).toBeEmpty();
      expect(result.exitCode).toBe(0);
      assertOutputMatches(result.stdout.raw, "No tags found");
    });
  });
});
