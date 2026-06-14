import { setupCliTest, assertOutputMatches } from "../../../util/cliTestUtils";
import { test, expect, describe } from "../../../util/testFramework";

describe("CLI Run Script (dependency order)", () => {
  test("withDependenciesSimple - runs in alphanumerical order without --dep-order", async () => {
    const { run } = setupCliTest({ testProject: "withDependenciesSimple" });
    const result = await run("run", "test-script", "--parallel=false");
    expect(result.exitCode).toBe(0);
    assertOutputMatches(
      result.stdout.sanitizedCompactLines,
      `[a-depends-e] A
[b-depends-cd] B
[c-depends-e] C
[d-depends-e] D
[e] E
✅ a-depends-e: test-script
✅ b-depends-cd: test-script
✅ c-depends-e: test-script
✅ d-depends-e: test-script
✅ e: test-script
5 scripts ran successfully`,
    );
  });

  test("withDependenciesSimple - runs in dependency graph order with --dep-order", async () => {
    const { run } = setupCliTest({ testProject: "withDependenciesSimple" });
    const result = await run(
      "run",
      "test-script",
      "--dep-order",
      "--parallel=false",
    );
    expect(result.exitCode).toBe(0);
    assertOutputMatches(
      result.stdout.sanitizedCompactLines,
      `[e] E
[a-depends-e] A
[c-depends-e] C
[d-depends-e] D
[b-depends-cd] B
✅ a-depends-e: test-script
✅ b-depends-cd: test-script
✅ c-depends-e: test-script
✅ d-depends-e: test-script
✅ e: test-script
5 scripts ran successfully`,
    );
  });

  test("withDependenciesDirectCycle - logs cycle warning and runs remaining graph in order with --dep-order", async () => {
    const { run } = setupCliTest({
      testProject: "withDependenciesDirectCycle",
    });
    const result = await run(
      "run",
      "test-script",
      "--dep-order",
      "--parallel=false",
    );
    expect(result.exitCode).toBe(0);
    assertOutputMatches(
      result.stderr.sanitizedCompactLines,
      /Dependency cycle detected: a-depends-c -> c-depends-a/,
    );
    assertOutputMatches(
      result.stdout.sanitizedCompactLines,
      `[a-depends-c] A
[c-depends-a] C
[b-depends-c] B
✅ a-depends-c: test-script
✅ b-depends-c: test-script
✅ c-depends-a: test-script
3 scripts ran successfully`,
    );
  });

  test("withDependenciesWithFailures - skips dependents of failed workspaces with --dep-order", async () => {
    const { run } = setupCliTest({
      testProject: "withDependenciesWithFailures",
    });
    const result = await run(
      "run",
      "test-script",
      "--dep-order",
      "--parallel=false",
    );
    expect(result.exitCode).toBe(1);
    assertOutputMatches(
      result.stdout.sanitizedCompactLines,
      `[e] E
[c-depends-e-fails] C
[d-depends-e] D
[f-fails] F
➖ a-depends-f: test-script (skipped due to dependency failure)
➖ b-depends-cd: test-script (skipped due to dependency failure)
❌ c-depends-e-fails: test-script (exited with code 1)
✅ d-depends-e: test-script
✅ e: test-script
❌ f-fails: test-script (exited with code 1)
4 of 6 scripts failed (2 skipped)`,
    );
  });

  test("withDependenciesWithFailures - runs all workspaces with --dep-order --ignore-dep-failure", async () => {
    const { run } = setupCliTest({
      testProject: "withDependenciesWithFailures",
    });
    const result = await run(
      "run",
      "test-script",
      "--dep-order",
      "--ignore-dep-failure",
      "--parallel=false",
    );
    expect(result.exitCode).toBe(1);
    assertOutputMatches(
      result.stdout.sanitizedCompactLines,
      `[e] E
[c-depends-e-fails] C
[d-depends-e] D
[b-depends-cd] B
[f-fails] F
[a-depends-f] A
✅ a-depends-f: test-script
✅ b-depends-cd: test-script
❌ c-depends-e-fails: test-script (exited with code 1)
✅ d-depends-e: test-script
✅ e: test-script
❌ f-fails: test-script (exited with code 1)
2 of 6 scripts failed`,
    );
  });
});
