import { setupCliTest, assertOutputMatches } from "../../../util/cliTestUtils";
import { test, expect, describe } from "../../../util/testFramework";

describe("CLI Run Script (workspace patterns)", () => {
  describe("inline workspace patterns", () => {
    test("pattern * matches all workspaces", async () => {
      const { run } = setupCliTest({ testProject: "simple1" });
      const result = await run(
        "run-script",
        "all-workspaces",
        "*",
        "--parallel=false",
      );
      expect(result.exitCode).toBe(0);
      assertOutputMatches(
        result.stdout.sanitizedCompactLines,
        `[application-1a] script for all workspaces
[application-1b] script for all workspaces
[library-1a] script for all workspaces
[library-1b] script for all workspaces
✅ application-1a: all-workspaces
✅ application-1b: all-workspaces
✅ library-1a: all-workspaces
✅ library-1b: all-workspaces
4 scripts ran successfully`,
      );
    });

    test("pattern application* matches application workspaces", async () => {
      const { run } = setupCliTest({ testProject: "simple1" });
      const result = await run(
        "run-script",
        "all-workspaces",
        "application*",
        "--parallel=false",
      );
      expect(result.exitCode).toBe(0);
      assertOutputMatches(
        result.stdout.sanitizedCompactLines,
        `[application-1a] script for all workspaces
[application-1b] script for all workspaces
✅ application-1a: all-workspaces
✅ application-1b: all-workspaces
2 scripts ran successfully`,
      );
    });

    test("multiple patterns match union", async () => {
      const { run } = setupCliTest({ testProject: "simple1" });
      const result = await run(
        "run-script",
        "all-workspaces",
        "application*",
        "library-1a",
        "--parallel=false",
      );
      expect(result.exitCode).toBe(0);
      assertOutputMatches(
        result.stdout.sanitizedCompactLines,
        `[application-1a] script for all workspaces
[application-1b] script for all workspaces
[library-1a] script for all workspaces
✅ application-1a: all-workspaces
✅ application-1b: all-workspaces
✅ library-1a: all-workspaces
3 scripts ran successfully`,
      );
    });

    test("pattern *1a matches by name suffix", async () => {
      const { run } = setupCliTest({ testProject: "simple1" });
      const result = await run(
        "run-script",
        "all-workspaces",
        "*1a",
        "--parallel=false",
      );
      expect(result.exitCode).toBe(0);
      assertOutputMatches(
        result.stdout.sanitizedCompactLines,
        `[application-1a] script for all workspaces
[library-1a] script for all workspaces
✅ application-1a: all-workspaces
✅ library-1a: all-workspaces
2 scripts ran successfully`,
      );
    });

    test("no match exits with error", async () => {
      const { run } = setupCliTest({ testProject: "simple1" });
      const result = await run(
        "run-script",
        "all-workspaces",
        "does-not-exist*",
        "--parallel=false",
      );
      expect(result.exitCode).toBe(1);
      assertOutputMatches(
        result.stderr.sanitizedCompactLines,
        `No matching workspaces found with script "all-workspaces"`,
      );
    });

    test("re: regex pattern matches against name only (default target)", async () => {
      const { run } = setupCliTest({ testProject: "simple1" });
      const result = await run(
        "run-script",
        "all-workspaces",
        "re:^application-1[ab]$",
        "--parallel=false",
      );
      expect(result.exitCode).toBe(0);
      assertOutputMatches(
        result.stdout.sanitizedCompactLines,
        `[application-1a] script for all workspaces
[application-1b] script for all workspaces
✅ application-1a: all-workspaces
✅ application-1b: all-workspaces
2 scripts ran successfully`,
      );
    });

    test("path:re: regex pattern scopes match to workspace path", async () => {
      const { run } = setupCliTest({ testProject: "simple1" });
      const result = await run(
        "run-script",
        "all-workspaces",
        "path:re:^libraries/library[AB]$",
        "--parallel=false",
      );
      expect(result.exitCode).toBe(0);
      assertOutputMatches(
        result.stdout.sanitizedCompactLines,
        `[library-1a] script for all workspaces
[library-1b] script for all workspaces
✅ library-1a: all-workspaces
✅ library-1b: all-workspaces
2 scripts ran successfully`,
      );
    });

    test("invalid regex surfaces an error", async () => {
      const { run } = setupCliTest({ testProject: "simple1" });
      const result = await run(
        "run-script",
        "all-workspaces",
        "re:[unclosed",
        "--parallel=false",
      );
      expect(result.exitCode).toBe(1);
      expect(result.stderr.sanitizedCompactLines).toContain(
        `Invalid regex in workspace pattern "re:[unclosed"`,
      );
    });

    test("aliases match workspaces", async () => {
      const { run } = setupCliTest({ testProject: "simple1" });
      const result = await run(
        "run-script",
        "all-workspaces",
        "appB",
        "libA",
        "--parallel=false",
      );
      expect(result.exitCode).toBe(0);
      assertOutputMatches(
        result.stdout.sanitizedCompactLines,
        `[application-1b] script for all workspaces
[library-1a] script for all workspaces
✅ application-1b: all-workspaces
✅ library-1a: all-workspaces
2 scripts ran successfully`,
      );
    });

    test("not: excludes from a positive set", async () => {
      const { run } = setupCliTest({ testProject: "workspaceTags" });
      const result = await run(
        "run-script",
        "all-workspaces",
        "*",
        "not:tag:lib",
        "--parallel=false",
      );
      expect(result.exitCode).toBe(0);
      assertOutputMatches(
        result.stdout.sanitizedCompactLines,
        `[application-1a] script for all workspaces
[application-1b] script for all workspaces
✅ application-1a: all-workspaces
✅ application-1b: all-workspaces
2 scripts ran successfully`,
      );
    });

    test("not:tag:* excludes via tag with a positive name pattern", async () => {
      const { run } = setupCliTest({ testProject: "workspaceTags" });
      const result = await run(
        "run-script",
        "all-workspaces",
        "library-*",
        "not:tag:lib",
        "--parallel=false",
      );
      expect(result.exitCode).toBe(1);
      assertOutputMatches(
        result.stderr.sanitizedCompactLines,
        `No matching workspaces found with script "all-workspaces"`,
      );
    });

    test("only-negation pattern has no positive set so matches nothing", async () => {
      const { run } = setupCliTest({ testProject: "workspaceTags" });
      const result = await run(
        "run-script",
        "all-workspaces",
        "not:tag:lib",
        "--parallel=false",
      );
      expect(result.exitCode).toBe(1);
      // Should NOT report this as a "name or alias not found" error
      assertOutputMatches(
        result.stderr.sanitizedCompactLines,
        `No matching workspaces found with script "all-workspaces"`,
      );
    });

    test("prefixed specifier with no match does not report as name-not-found", async () => {
      const { run } = setupCliTest({ testProject: "workspaceTags" });
      const result = await run(
        "run-script",
        "all-workspaces",
        "tag:does-not-exist",
        "--parallel=false",
      );
      expect(result.exitCode).toBe(1);
      assertOutputMatches(
        result.stderr.sanitizedCompactLines,
        `No matching workspaces found with script "all-workspaces"`,
      );
    });
  });

  describe("--workspace-patterns / -W", () => {
    test("--workspace-patterns filters workspaces", async () => {
      const { run } = setupCliTest({ testProject: "simple1" });
      const result = await run(
        "run-script",
        "all-workspaces",
        "--workspace-patterns=path:applications/* library-1b",
        "--parallel=false",
      );
      expect(result.exitCode).toBe(0);
      assertOutputMatches(
        result.stdout.sanitizedCompactLines,
        `[application-1a] script for all workspaces
[application-1b] script for all workspaces
[library-1b] script for all workspaces
✅ application-1a: all-workspaces
✅ application-1b: all-workspaces
✅ library-1b: all-workspaces
3 scripts ran successfully`,
      );
    });

    test("-W filters workspaces", async () => {
      const { run } = setupCliTest({ testProject: "simple1" });
      const result = await run(
        "run-script",
        "all-workspaces",
        "-W",
        "path:applications/* library-1b",
        "--parallel=false",
      );
      expect(result.exitCode).toBe(0);
      assertOutputMatches(
        result.stdout.sanitizedCompactLines,
        `[application-1a] script for all workspaces
[application-1b] script for all workspaces
[library-1b] script for all workspaces
✅ application-1a: all-workspaces
✅ application-1b: all-workspaces
✅ library-1b: all-workspaces
3 scripts ran successfully`,
      );
    });
  });

  test("errors when both inline patterns and --workspace-patterns used", async () => {
    const { run } = setupCliTest({ testProject: "simple1" });
    const result = await run(
      "run-script",
      "all-workspaces",
      "--workspace-patterns=path:applications/* library-1b",
      "application-*",
      "library-1b",
      "--parallel=false",
    );
    expect(result.exitCode).toBe(1);
    assertOutputMatches(
      result.stderr.sanitizedCompactLines,
      "CLI syntax error: Cannot use both inline workspace patterns and --workspace-patterns|-W option",
    );
  });
});
