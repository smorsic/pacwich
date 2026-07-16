import {
  assertOutputMatches,
  listCommandAndAliases,
  setupCliTest,
} from "../../../util/cliTestUtils";
import { describe, expect, test } from "../../../util/testFramework";

/**
 * `list-affected`/`ls-affected` are deprecated in favor of `affected list`
 * and will be removed in a future major version. This shares its
 * implementation with `affected list` (see listAffected.ts's
 * `handleListAffected`), which has the exhaustive test coverage in
 * `./affectedList.test.ts`. These are sanity checks only: that the old
 * command still dispatches, passes options through, and warns.
 */
describe("List Affected (deprecated)", () => {
  test.each(listCommandAndAliases("listAffected"))(
    "%s still lists affected workspace names",
    async (command) => {
      const { run } = setupCliTest({ testProject: "affectedWithInputs" });
      const result = await run(command, "--files", "packages/a/src/index.ts");
      expect(result.exitCode).toBe(0);
      assertOutputMatches(result.stdout.sanitized, "a\nb");
    },
  );

  test("logs a deprecation warning pointing at `affected list`", async () => {
    const { run } = setupCliTest({ testProject: "affectedWithInputs" });
    const result = await run(
      "list-affected",
      "--files",
      "packages/a/src/index.ts",
    );
    expect(result.exitCode).toBe(0);
    expect(result.stderr.sanitized).toContain(
      "[pacwich WARN: DeprecatedListAffectedCliCommand]: list-affected is deprecated and will be removed in a future version. Use `pacwich affected list` instead.",
    );
  });

  test("options still pass through to the shared handler (--explain --json)", async () => {
    const { run } = setupCliTest({ testProject: "affectedWithInputs" });
    const result = await run(
      "list-affected",
      "--files",
      "packages/a/src/index.ts",
      "--explain",
      "--json",
    );
    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.stdout.sanitized);
    expect(parsed).toHaveProperty("workspaceResults");
  });

  test("CLI syntax errors still propagate (--files + --base conflict)", async () => {
    const { run } = setupCliTest({ testProject: "affectedWithInputs" });
    const result = await run(
      "list-affected",
      "--files",
      "packages/a/src/index.ts",
      "--base",
      "main",
    );
    expect(result.exitCode).toBe(1);
    expect(result.stderr.sanitized).toContain(
      "CLI syntax error: --files cannot be used with --base or --head",
    );
  });
});
