import { setupCliTest } from "../../../util/cliTestUtils";
import { describe, expect, test } from "../../../util/testFramework";

describe("Affected (parent)", () => {
  test("bare invocation prints usage to stderr and exits non-zero", async () => {
    const { run } = setupCliTest({ testProject: "affectedWithInputs" });
    const result = await run("affected");
    expect(result.exitCode).toBe(1);
    expect(result.stdout.sanitized).toBe("");
    expect(result.stderr.sanitized).toContain("Usage:");
    // Both subcommands are listed in the printed help.
    expect(result.stderr.sanitized).toContain("list");
    expect(result.stderr.sanitized).toContain("run");
  });

  test("the `af` alias behaves the same as the bare word", async () => {
    const { run } = setupCliTest({ testProject: "affectedWithInputs" });
    const result = await run("af");
    expect(result.exitCode).toBe(1);
    expect(result.stderr.sanitized).toContain("Usage:");
  });
});
