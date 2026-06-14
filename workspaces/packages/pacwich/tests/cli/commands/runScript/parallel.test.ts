import os from "os";
import { getUserEnvVar } from "../../../../src/config/userEnvVars";
import { setupCliTest, assertOutputMatches } from "../../../util/cliTestUtils";
import { test, expect, describe } from "../../../util/testFramework";

describe("CLI Run Script (parallel)", () => {
  describe("series vs parallel", () => {
    test("parallel is default", async () => {
      const { run } = setupCliTest({
        testProject: "runScriptWithDelays",
      });
      const result = await run("run-script", "test-delay");
      expect(result.exitCode).toBe(0);
      assertOutputMatches(
        result.stdout.sanitizedCompactLines,
        `[first] first
[second] second
[third] third
[fourth] fourth
[fifth] fifth
✅ fifth: test-delay
✅ first: test-delay
✅ fourth: test-delay
✅ second: test-delay
✅ third: test-delay
5 scripts ran successfully`,
      );
    });

    test("--parallel=false runs scripts in series", async () => {
      const { run } = setupCliTest({
        testProject: "runScriptWithDelays",
      });
      const result = await run("run-script", "test-delay", "--parallel=false");
      expect(result.exitCode).toBe(0);
      assertOutputMatches(
        result.stdout.sanitizedCompactLines,
        `[fifth] fifth
[first] first
[fourth] fourth
[second] second
[third] third
✅ fifth: test-delay
✅ first: test-delay
✅ fourth: test-delay
✅ second: test-delay
✅ third: test-delay
5 scripts ran successfully`,
      );
    });

    test("-P false runs scripts in series", async () => {
      const { run } = setupCliTest({
        testProject: "runScriptWithDelays",
      });
      const result = await run("run-script", "test-delay", "-P", "false");
      expect(result.exitCode).toBe(0);
      assertOutputMatches(
        result.stdout.sanitizedCompactLines,
        `[fifth] fifth
[first] first
[fourth] fourth
[second] second
[third] third
✅ fifth: test-delay
✅ first: test-delay
✅ fourth: test-delay
✅ second: test-delay
✅ third: test-delay
5 scripts ran successfully`,
      );
    });

    test("--parallel runs scripts in parallel", async () => {
      const { run } = setupCliTest({
        testProject: "runScriptWithDelays",
      });
      const result = await run("run-script", "test-delay", "--parallel");
      expect(result.exitCode).toBe(0);
      assertOutputMatches(
        result.stdout.sanitizedCompactLines,
        `[first] first
[second] second
[third] third
[fourth] fourth
[fifth] fifth
✅ fifth: test-delay
✅ first: test-delay
✅ fourth: test-delay
✅ second: test-delay
✅ third: test-delay
5 scripts ran successfully`,
      );
    });

    test("-P runs scripts in parallel", async () => {
      const { run } = setupCliTest({
        testProject: "runScriptWithDelays",
      });
      const result = await run("run-script", "test-delay", "-P");
      expect(result.exitCode).toBe(0);
      assertOutputMatches(
        result.stdout.sanitizedCompactLines,
        `[first] first
[second] second
[third] third
[fourth] fourth
[fifth] fifth
✅ fifth: test-delay
✅ first: test-delay
✅ fourth: test-delay
✅ second: test-delay
✅ third: test-delay
5 scripts ran successfully`,
      );
    });
  });

  test("--parallel with root default", async () => {
    const { run } = setupCliTest({
      testProject: "runScriptWithDebugParallelMaxRootDefault",
    });
    const result = await run("run-script", "test-debug");
    expect(result.exitCode).toBe(0);
    assertOutputMatches(result.stdout.sanitizedCompactLines, /\[a\] 3/);
  });

  describe("invalid parallel values", () => {
    test("--parallel=garbage exits non-zero with a clean error", async () => {
      const { run } = setupCliTest({ testProject: "simple1" });
      const result = await run(
        "run-script",
        "all-workspaces",
        "--parallel=garbage",
      );
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr.sanitized).toMatch(/Invalid parallel max value/);
    });

    test("--parallel=-1 exits non-zero with the 'at least 1' error", async () => {
      const { run } = setupCliTest({ testProject: "simple1" });
      const result = await run("run-script", "all-workspaces", "--parallel=-1");
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr.sanitized).toMatch(/at least 1/);
    });

    test("--parallel=0% exits non-zero with the percentage range error", async () => {
      const { run } = setupCliTest({ testProject: "simple1" });
      const result = await run("run-script", "all-workspaces", "--parallel=0%");
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr.sanitized).toMatch(
        /greater than 0 and less than or equal to 100/,
      );
    });
  });

  describe("parallel max", () => {
    test.each([1, 2, 3, "default", "auto", "unbounded", "100%", "50%"])(
      "parallel with max (%p)",
      async (max) => {
        const { run } = setupCliTest({
          testProject: "runScriptWithDebugParallelMax",
        });
        const { stdout } = await run(
          "run-script",
          "test-debug",
          "-P",
          max.toString(),
        );

        const createOutput = (max: number | string) => `[a] ${max}`;

        if (typeof max === "number") {
          expect(stdout.sanitizedCompactLines).toStartWith(createOutput(max));
        } else if (max === "default") {
          expect(stdout.sanitizedCompactLines).toStartWith(
            createOutput(
              getUserEnvVar("parallelMaxDefault")?.trim() ??
                os.availableParallelism().toString(),
            ),
          );
        } else if (max === "auto") {
          expect(stdout.sanitizedCompactLines).toStartWith(
            createOutput(os.availableParallelism().toString()),
          );
        } else if (max === "unbounded") {
          expect(stdout.sanitizedCompactLines).toStartWith(
            createOutput("Infinity"),
          );
        } else if (max.endsWith("%")) {
          expect(stdout.sanitizedCompactLines).toStartWith(
            createOutput(
              Math.max(
                1,
                Math.floor(
                  (os.availableParallelism() * parseFloat(max.slice(0, -1))) /
                    100,
                ),
              ).toString(),
            ),
          );
        }
      },
    );
  });
});
