import { IS_WINDOWS } from "../../../../src/internal/core";
import { createCliSubprocess, setupCliTest } from "../../../util/cliTestUtils";
import { describe, expect, test } from "../../../util/testFramework";

describe("run-interactive CLI", () => {
  test("passes script output straight through (no prefix or summary)", async () => {
    const { run } = setupCliTest({ testProject: "default" });
    const result = await run(
      "run-interactive",
      "-W",
      "application-a",
      "-i",
      "echo hello-interactive",
    );
    expect(result.exitCode).toBe(0);
    expect(result.stderr.sanitized.trim()).toBe("");
    expect(result.stdout.sanitized).toContain("hello-interactive");
    // Pure passthrough: no per-workspace prefix in the output.
    expect(result.stdout.sanitized).not.toContain("application-a");
  });

  test("the ri alias works", async () => {
    const { run } = setupCliTest({ testProject: "default" });
    const result = await run("ri", "-W", "application-a", "-i", "echo via-ri");
    expect(result.exitCode).toBe(0);
    expect(result.stdout.sanitized).toContain("via-ri");
  });

  test("runs a named package.json script", async () => {
    const { run } = setupCliTest({ testProject: "default" });
    const result = await run(
      "run-interactive",
      "a-workspaces",
      "-W",
      "application-a",
    );
    expect(result.exitCode).toBe(0);
    expect(result.stdout.sanitized).toContain("script for a workspaces");
  });

  test("accepts the workspace as a second positional argument", async () => {
    const { run } = setupCliTest({ testProject: "default" });
    const result = await run(
      "run-interactive",
      "a-workspaces",
      "application-a",
    );
    expect(result.exitCode).toBe(0);
    expect(result.stdout.sanitized).toContain("script for a workspaces");
  });

  test("propagates the script's exit code", async () => {
    const { run } = setupCliTest({ testProject: "default" });
    const result = await run(
      "run-interactive",
      "-W",
      "application-a",
      "-i",
      "exit 5",
    );
    expect(result.exitCode).toBe(5);
  });

  test("forwards args after --", async () => {
    const { run } = setupCliTest({ testProject: "default" });
    const result = await run(
      "run-interactive",
      "-W",
      "application-a",
      "-i",
      "echo got:",
      "--",
      "--flag",
      "value",
    );
    expect(result.exitCode).toBe(0);
    expect(result.stdout.sanitized).toContain("got: --flag value");
  });

  describe("input passthrough", () => {
    // `cat` echoes inherited stdin straight back to stdout, proving the
    // child reads the terminal's stdin. POSIX-only (no `cat` on Windows).
    test.skipIf(IS_WINDOWS)("the script reads from stdin", async () => {
      const subprocess = createCliSubprocess({
        testProject: "default",
        argv: [
          "-l",
          "warn",
          "run-interactive",
          "-W",
          "application-a",
          "-i",
          "cat",
          "-s",
          "system",
        ],
      });

      subprocess.stdin?.write("hi from stdin\n");
      subprocess.stdin?.end();

      let stdout = "";
      if (subprocess.stdout) {
        for await (const chunk of subprocess.stdout) {
          stdout += new TextDecoder().decode(chunk);
        }
      }
      const exitCode = await subprocess.exited;

      expect(exitCode).toBe(0);
      expect(stdout).toContain("hi from stdin");
    });
  });

  describe("syntax errors", () => {
    test("requires a script", async () => {
      const { run } = setupCliTest({ testProject: "default" });
      const result = await run("run-interactive", "-W", "application-a");
      expect(result.exitCode).toBe(1);
      expect(result.stderr.sanitized).toContain("A script is required");
    });

    test("requires a workspace", async () => {
      const { run } = setupCliTest({ testProject: "default" });
      const result = await run("run-interactive", "-i", "echo hi");
      expect(result.exitCode).toBe(1);
      expect(result.stderr.sanitized).toContain("A workspace is required");
    });

    test("rejects both a positional script and --script", async () => {
      const { run } = setupCliTest({ testProject: "default" });
      const result = await run(
        "run-interactive",
        "a-workspaces",
        "-S",
        "a-workspaces",
        "-W",
        "application-a",
      );
      expect(result.exitCode).toBe(1);
      expect(result.stderr.sanitized).toContain(
        "Cannot use both inline script positional and --script|-S option",
      );
    });

    test("rejects both a positional workspace and --workspace", async () => {
      const { run } = setupCliTest({ testProject: "default" });
      const result = await run(
        "run-interactive",
        "a-workspaces",
        "application-a",
        "-W",
        "application-a",
      );
      expect(result.exitCode).toBe(1);
      expect(result.stderr.sanitized).toContain(
        "Cannot use both workspace positional and --workspace|-W option",
      );
    });

    test("rejects both --args and args after --", async () => {
      const { run } = setupCliTest({ testProject: "default" });
      const result = await run(
        "run-interactive",
        "-W",
        "application-a",
        "-i",
        "echo x",
        "-a",
        "foo",
        "--",
        "bar",
      );
      expect(result.exitCode).toBe(1);
      expect(result.stderr.sanitized).toContain(
        "Cannot use both --args and inline script args after --",
      );
    });

    test("reports an unknown workspace", async () => {
      const { run } = setupCliTest({ testProject: "default" });
      const result = await run(
        "run-interactive",
        "-W",
        "nope",
        "-i",
        "echo hi",
      );
      expect(result.exitCode).toBe(1);
      expect(result.stderr.sanitized).toContain('Workspace not found: "nope"');
    });

    test("reports an unknown script", async () => {
      const { run } = setupCliTest({ testProject: "default" });
      const result = await run(
        "run-interactive",
        "no-such-script",
        "-W",
        "application-a",
      );
      expect(result.exitCode).toBe(1);
      expect(result.stderr.sanitized).toContain(
        'Script not found in workspace "application-a": "no-such-script"',
      );
    });
  });
});
