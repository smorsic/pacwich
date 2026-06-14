import { setupCliTest, assertOutputMatches } from "../../../util/cliTestUtils";
import { test, expect, describe } from "../../../util/testFramework";

describe("CLI Run Script (basic)", () => {
  describe("running script", () => {
    test("runs script in single matching workspace", async () => {
      const { run } = setupCliTest({});
      const result = await run("run", "application-a", "--parallel=false");
      expect(result.exitCode).toBe(0);
      assertOutputMatches(
        result.stdout.sanitizedCompactLines,
        `[application-a] script for application-a
✅ application-a: application-a
1 script ran successfully`,
      );
    });

    test("runs script in multiple workspaces", async () => {
      const { run } = setupCliTest({});
      const result = await run("run", "a-workspaces", "--parallel=false");
      expect(result.exitCode).toBe(0);
      assertOutputMatches(
        result.stdout.sanitizedCompactLines,
        `[application-a] script for a workspaces
[library-a] script for a workspaces
✅ application-a: a-workspaces
✅ library-a: a-workspaces
2 scripts ran successfully`,
      );
    });

    test("runs script with workspace patterns filtering workspaces", async () => {
      const { run } = setupCliTest({});
      const result = await run(
        "run",
        "a-workspaces",
        "library-a",
        "--parallel=false",
      );
      expect(result.exitCode).toBe(0);
      assertOutputMatches(
        result.stdout.sanitizedCompactLines,
        `[library-a] script for a workspaces
✅ library-a: a-workspaces
1 script ran successfully`,
      );
    });

    test("runs script across all workspaces that have it", async () => {
      const { run } = setupCliTest({});
      const result = await run("run", "all-workspaces", "--parallel=false");
      expect(result.exitCode).toBe(0);
      assertOutputMatches(
        result.stdout.sanitizedCompactLines,
        `[application-a] script for all workspaces
[application-b] script for all workspaces
[library-a] script for all workspaces
[library-b] script for all workspaces
[library-c] script for all workspaces
✅ application-a: all-workspaces
✅ application-b: all-workspaces
✅ library-a: all-workspaces
✅ library-b: all-workspaces
✅ library-c: all-workspaces
5 scripts ran successfully`,
      );
    });
  });

  describe("errors", () => {
    test("errors when no workspaces have script", async () => {
      const { run } = setupCliTest({});
      const result = await run("run", "no-script", "--parallel=false");
      assertOutputMatches(
        result.stderr.sanitizedCompactLines,
        `No matching workspaces found with script "no-script"`,
      );
    });

    test("errors when workspace name or alias not found", async () => {
      const { run } = setupCliTest({});
      const result = await run(
        "run",
        "application-a",
        "does-not-exist",
        "--parallel=false",
      );
      assertOutputMatches(
        result.stderr.sanitizedCompactLines,
        `Workspace name or alias not found: "does-not-exist"`,
      );
    });

    test("errors when script not found with valid workspace pattern", async () => {
      const { run } = setupCliTest({});
      const result = await run(
        "run",
        "does-not-exist",
        "application-a",
        "--parallel=false",
      );
      assertOutputMatches(
        result.stderr.sanitizedCompactLines,
        `No matching workspaces found with script "does-not-exist"`,
      );
    });
  });
});
