import { setupCliTest, assertOutputMatches } from "../../../util/cliTestUtils";
import { test, expect, describe } from "../../../util/testFramework";

describe("CLI Run Script (sequence config)", () => {
  describe("delay project with sequence config", () => {
    test("series runs in configured order", async () => {
      const { run } = setupCliTest({
        testProject: "runScriptWithDelaysAndSequenceConfig",
      });
      const result = await run("run-script", "test-delay", "--parallel=false");
      expect(result.exitCode).toBe(0);
      assertOutputMatches(
        result.stdoutAndErr.sanitizedCompactLines,
        `[first] first
[second] second
[third] third
[fourth] fourth
[fifth] fifth
✅ first: test-delay
✅ second: test-delay
✅ third: test-delay
✅ fourth: test-delay
✅ fifth: test-delay
5 scripts ran successfully`,
      );
    });
  });

  describe("sequence config (full order)", () => {
    test("series runs in configured order", async () => {
      const { run } = setupCliTest({
        testProject: "runScriptWithSequenceConfig",
      });
      const result = await run("run-script", "test-echo", "--parallel=false");
      expect(result.exitCode).toBe(0);
      assertOutputMatches(
        result.stdoutAndErr.sanitizedCompactLines,
        `[first] first
[second] second
[third] third
[fourth] fourth
[fifth] fifth
✅ first: test-echo
✅ second: test-echo
✅ third: test-echo
✅ fourth: test-echo
✅ fifth: test-echo
5 scripts ran successfully`,
      );
    });

    test("parallel runs (order may vary)", async () => {
      const { run } = setupCliTest({
        testProject: "runScriptWithSequenceConfig",
      });
      const result = await run("run-script", "test-echo", "--parallel=false");
      expect(result.exitCode).toBe(0);
      assertOutputMatches(
        result.stdoutAndErr.sanitizedCompactLines,
        new RegExp(`
✅ first: test-echo
✅ second: test-echo
✅ third: test-echo
✅ fourth: test-echo
✅ fifth: test-echo
5 scripts ran successfully`),
      );
    });
  });

  describe("sequence config (partial order)", () => {
    test("series runs in configured order", async () => {
      const { run } = setupCliTest({
        testProject: "runScriptWithSequenceConfigPartial",
      });
      const result = await run("run-script", "test-echo", "--parallel=false");
      expect(result.exitCode).toBe(0);
      assertOutputMatches(
        result.stdoutAndErr.sanitizedCompactLines,
        `[e] e
[d] d
[b] b
[a] a
[c] c
✅ e: test-echo
✅ d: test-echo
✅ b: test-echo
✅ a: test-echo
✅ c: test-echo
5 scripts ran successfully`,
      );
    });

    test("parallel runs (order may vary)", async () => {
      const { run } = setupCliTest({
        testProject: "runScriptWithSequenceConfigPartial",
      });
      const result = await run("run-script", "test-echo", "--parallel");
      expect(result.exitCode).toBe(0);
      assertOutputMatches(
        result.stdoutAndErr.sanitizedCompactLines,
        new RegExp(`✅ e: test-echo
✅ d: test-echo
✅ b: test-echo
✅ a: test-echo
✅ c: test-echo
5 scripts ran successfully`),
      );
    });
  });
});
