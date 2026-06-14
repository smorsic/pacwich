import { setupCliTest, assertOutputMatches } from "../../../util/cliTestUtils";
import { test, expect, describe } from "../../../util/testFramework";

describe("CLI Run Script (positional vs flag args)", () => {
  describe("script name: option vs positional", () => {
    test("--script runs script by name", async () => {
      const { run } = setupCliTest({ testProject: "simple1" });
      const result = await run(
        "run-script",
        "--script=a-workspaces",
        "--parallel=false",
      );
      expect(result.exitCode).toBe(0);
      assertOutputMatches(
        result.stdoutAndErr.sanitizedCompactLines,
        `[application-1a] script for a workspaces
[library-1a] script for a workspaces
✅ application-1a: a-workspaces
✅ library-1a: a-workspaces
2 scripts ran successfully`,
      );
    });

    test("-S runs script by name", async () => {
      const { run } = setupCliTest({ testProject: "simple1" });
      const result = await run(
        "run-script",
        "-S",
        "a-workspaces",
        "--parallel=false",
      );
      expect(result.exitCode).toBe(0);
      assertOutputMatches(
        result.stdoutAndErr.sanitizedCompactLines,
        `[application-1a] script for a workspaces
[library-1a] script for a workspaces
✅ application-1a: a-workspaces
✅ library-1a: a-workspaces
2 scripts ran successfully`,
      );
    });

    test("positional script name runs script", async () => {
      const { run } = setupCliTest({ testProject: "simple1" });
      const result = await run(
        "run-script",
        "a-workspaces",
        "--parallel=false",
      );
      expect(result.exitCode).toBe(0);
      assertOutputMatches(
        result.stdoutAndErr.sanitizedCompactLines,
        `[application-1a] script for a workspaces
[library-1a] script for a workspaces
✅ application-1a: a-workspaces
✅ library-1a: a-workspaces
2 scripts ran successfully`,
      );
    });
  });

  describe("script with workspace patterns", () => {
    test("--script with inline workspace patterns", async () => {
      const { run } = setupCliTest({ testProject: "simple1" });
      const result = await run(
        "run-script",
        "--script=a-workspaces",
        "application-*",
        "--parallel=false",
      );
      expect(result.exitCode).toBe(0);
      assertOutputMatches(
        result.stdout.sanitizedCompactLines,
        `[application-1a] script for a workspaces
✅ application-1a: a-workspaces
1 script ran successfully`,
      );
    });

    test("--script with multiple inline workspace patterns", async () => {
      const { run } = setupCliTest({ testProject: "simple1" });
      const result = await run(
        "run-script",
        "--script=all-workspaces",
        "library-1a",
        "library-*",
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

    test("--workspace-patterns with --script", async () => {
      const { run } = setupCliTest({ testProject: "simple1" });
      const result = await run(
        "run-script",
        "--workspace-patterns=library-1a library-*",
        "--script=all-workspaces",
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
  });

  test("errors when both inline workspace patterns and --workspace-patterns used", async () => {
    const { run } = setupCliTest({ testProject: "simple1" });
    const result = await run(
      "run-script",
      "all-workspaces",
      "--workspace-patterns=library-1a library-*",
      "--script=all-workspaces",
      "--parallel=false",
    );
    expect(result.exitCode).toBe(1);
    assertOutputMatches(
      result.stderr.sanitizedCompactLines,
      "CLI syntax error: Cannot use both inline workspace patterns and --workspace-patterns|-W option",
    );
  });
});
