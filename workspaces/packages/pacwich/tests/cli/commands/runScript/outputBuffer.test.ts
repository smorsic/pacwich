import { setupCliTest } from "../../../util/cliTestUtils";
import { test, expect, describe } from "../../../util/testFramework";

const DROP_NOTICE = "output buffer limit reached";

describe("CLI Run Script (--max-output-buffer)", () => {
  test("exits non-zero with a clean error for an unparseable value", async () => {
    const result = await setupCliTest({ testProject: "simple1" }).run(
      "run-script",
      "all-workspaces",
      "--max-output-buffer=notasize",
      "--parallel=false",
    );
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr.sanitized).toMatch(/Invalid --max-output-buffer/i);
  });

  test.each(["16MB", "512KB", "1048576", "unbounded"])(
    "accepts the value %s and runs normally (no drops for small output)",
    async (value) => {
      const result = await setupCliTest({ testProject: "simple1" }).run(
        "run-script",
        "all-workspaces",
        `--max-output-buffer=${value}`,
        "--output-style=plain",
        "--parallel=false",
      );
      expect(result.exitCode).toBe(0);
      // Small output is retained in full, so no drop notice appears.
      expect(result.stdoutAndErr.sanitized).not.toContain(DROP_NOTICE);
      expect(result.stdout.sanitized).toContain("script for all workspaces");
    },
  );

  test("run-affected also accepts --max-output-buffer", async () => {
    const result = await setupCliTest({ testProject: "simple1" }).run(
      "run-affected",
      "all-workspaces",
      "--files=applications/application-1a/**/*",
      "--max-output-buffer=8MB",
      "--output-style=plain",
      "--parallel=false",
    );
    expect(result.exitCode).toBe(0);
  });
});
