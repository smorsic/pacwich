import { getUserEnvVarName } from "@pacwich/common/config";
import { assertOutputMatches, setupCliTest } from "../../../util/cliTestUtils";
import { afterEach, test, expect, describe } from "../../../util/testFramework";

describe("CLI Run Script (output format)", () => {
  test("--output-style=plain omits prefix from script output", async () => {
    const result = await setupCliTest({
      testProject: "simple1",
    }).run(
      "run-script",
      "all-workspaces",
      "--output-style=plain",
      "--parallel=false",
    );
    expect(result.exitCode).toBe(0);
    assertOutputMatches(
      result.stdoutAndErr.sanitizedCompactLines,
      `script for all workspaces
script for all workspaces
script for all workspaces
script for all workspaces
✅ application-1a: all-workspaces
✅ application-1b: all-workspaces
✅ library-1a: all-workspaces
✅ library-1b: all-workspaces
4 scripts ran successfully`,
    );
  });

  test("--output-style=plain omits prefix from script output (short arg)", async () => {
    const result = await setupCliTest({
      testProject: "simple1",
    }).run("run-script", "all-workspaces", "-o", "plain", "--parallel=false");
    expect(result.exitCode).toBe(0);
    assertOutputMatches(
      result.stdoutAndErr.sanitizedCompactLines,
      `script for all workspaces
script for all workspaces
script for all workspaces
script for all workspaces
✅ application-1a: all-workspaces
✅ application-1b: all-workspaces
✅ library-1a: all-workspaces
✅ library-1b: all-workspaces
4 scripts ran successfully`,
    );
  });

  test("--output-style=prefixed", async () => {
    const result = await setupCliTest({
      testProject: "simple1",
    }).run(
      "run-script",
      "all-workspaces",
      "--output-style=prefixed",
      "--parallel=false",
    );
    expect(result.exitCode).toBe(0);
    assertOutputMatches(
      result.stdoutAndErr.sanitizedCompactLines,
      `[application-1a] script for all workspaces
[application-1b] script for all workspaces
[library-1a] script for all workspaces
[library-1b] script for all workspaces
✅ application-1a: all-workspaces
✅ application-1b: all-workspaces
✅ library-1a: all-workspaces
✅ library-1b: all-workspaces
4 scripts ran successfully`,
    );
  });

  test("--output-style=plain with failures shows failure output", async () => {
    const result = await setupCliTest({
      testProject: "runScriptWithFailures",
    }).run(
      "run-script",
      "test-exit",
      "--output-style=plain",
      "--parallel=false",
    );
    expect(result.exitCode).toBe(1);
    assertOutputMatches(
      result.stdoutAndErr.sanitizedCompactLines,
      `fail1
fail2
success1
success2
❌ fail1: test-exit (exited with code 1)
❌ fail2: test-exit (exited with code 2)
✅ success1: test-exit
✅ success2: test-exit
2 of 4 scripts failed`,
    );
  });

  test("--output-style=none produces no script output", async () => {
    const result = await setupCliTest({
      testProject: "runScriptWithFailures",
    }).run(
      "run-script",
      "test-exit",
      "--output-style=none",
      "--parallel=false",
    );
    expect(result.exitCode).toBe(1);
    assertOutputMatches(
      result.stdoutAndErr.sanitizedCompactLines,
      `❌ fail1: test-exit (exited with code 1)
❌ fail2: test-exit (exited with code 2)
✅ success1: test-exit
✅ success2: test-exit
2 of 4 scripts failed`,
    );
  });

  test("--output-style=none with --log-level=silent produces no output", async () => {
    const result = await setupCliTest({
      testProject: "runScriptWithFailures",
    }).run(
      "--log-level=silent",
      "run-script",
      "test-exit",
      "--output-style=none",
      "--parallel=false",
    );
    expect(result.exitCode).toBe(1);
    assertOutputMatches(result.stdoutAndErr.sanitizedCompactLines, "");
  });

  test("--output-style=banana is rejected by commander (choices enforcement)", async () => {
    const result = await setupCliTest({ testProject: "simple1" }).run(
      "run-script",
      "all-workspaces",
      "--output-style=banana",
    );
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr.sanitized).toMatch(/Allowed choices/);
  });

  test("--grouped-lines=garbage exits non-zero with a clean error", async () => {
    const result = await setupCliTest({ testProject: "simple1" }).run(
      "run-script",
      "all-workspaces",
      "--output-style=grouped",
      "--grouped-lines=garbage",
      "--parallel=false",
    );
    expect(result.exitCode).not.toBe(0);
  });

  test("--no-prefix deprecation warning", async () => {
    const result = await setupCliTest({
      testProject: "simple1",
    }).run("run-script", "all-workspaces", "--no-prefix", "--parallel=false");
    expect(result.exitCode).toBe(0);
    assertOutputMatches(
      result.stderr.sanitizedCompactLines,
      `[pacwich WARN: DeprecatedNoPrefixFlag]: --no-prefix is deprecated and will be removed in a future version. Use --output-style=plain instead.`,
    );
  });

  describe("cliScriptOutputStyle default", () => {
    const ENV_VAR = getUserEnvVarName("cliScriptOutputStyleDefault");

    afterEach(() => {
      delete process.env[ENV_VAR];
    });

    test("project config sets the default output style", async () => {
      const result = await setupCliTest({
        testProject: "projectConfigCliScriptOutputStylePlain",
      }).run("run-script", "echo-hello", "--parallel=false");
      expect(result.exitCode).toBe(0);
      assertOutputMatches(
        result.stdoutAndErr.sanitizedCompactLines,
        `hello-from-a
hello-from-b
✅ workspace-a: echo-hello
✅ workspace-b: echo-hello
2 scripts ran successfully`,
      );
    });

    test("--output-style flag overrides project config default", async () => {
      const result = await setupCliTest({
        testProject: "projectConfigCliScriptOutputStylePlain",
      }).run(
        "run-script",
        "echo-hello",
        "--output-style=prefixed",
        "--parallel=false",
      );
      expect(result.exitCode).toBe(0);
      assertOutputMatches(
        result.stdoutAndErr.sanitizedCompactLines,
        `[workspace-a] hello-from-a
[workspace-b] hello-from-b
✅ workspace-a: echo-hello
✅ workspace-b: echo-hello
2 scripts ran successfully`,
      );
    });

    test("PACWICH_CLI_SCRIPT_OUTPUT_STYLE_DEFAULT env var sets the default", async () => {
      const result = await setupCliTest({
        testProject: "simple1",
        env: { [ENV_VAR]: "plain" },
      }).run("run-script", "all-workspaces", "--parallel=false");
      expect(result.exitCode).toBe(0);
      assertOutputMatches(
        result.stdoutAndErr.sanitizedCompactLines,
        `script for all workspaces
script for all workspaces
script for all workspaces
script for all workspaces
✅ application-1a: all-workspaces
✅ application-1b: all-workspaces
✅ library-1a: all-workspaces
✅ library-1b: all-workspaces
4 scripts ran successfully`,
      );
    });

    test("--output-style flag overrides PACWICH_CLI_SCRIPT_OUTPUT_STYLE_DEFAULT env var", async () => {
      const result = await setupCliTest({
        testProject: "simple1",
        env: { [ENV_VAR]: "plain" },
      }).run(
        "run-script",
        "all-workspaces",
        "--output-style=prefixed",
        "--parallel=false",
      );
      expect(result.exitCode).toBe(0);
      assertOutputMatches(
        result.stdoutAndErr.sanitizedCompactLines,
        `[application-1a] script for all workspaces
[application-1b] script for all workspaces
[library-1a] script for all workspaces
[library-1b] script for all workspaces
✅ application-1a: all-workspaces
✅ application-1b: all-workspaces
✅ library-1a: all-workspaces
✅ library-1b: all-workspaces
4 scripts ran successfully`,
      );
    });

    test("invalid PACWICH_CLI_SCRIPT_OUTPUT_STYLE_DEFAULT env var is ignored with a warning", async () => {
      const result = await setupCliTest({
        testProject: "simple1",
        env: { [ENV_VAR]: "tabular" },
      }).run("run-script", "all-workspaces", "--parallel=false");
      expect(result.exitCode).toBe(0);
      expect(result.stderr.sanitized).toContain(
        `Ignoring invalid PACWICH_CLI_SCRIPT_OUTPUT_STYLE_DEFAULT value "tabular"`,
      );
    });
  });
});
