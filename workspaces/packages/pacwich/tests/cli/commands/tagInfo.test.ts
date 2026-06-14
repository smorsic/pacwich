import {
  assertOutputMatches,
  listCommandAndAliases,
  setupCliTest,
} from "../../util/cliTestUtils";
import { describe, expect, test } from "../../util/testFramework";

const APP_TAG_PLAIN_OUTPUT = `Tag: app
 - application-1a
 - application-1b`;

const EXPECTED_APP_TAG_JSON = {
  name: "app",
  workspaces: ["application-1a", "application-1b"],
};

describe("Tag Info", () => {
  describe("output format", () => {
    test.each(listCommandAndAliases("tagInfo"))(
      "plain output for tag with multiple workspaces: %s",
      async (command) => {
        const { run } = setupCliTest({ testProject: "workspaceTags" });
        const result = await run(command, "app");
        expect(result.stderr.raw).toBeEmpty();
        expect(result.exitCode).toBe(0);
        assertOutputMatches(result.stdout.raw, APP_TAG_PLAIN_OUTPUT);
      },
    );

    test("--json outputs tag info as JSON", async () => {
      const { run } = setupCliTest({ testProject: "workspaceTags" });
      const result = await run("tag-info", "app", "--json");
      expect(result.stderr.raw).toBeEmpty();
      expect(result.exitCode).toBe(0);
      assertOutputMatches(
        result.stdout.raw,
        JSON.stringify(EXPECTED_APP_TAG_JSON),
      );
    });

    test("-j outputs tag info as JSON", async () => {
      const { run } = setupCliTest({ testProject: "workspaceTags" });
      const result = await run("tag-info", "app", "-j");
      expect(result.stderr.raw).toBeEmpty();
      expect(result.exitCode).toBe(0);
      assertOutputMatches(
        result.stdout.raw,
        JSON.stringify(EXPECTED_APP_TAG_JSON),
      );
    });

    test("--json --pretty outputs pretty-printed JSON", async () => {
      const { run } = setupCliTest({ testProject: "workspaceTags" });
      const result = await run("tag-info", "app", "--json", "--pretty");
      expect(result.stderr.raw).toBeEmpty();
      expect(result.exitCode).toBe(0);
      assertOutputMatches(
        result.stdout.raw,
        JSON.stringify(EXPECTED_APP_TAG_JSON, null, 2),
      );
    });

    test("-j -p outputs pretty-printed JSON", async () => {
      const { run } = setupCliTest({ testProject: "workspaceTags" });
      const result = await run("tag-info", "app", "-j", "-p");
      expect(result.stderr.raw).toBeEmpty();
      expect(result.exitCode).toBe(0);
      assertOutputMatches(
        result.stdout.raw,
        JSON.stringify(EXPECTED_APP_TAG_JSON, null, 2),
      );
    });
  });

  test("exits with error when tag does not exist", async () => {
    const { run } = setupCliTest({ testProject: "workspaceTags" });
    const result = await run("tag-info", "does-not-exist");
    expect(result.stdout.raw).toBeEmpty();
    expect(result.exitCode).toBe(1);
    assertOutputMatches(
      result.stderr.sanitized,
      'Tag not found: "does-not-exist"',
    );
  });
});
