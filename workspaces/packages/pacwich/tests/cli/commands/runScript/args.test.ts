import { setupCliTest, assertOutputMatches } from "../../../util/cliTestUtils";
import { test, expect, describe } from "../../../util/testFramework";

describe("CLI Run Script (args)", () => {
  describe("--args / -a", () => {
    test("--args passes literal to script", async () => {
      const { run } = setupCliTest({
        testProject: "runScriptWithEchoArgs",
      });
      const result = await run(
        "run-script",
        "test-echo",
        "--args=test-args",
        "--parallel=false",
      );
      expect(result.exitCode).toBe(0);
      assertOutputMatches(
        result.stdoutAndErr.sanitizedCompactLines,
        `[application-1a] passed args: test-args
[application-1b] passed args: test-args
[library-1a] passed args: test-args
[library-1b] passed args: test-args
✅ application-1a: test-echo
✅ application-1b: test-echo
✅ library-1a: test-echo
✅ library-1b: test-echo
4 scripts ran successfully`,
      );
    });

    test("-a passes literal to script", async () => {
      const { run } = setupCliTest({
        testProject: "runScriptWithEchoArgs",
      });
      const result = await run(
        "run-script",
        "test-echo",
        "-a test-args",
        "--parallel=false",
      );
      expect(result.exitCode).toBe(0);
      assertOutputMatches(
        result.stdoutAndErr.sanitizedCompactLines,
        `[application-1a] passed args: test-args
[application-1b] passed args: test-args
[library-1a] passed args: test-args
[library-1b] passed args: test-args
✅ application-1a: test-echo
✅ application-1b: test-echo
✅ library-1a: test-echo
✅ library-1b: test-echo
4 scripts ran successfully`,
      );
    });

    test("--args interpolates <workspaceName> in quoted value", async () => {
      const { run } = setupCliTest({
        testProject: "runScriptWithEchoArgs",
      });
      const result = await run(
        "run-script",
        "test-echo",
        '--args="hello there <workspaceName>"',
        "--parallel=false",
      );
      expect(result.exitCode).toBe(0);
      assertOutputMatches(
        result.stdoutAndErr.sanitizedCompactLines,
        `[application-1a] passed args: hello there application-1a
[application-1b] passed args: hello there application-1b
[library-1a] passed args: hello there library-1a
[library-1b] passed args: hello there library-1b
✅ application-1a: test-echo
✅ application-1b: test-echo
✅ library-1a: test-echo
✅ library-1b: test-echo
4 scripts ran successfully`,
      );
    });

    test("--args interpolates multiple <workspaceName> placeholders", async () => {
      const { run } = setupCliTest({
        testProject: "runScriptWithEchoArgs",
      });
      const result = await run(
        "run-script",
        "test-echo",
        "--args=<workspaceName> and <workspaceName> and <workspaceName>",
        "--parallel=false",
      );
      expect(result.exitCode).toBe(0);
      assertOutputMatches(
        result.stdoutAndErr.sanitizedCompactLines,
        `[application-1a] passed args: application-1a and application-1a and application-1a
[application-1b] passed args: application-1b and application-1b and application-1b
[library-1a] passed args: library-1a and library-1a and library-1a
[library-1b] passed args: library-1b and library-1b and library-1b
✅ application-1a: test-echo
✅ application-1b: test-echo
✅ library-1a: test-echo
✅ library-1b: test-echo
4 scripts ran successfully`,
      );
    });

    test("--args with workspace patterns interpolates per workspace", async () => {
      const { run } = setupCliTest({
        testProject: "runScriptWithEchoArgs",
      });
      const result = await run(
        "run-script",
        "test-echo",
        "appA",
        "libB",
        "--args=for workspace <workspaceName>",
        "--parallel=false",
      );
      expect(result.exitCode).toBe(0);
      assertOutputMatches(
        result.stdoutAndErr.sanitizedCompactLines,
        `[application-1a] passed args: for workspace application-1a
[library-1b] passed args: for workspace library-1b
✅ application-1a: test-echo
✅ library-1b: test-echo
2 scripts ran successfully`,
      );
    });
  });

  describe("--output-style=plain with --args", () => {
    test("--args=literal with --output-style=plain", async () => {
      const { run } = setupCliTest({
        testProject: "runScriptWithEchoArgs",
      });
      const result = await run(
        "run-script",
        "test-echo",
        "--output-style=plain",
        "--args=test-args",
        "--parallel=false",
      );
      expect(result.exitCode).toBe(0);
      assertOutputMatches(
        result.stdoutAndErr.sanitizedCompactLines,
        `passed args: test-args
passed args: test-args
passed args: test-args
passed args: test-args
✅ application-1a: test-echo
✅ application-1b: test-echo
✅ library-1a: test-echo
✅ library-1b: test-echo
4 scripts ran successfully`,
      );
    });

    test("--args=<workspaceName> with --output-style=plain", async () => {
      const { run } = setupCliTest({
        testProject: "runScriptWithEchoArgs",
      });
      const result = await run(
        "run-script",
        "test-echo",
        "--output-style=plain",
        "--args=<workspaceName>",
        "--parallel=false",
      );
      expect(result.exitCode).toBe(0);
      assertOutputMatches(
        result.stdoutAndErr.sanitizedCompactLines,
        `passed args: application-1a
passed args: application-1b
passed args: library-1a
passed args: library-1b
✅ application-1a: test-echo
✅ application-1b: test-echo
✅ library-1a: test-echo
✅ library-1b: test-echo
4 scripts ran successfully`,
      );
    });
  });

  describe("shell metacharacter sanitization", () => {
    // Regression guard for command injection via string-form --args. Each
    // payload must reach the script as literal argument bytes, never as a
    // separate command run by the shell that pacwich generates.
    const cases: { name: string; payload: string; expected: string }[] = [
      {
        name: "semicolon does not start a new command",
        payload: "; echo INJECTED",
        expected: "passed args: ; echo INJECTED",
      },
      {
        name: "&& does not chain a new command",
        payload: "&& echo INJECTED",
        expected: "passed args: && echo INJECTED",
      },
      {
        name: "pipe does not pipe to a new command",
        payload: "| tee /tmp/pacwich-should-not-exist",
        expected: "passed args: | tee /tmp/pacwich-should-not-exist",
      },
      {
        name: "$(...) command substitution is inert",
        payload: "$(echo INJECTED)",
        expected: "passed args: $ ( echo INJECTED )",
      },
      {
        name: "backtick command substitution is inert",
        payload: "`echo INJECTED`",
        expected: "passed args: `echo INJECTED`",
      },
      {
        name: "glob pattern is passed literally, not expanded",
        payload: "*.ts",
        expected: "passed args: *.ts",
      },
      {
        name: "'#' is preserved as a literal arg, not dropped as a comment",
        payload: "keep # this",
        expected: "passed args: keep # this",
      },
    ];

    for (const { name, payload, expected } of cases) {
      test(name, async () => {
        const { run } = setupCliTest({
          testProject: "runScriptWithEchoArgs",
        });
        const result = await run(
          "run-script",
          "test-echo",
          "appA",
          `--args=${payload}`,
          "--output-style=plain",
          "--parallel=false",
        );
        expect(result.exitCode).toBe(0);
        assertOutputMatches(
          result.stdoutAndErr.sanitizedCompactLines,
          `${expected}
✅ application-1a: test-echo
1 script ran successfully`,
        );
      });
    }

    test("a script name carrying shell metacharacters is not injected", async () => {
      const { run } = setupCliTest({
        testProject: "runScriptWithMetacharScriptName",
      });
      const result = await run(
        "run-script",
        "evil; echo INJECTED",
        "--output-style=plain",
        "--parallel=false",
      );
      expect(result.exitCode).toBe(0);
      assertOutputMatches(
        result.stdoutAndErr.sanitizedCompactLines,
        `ran the real script
✅ pkg-a: evil; echo INJECTED
1 script ran successfully`,
      );
    });
  });

  describe("argument terminator (--)", () => {
    test("args after -- are passed to script", async () => {
      const { run } = setupCliTest({
        testProject: "runScriptWithEchoArgs",
      });
      const result = await run(
        "run-script",
        "test-echo",
        "--parallel=false",
        "--",
        "test-args",
        "--another-arg",
      );
      expect(result.exitCode).toBe(0);
      assertOutputMatches(
        result.stdoutAndErr.sanitizedCompactLines,
        `[application-1a] passed args: test-args --another-arg
[application-1b] passed args: test-args --another-arg
[library-1a] passed args: test-args --another-arg
[library-1b] passed args: test-args --another-arg
✅ application-1a: test-echo
✅ application-1b: test-echo
✅ library-1a: test-echo
✅ library-1b: test-echo
4 scripts ran successfully`,
      );
    });

    test("--args= with empty value runs the script with no appended args", async () => {
      const { run } = setupCliTest({
        testProject: "runScriptWithEchoArgs",
      });
      const result = await run(
        "run-script",
        "test-echo",
        "--args=",
        "--parallel=false",
      );
      expect(result.exitCode).toBe(0);
      assertOutputMatches(
        result.stdoutAndErr.sanitizedCompactLines,
        `[application-1a] passed args:
[application-1b] passed args:
[library-1a] passed args:
[library-1b] passed args:
✅ application-1a: test-echo
✅ application-1b: test-echo
✅ library-1a: test-echo
✅ library-1b: test-echo
4 scripts ran successfully`,
      );
    });

    test("--args= with a leading-dash value passes it as a literal arg", async () => {
      const { run } = setupCliTest({
        testProject: "runScriptWithEchoArgs",
      });
      const result = await run(
        "run-script",
        "test-echo",
        "--args=--my-flag=value",
        "--parallel=false",
      );
      expect(result.exitCode).toBe(0);
      assertOutputMatches(
        result.stdoutAndErr.sanitizedCompactLines,
        `[application-1a] passed args: --my-flag=value
[application-1b] passed args: --my-flag=value
[library-1a] passed args: --my-flag=value
[library-1b] passed args: --my-flag=value
✅ application-1a: test-echo
✅ application-1b: test-echo
✅ library-1a: test-echo
✅ library-1b: test-echo
4 scripts ran successfully`,
      );
    });

    test("errors when both --args and args after -- used", async () => {
      const { run } = setupCliTest({
        testProject: "runScriptWithEchoArgs",
      });
      const result = await run(
        "run-script",
        "test-echo",
        "--args=my-arg",
        "--",
        "test-args",
        "--another-arg",
        "--args=test-args",
        "--parallel=false",
      );
      expect(result.exitCode).toBe(1);
      assertOutputMatches(
        result.stderr.sanitizedCompactLines,
        "CLI syntax error: Cannot use both --args and inline script args after --",
      );
    });
  });
});
