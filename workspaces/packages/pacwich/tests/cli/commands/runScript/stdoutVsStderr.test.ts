import { setupCliTest, assertOutputMatches } from "../../../util/cliTestUtils";
import { test, expect, describe } from "../../../util/testFramework";

describe("CLI Run Script (stdout vs. stderr)", () => {
  test("Running with failures", async () => {
    const { run } = setupCliTest({
      testProject: "runScriptWithFailures",
    });

    const result = await run("run-script", "test-exit", "--parallel=false");
    expect(result.exitCode).toBe(1);
    assertOutputMatches(
      result.stdoutAndErr.sanitizedCompactLines,
      `[fail1] fail1
[fail2] fail2
[success1] success1
[success2] success2
❌ fail1: test-exit (exited with code 1)
❌ fail2: test-exit (exited with code 2)
✅ success1: test-exit
✅ success2: test-exit
2 of 4 scripts failed`,
    );
    assertOutputMatches(
      result.stderr.sanitizedCompactLines,
      `[fail1] fail1
[fail2] fail2`,
    );
    assertOutputMatches(
      result.stdout.sanitizedCompactLines,
      `[success1] success1
[success2] success2
❌ fail1: test-exit (exited with code 1)
❌ fail2: test-exit (exited with code 2)
✅ success1: test-exit
✅ success2: test-exit
2 of 4 scripts failed`,
    );
  });

  test("Running with mixed output per script", { timeout: 30000 }, async () => {
    const { run } = setupCliTest({
      testProject: "runScriptWithMixedOutput",
    });

    const result = await run("run-script", "test-exit", "--parallel=false");
    expect(result.exitCode).toBe(1);
    assertOutputMatches(
      result.stdoutAndErr.sanitizedCompactLines,
      `[fail1] fail1 stdout 1
[fail1] fail1 stderr 1
[fail1] fail1 stdout 2
[fail2] fail2 stderr 1
[fail2] fail2 stdout 1
[fail2] fail2 stderr 2
[success1] success1 stdout 1
[success1] success1 stderr 1
[success1] success1 stdout 2
[success1] success1 stderr 2
[success2] success2 stderr 1
[success2] success2 stdout 1
[success2] success2 stderr 2
[success2] success2 stdout 2
❌ fail1: test-exit (exited with code 1)
❌ fail2: test-exit (exited with code 1)
✅ success1: test-exit
✅ success2: test-exit
2 of 4 scripts failed`,
    );
  });
});
