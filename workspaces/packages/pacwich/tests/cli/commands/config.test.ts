import { setupCliTest } from "../../util/cliTestUtils";
import { describe, expect, test } from "../../util/testFramework";

describe("Config (parent)", () => {
  test("bare invocation prints usage to stderr and exits non-zero", async () => {
    const { run } = setupCliTest({ testProject: "simple1" });
    const result = await run("config");
    expect(result.exitCode).toBe(1);
    expect(result.stdout.sanitized).toBe("");
    expect(result.stderr.sanitized).toContain("Usage:");
    // The lone subcommand is listed in the printed help.
    expect(result.stderr.sanitized).toContain("debug");
  });
});
