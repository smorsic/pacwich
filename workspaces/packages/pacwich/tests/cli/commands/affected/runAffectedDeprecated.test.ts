import { setupCliTest } from "../../../util/cliTestUtils";
import { describe, expect, test } from "../../../util/testFramework";

/**
 * `run-affected` is deprecated in favor of `affected run` and will be
 * removed in a future major version. This shares its implementation with
 * `affected run` (see handleRunAffected.ts's `handleRunAffected`), which
 * has the exhaustive test coverage in `./affectedRun.test.ts`. These are
 * sanity checks only: that the old command still dispatches, passes
 * options through, and warns.
 */
describe("Run Affected (deprecated)", () => {
  test("still runs a script across affected workspaces", async () => {
    const { run } = setupCliTest({ testProject: "affectedWithInputs" });
    const result = await run(
      "run-affected",
      "echo-script",
      "--files",
      "packages/a/src/index.ts",
      "--parallel=false",
      "--output-style=plain",
    );
    expect(result.exitCode).toBe(0);
    const out = result.stdoutAndErr.sanitizedCompactLines;
    expect(out).toContain("✅ a: echo-script");
    expect(out).toContain("✅ b: echo-script");
  });

  test("logs a deprecation warning pointing at `affected run`", async () => {
    const { run } = setupCliTest({ testProject: "affectedWithInputs" });
    const result = await run(
      "run-affected",
      "echo-script",
      "--files",
      "packages/a/src/index.ts",
      "--parallel=false",
      "--output-style=plain",
    );
    expect(result.exitCode).toBe(0);
    expect(result.stderr.sanitized).toContain(
      "[pacwich WARN: DeprecatedRunAffectedCliCommand]: run-affected is deprecated and will be removed in a future version. Use `pacwich affected run` instead.",
    );
  });

  test("options still pass through to the shared handler (-S short form)", async () => {
    const { run } = setupCliTest({ testProject: "affectedWithInputs" });
    const result = await run(
      "run-affected",
      "-S",
      "echo-script",
      "-F",
      "packages/a/src/index.ts",
      "--parallel=false",
      "--output-style=plain",
    );
    expect(result.exitCode).toBe(0);
    expect(result.stdoutAndErr.sanitizedCompactLines).toContain(
      "2 scripts ran successfully",
    );
  });

  test("CLI syntax errors still propagate (--files + --base conflict)", async () => {
    const { run } = setupCliTest({ testProject: "affectedWithInputs" });
    const result = await run(
      "run-affected",
      "echo-script",
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
