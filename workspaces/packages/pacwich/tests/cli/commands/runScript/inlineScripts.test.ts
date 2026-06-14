import { setupCliTest, assertOutputMatches } from "../../../util/cliTestUtils";
import { test, expect, describe } from "../../../util/testFramework";

describe("CLI Run Script (inline scripts)", () => {
  test("--inline runs inline script with <workspaceName> interpolation", async () => {
    const { run } = setupCliTest({
      testProject: "runScriptWithEchoArgs",
    });
    const result = await run(
      "run-script",
      "echo this is my inline script for <workspaceName>",
      "--inline",
      "--parallel=false",
    );
    expect(result.exitCode).toBe(0);
    assertOutputMatches(
      result.stdoutAndErr.sanitizedCompactLines,
      `[application-1a] this is my inline script for application-1a
[application-1b] this is my inline script for application-1b
[library-1a] this is my inline script for library-1a
[library-1b] this is my inline script for library-1b
✅ application-1a: (inline)
✅ application-1b: (inline)
✅ library-1a: (inline)
✅ library-1b: (inline)
4 scripts ran successfully`,
    );
  });

  test("-i runs inline script with <workspaceName> interpolation", async () => {
    const { run } = setupCliTest({
      testProject: "runScriptWithEchoArgs",
    });
    const result = await run(
      "run-script",
      "echo this is my inline script for <workspaceName>",
      "-i",
      "--parallel=false",
    );
    expect(result.exitCode).toBe(0);
    assertOutputMatches(
      result.stdoutAndErr.sanitizedCompactLines,
      `[application-1a] this is my inline script for application-1a
[application-1b] this is my inline script for application-1b
[library-1a] this is my inline script for library-1a
[library-1b] this is my inline script for library-1b
✅ application-1a: (inline)
✅ application-1b: (inline)
✅ library-1a: (inline)
✅ library-1b: (inline)
4 scripts ran successfully`,
    );
  });

  test("--inline with --args interpolates per workspace", async () => {
    const { run } = setupCliTest({
      testProject: "runScriptWithEchoArgs",
    });
    const result = await run(
      "run-script",
      "echo this is my inline script for <workspaceName>",
      "--inline",
      "--args=test-args-<workspaceName>",
      "--parallel=false",
    );
    expect(result.exitCode).toBe(0);
    assertOutputMatches(
      result.stdoutAndErr.sanitizedCompactLines,
      `[application-1a] this is my inline script for application-1a test-args-application-1a
[application-1b] this is my inline script for application-1b test-args-application-1b
[library-1a] this is my inline script for library-1a test-args-library-1a
[library-1b] this is my inline script for library-1b test-args-library-1b
✅ application-1a: (inline)
✅ application-1b: (inline)
✅ library-1a: (inline)
✅ library-1b: (inline)
4 scripts ran successfully`,
    );
  });

  test("--inline with --args and --output-style=plain", async () => {
    const { run } = setupCliTest({
      testProject: "runScriptWithEchoArgs",
    });
    const result = await run(
      "run-script",
      "echo this is my inline script for <workspaceName>",
      "--inline",
      "--args=test-args-<workspaceName>",
      "--output-style=plain",
      "--parallel=false",
    );
    expect(result.exitCode).toBe(0);
    assertOutputMatches(
      result.stdoutAndErr.sanitizedCompactLines,
      `this is my inline script for application-1a test-args-application-1a
this is my inline script for application-1b test-args-application-1b
this is my inline script for library-1a test-args-library-1a
this is my inline script for library-1b test-args-library-1b
✅ application-1a: (inline)
✅ application-1b: (inline)
✅ library-1a: (inline)
✅ library-1b: (inline)
4 scripts ran successfully`,
    );
  });
});

describe("CLI Run Script (named inline scripts)", () => {
  test("--inline-name sets script name in output", async () => {
    const { run } = setupCliTest({
      testProject: "runScriptWithEchoArgs",
    });
    const result = await run(
      "run-script",
      "echo this is my inline script for <workspaceName>",
      "--inline",
      "--inline-name=test-echo-inline",
      "--parallel=false",
    );
    expect(result.exitCode).toBe(0);
    assertOutputMatches(
      result.stdoutAndErr.sanitizedCompactLines,
      `[application-1a] this is my inline script for application-1a
[application-1b] this is my inline script for application-1b
[library-1a] this is my inline script for library-1a
[library-1b] this is my inline script for library-1b
✅ application-1a: test-echo-inline
✅ application-1b: test-echo-inline
✅ library-1a: test-echo-inline
✅ library-1b: test-echo-inline
4 scripts ran successfully`,
    );
  });

  test("-I sets script name in output", async () => {
    const { run } = setupCliTest({
      testProject: "runScriptWithEchoArgs",
    });
    const result = await run(
      "run-script",
      "echo this is my inline script for <workspaceName>",
      "-i",
      "-I test-echo-inline",
      "--parallel=false",
    );
    expect(result.exitCode).toBe(0);
    assertOutputMatches(
      result.stdoutAndErr.sanitizedCompactLines,
      `[application-1a] this is my inline script for application-1a
[application-1b] this is my inline script for application-1b
[library-1a] this is my inline script for library-1a
[library-1b] this is my inline script for library-1b
✅ application-1a: test-echo-inline
✅ application-1b: test-echo-inline
✅ library-1a: test-echo-inline
✅ library-1b: test-echo-inline
4 scripts ran successfully`,
    );
  });
});

describe("CLI Run Script (invalid --shell)", () => {
  test("--shell=garbage is rejected by commander (choices enforcement)", async () => {
    const result = await setupCliTest({ testProject: "simple1" }).run(
      "run-script",
      "all-workspaces",
      "--inline",
      "echo hi",
      "--shell=garbage",
    );
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr.sanitized).toMatch(/Allowed choices/);
  });
});
