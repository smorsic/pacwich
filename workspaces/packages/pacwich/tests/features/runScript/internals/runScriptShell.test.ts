import { getUserEnvVarName } from "@pacwich/common/config";
import { createFileSystemProject } from "../../../../src";
import { IS_WINDOWS } from "../../../../src/internal/core";
import {
  createScriptExecutor,
  resolveScriptShell,
  runScript,
  SCRIPT_SHELL_ERRORS,
  shellAvailability,
} from "../../../../src/runScript";
import { getProjectRoot } from "../../../fixtures/testProjects";
import { setupCliTest } from "../../../util/cliTestUtils";
import {
  afterEach,
  describe,
  expect,
  spyOn,
  test,
} from "../../../util/testFramework";

const originalScriptShellDefault =
  process.env[getUserEnvVarName("scriptShellDefault")];

afterEach(() => {
  if (!originalScriptShellDefault) {
    delete process.env[getUserEnvVarName("scriptShellDefault")];
  } else {
    process.env[getUserEnvVarName("scriptShellDefault")] =
      originalScriptShellDefault;
  }
});

const OS_ONLY_COMMAND = IS_WINDOWS ? "exit /b 0" : "command : >/dev/null 2>&1";

describe("Test run script shell option", () => {
  describe("runScript", () => {
    test("bun shell echoes env vars", async () => {
      const bunResult = runScript({
        scriptCommand: {
          command: "echo $MY_VAR $_PACWICH_SCRIPT_SHELL_OPTION",
          workingDirectory: process.cwd(),
        },
        metadata: {},
        env: { MY_VAR: "my test value" },
        shell: "bun",
      });

      for await (const { chunk } of bunResult.output.text()) {
        expect(chunk.trim()).toBe("my test value bun");
      }

      expect((await bunResult.exit).exitCode).toBe(0);
    });

    test("system shell echoes env vars", async () => {
      const osResult = runScript({
        scriptCommand: {
          command: IS_WINDOWS
            ? `echo %MY_VAR% %_PACWICH_SCRIPT_SHELL_OPTION%`
            : "echo $MY_VAR $_PACWICH_SCRIPT_SHELL_OPTION",
          workingDirectory: process.cwd(),
        },
        metadata: {},
        env: { MY_VAR: "my test value" },
        shell: "system",
      });

      for await (const { chunk } of osResult.output.text()) {
        expect(chunk.trim()).toBe("my test value system");
      }

      expect((await osResult.exit).exitCode).toBe(0);
    });

    test("OS-only command fails in bun shell", async () => {
      const bunResult = runScript({
        scriptCommand: {
          command: OS_ONLY_COMMAND,
          workingDirectory: process.cwd(),
        },
        metadata: {},
        env: {},
        shell: "bun",
      });

      expect((await bunResult.exit).exitCode).toBe(1);
    });

    test("OS-only command succeeds in system shell", async () => {
      const osResult = runScript({
        scriptCommand: {
          command: OS_ONLY_COMMAND,
          workingDirectory: process.cwd(),
        },
        metadata: {},
        env: {},
        shell: "system",
      });

      expect((await osResult.exit).exitCode).toBe(0);
    });
  });

  describe("CLI", () => {
    // Bun is the shell from the test env's PACWICH_SHELL_DEFAULT;
    // see vitest.config.ts. The runtime default (no env var set)
    // is exercised separately in the "default shell" describe.
    test("uses bun shell from baseline test env", async () => {
      const defaultResult = await setupCliTest().run(
        "run-script",
        "echo $_PACWICH_SCRIPT_SHELL_OPTION",
        "application-a",
        "-i",
        "--inline-name",
        "test",
      );
      expect(defaultResult.exitCode).toBe(0);
      expect(defaultResult.stdout.sanitizedCompactLines).toInclude(
        "[application-a] bun",
      );
    });

    test("uses system shell from env var", async () => {
      process.env[getUserEnvVarName("scriptShellDefault")] = "system";

      const osEnvResult = await setupCliTest().run(
        "run-script",
        IS_WINDOWS
          ? `echo %_PACWICH_SCRIPT_SHELL_OPTION%`
          : "echo $_PACWICH_SCRIPT_SHELL_OPTION",
        "application-a",
        "-i",
        "--inline-name",
        "test",
      );
      expect(osEnvResult.exitCode).toBe(0);
      expect(osEnvResult.stdout.sanitizedCompactLines).toInclude(
        "[application-a] system",
      );
    });

    test("explicit default follows env var", async () => {
      process.env[getUserEnvVarName("scriptShellDefault")] = "system";

      const explicitDefaultResult = await setupCliTest().run(
        "run-script",
        IS_WINDOWS
          ? `echo %_PACWICH_SCRIPT_SHELL_OPTION%`
          : "echo $_PACWICH_SCRIPT_SHELL_OPTION",
        "application-a",
        "--shell",
        "default",
        "-i",
        "--inline-name",
        "test",
      );
      expect(explicitDefaultResult.exitCode).toBe(0);
      expect(explicitDefaultResult.stdout.sanitizedCompactLines).toInclude(
        "[application-a] system",
      );
    });

    test("uses bun shell from env var", async () => {
      process.env[getUserEnvVarName("scriptShellDefault")] = "bun";

      const bunEnvResult = await setupCliTest().run(
        "run-script",
        "echo $_PACWICH_SCRIPT_SHELL_OPTION",
        "application-a",
        "-i",
        "--inline-name",
        "test",
      );
      expect(bunEnvResult.exitCode).toBe(0);
      expect(bunEnvResult.stdout.sanitizedCompactLines).toInclude(
        "[application-a] bun",
      );
    });

    test("explicit bun shell", async () => {
      const explicitBunResult = await setupCliTest().run(
        "run-script",
        "echo $_PACWICH_SCRIPT_SHELL_OPTION",
        "application-a",
        "--shell",
        "bun",
        "-i",
        "--inline-name",
        "test",
      );
      expect(explicitBunResult.exitCode).toBe(0);
      expect(explicitBunResult.stdout.sanitizedCompactLines).toInclude(
        "[application-a] bun",
      );
    });

    test("bun shell fails with OS-only command", async () => {
      const failingBunResult = await setupCliTest().run(
        "run-script",
        OS_ONLY_COMMAND,
        "application-a",
        "--shell",
        "bun",
        "-i",
        "--inline-name",
        "test",
      );
      expect(failingBunResult.exitCode).toBe(1);
    });

    test("explicit system shell", async () => {
      const explicitOsResult = await setupCliTest().run(
        "run-script",
        IS_WINDOWS
          ? `echo %_PACWICH_SCRIPT_SHELL_OPTION%`
          : "echo $_PACWICH_SCRIPT_SHELL_OPTION",
        "application-a",
        "--shell",
        "system",
        "-i",
        "--inline-name",
        "test",
      );
      expect(explicitOsResult.exitCode).toBe(0);
      expect(explicitOsResult.stdout.sanitizedCompactLines).toInclude(
        "[application-a] system",
      );
    });

    test("system shell succeeds with OS-only command", async () => {
      const successfulOsOnlyResult = await setupCliTest().run(
        "run-script",
        OS_ONLY_COMMAND,
        "application-a",
        "--shell",
        "system",
        "-i",
        "--inline-name",
        "test",
      );
      expect(successfulOsOnlyResult.exitCode).toBe(0);
    });
  });

  describe("runWorkspaceScript API", () => {
    const project = () =>
      createFileSystemProject({
        rootDirectory: getProjectRoot("default"),
      });

    test("uses bun shell from baseline test env", async () => {
      const defaultResult = await project().runWorkspaceScript({
        workspaceNameOrAlias: "application-a",
        script: "echo $_PACWICH_SCRIPT_SHELL_OPTION",
        inline: true,
      });

      for await (const { chunk } of defaultResult.output.text()) {
        expect(chunk.trim()).toBe("bun");
      }
      expect((await defaultResult.exit).exitCode).toBe(0);
    });

    test("uses system shell from env var", async () => {
      process.env[getUserEnvVarName("scriptShellDefault")] = "system";

      const osEnvResult = await project().runWorkspaceScript({
        workspaceNameOrAlias: "application-a",
        script: IS_WINDOWS
          ? `echo %_PACWICH_SCRIPT_SHELL_OPTION%`
          : "echo $_PACWICH_SCRIPT_SHELL_OPTION",
        inline: true,
      });

      for await (const { chunk } of osEnvResult.output.text()) {
        expect(chunk.trim()).toBe("system");
      }
      expect((await osEnvResult.exit).exitCode).toBe(0);
    });

    test("explicit default follows env var", async () => {
      process.env[getUserEnvVarName("scriptShellDefault")] = "system";

      const explicitDefaultResult = await project().runWorkspaceScript({
        workspaceNameOrAlias: "application-a",
        script: IS_WINDOWS
          ? `echo %_PACWICH_SCRIPT_SHELL_OPTION%`
          : "echo $_PACWICH_SCRIPT_SHELL_OPTION",
        inline: { shell: "default" },
      });

      for await (const { chunk } of explicitDefaultResult.output.text()) {
        expect(chunk.trim()).toBe("system");
      }
      expect((await explicitDefaultResult.exit).exitCode).toBe(0);
    });

    test("uses bun shell from env var", async () => {
      process.env[getUserEnvVarName("scriptShellDefault")] = "bun";

      const bunEnvResult = await project().runWorkspaceScript({
        workspaceNameOrAlias: "application-a",
        script: "echo $_PACWICH_SCRIPT_SHELL_OPTION",
        inline: true,
      });

      for await (const { chunk } of bunEnvResult.output.text()) {
        expect(chunk.trim()).toBe("bun");
      }
      expect((await bunEnvResult.exit).exitCode).toBe(0);
    });

    test("explicit bun shell", async () => {
      const explicitBunResult = await project().runWorkspaceScript({
        workspaceNameOrAlias: "application-a",
        script: "echo $_PACWICH_SCRIPT_SHELL_OPTION",
        inline: { shell: "bun" },
      });

      for await (const { chunk } of explicitBunResult.output.text()) {
        expect(chunk.trim()).toBe("bun");
      }
      expect((await explicitBunResult.exit).exitCode).toBe(0);
    });

    test("bun shell fails with OS-only command", async () => {
      const failingBunResult = await project().runWorkspaceScript({
        workspaceNameOrAlias: "application-a",
        script: OS_ONLY_COMMAND,
        inline: { shell: "bun" },
      });

      expect((await failingBunResult.exit).exitCode).toBe(1);
    });

    test("explicit system shell", async () => {
      const explicitOsResult = await project().runWorkspaceScript({
        workspaceNameOrAlias: "application-a",
        script: IS_WINDOWS
          ? `echo %_PACWICH_SCRIPT_SHELL_OPTION%`
          : "echo $_PACWICH_SCRIPT_SHELL_OPTION",
        inline: { shell: "system" },
      });

      for await (const { chunk } of explicitOsResult.output.text()) {
        expect(chunk.trim()).toBe("system");
      }
      expect((await explicitOsResult.exit).exitCode).toBe(0);
    });

    test("system shell succeeds with OS-only command", async () => {
      const successfulOsOnlyResult = await project().runWorkspaceScript({
        workspaceNameOrAlias: "application-a",
        script: OS_ONLY_COMMAND,
        inline: { shell: "system" },
      });

      expect((await successfulOsOnlyResult.exit).exitCode).toBe(0);
    });
  });

  describe("runScriptAcrossWorkspaces API", () => {
    const project = () =>
      createFileSystemProject({
        rootDirectory: getProjectRoot("default"),
      });

    test("uses bun shell from baseline test env", async () => {
      const defaultResult = await project().runScriptAcrossWorkspaces({
        workspacePatterns: ["application-a"],
        script: "echo $_PACWICH_SCRIPT_SHELL_OPTION",
        inline: true,
      });

      for await (const { chunk } of defaultResult.output.text()) {
        expect(chunk.trim()).toBe("bun");
      }
      expect((await defaultResult.summary).scriptResults[0].exitCode).toBe(0);
    });

    test("uses system shell from env var", async () => {
      process.env[getUserEnvVarName("scriptShellDefault")] = "system";

      const osEnvResult = await project().runScriptAcrossWorkspaces({
        workspacePatterns: ["application-a"],
        script: IS_WINDOWS
          ? `echo %_PACWICH_SCRIPT_SHELL_OPTION%`
          : "echo $_PACWICH_SCRIPT_SHELL_OPTION",
        inline: true,
      });

      for await (const { chunk } of osEnvResult.output.text()) {
        expect(chunk.trim()).toBe("system");
      }
      expect((await osEnvResult.summary).scriptResults[0].exitCode).toBe(0);
    });

    test("explicit default follows env var", async () => {
      process.env[getUserEnvVarName("scriptShellDefault")] = "system";

      const explicitDefaultResult = await project().runScriptAcrossWorkspaces({
        workspacePatterns: ["application-a"],
        script: IS_WINDOWS
          ? `echo %_PACWICH_SCRIPT_SHELL_OPTION%`
          : "echo $_PACWICH_SCRIPT_SHELL_OPTION",
        inline: { shell: "default" },
      });

      for await (const { chunk } of explicitDefaultResult.output.text()) {
        expect(chunk.trim()).toBe("system");
      }
      expect(
        (await explicitDefaultResult.summary).scriptResults[0].exitCode,
      ).toBe(0);
    });

    test("uses bun shell from env var", async () => {
      process.env[getUserEnvVarName("scriptShellDefault")] = "bun";

      const bunEnvResult = await project().runScriptAcrossWorkspaces({
        workspacePatterns: ["application-a"],
        script: "echo $_PACWICH_SCRIPT_SHELL_OPTION",
        inline: true,
      });

      for await (const { chunk } of bunEnvResult.output.text()) {
        expect(chunk.trim()).toBe("bun");
      }
      expect((await bunEnvResult.summary).scriptResults[0].exitCode).toBe(0);
    });

    test("explicit bun shell", async () => {
      const explicitBunResult = await project().runScriptAcrossWorkspaces({
        workspacePatterns: ["application-a"],
        script: "echo $_PACWICH_SCRIPT_SHELL_OPTION",
        inline: { shell: "bun" },
      });

      for await (const { chunk } of explicitBunResult.output.text()) {
        expect(chunk.trim()).toBe("bun");
      }
      expect((await explicitBunResult.summary).scriptResults[0].exitCode).toBe(
        0,
      );
    });

    test("bun shell fails with OS-only command", async () => {
      const failingBunResult = await project().runScriptAcrossWorkspaces({
        workspacePatterns: ["application-a"],
        script: OS_ONLY_COMMAND,
        inline: { shell: "bun" },
      });

      expect((await failingBunResult.summary).scriptResults[0].exitCode).toBe(
        1,
      );
    });

    test("explicit system shell", async () => {
      const explicitOsResult = await project().runScriptAcrossWorkspaces({
        workspacePatterns: ["application-a"],
        script: IS_WINDOWS
          ? `echo %_PACWICH_SCRIPT_SHELL_OPTION%`
          : "echo $_PACWICH_SCRIPT_SHELL_OPTION",
        inline: { shell: "system" },
      });

      for await (const { chunk } of explicitOsResult.output.text()) {
        expect(chunk.trim()).toBe("system");
      }
      expect((await explicitOsResult.summary).scriptResults[0].exitCode).toBe(
        0,
      );
    });

    test("system shell succeeds with OS-only command", async () => {
      const successfulOsOnlyResult = await project().runScriptAcrossWorkspaces({
        workspacePatterns: ["application-a"],
        script: OS_ONLY_COMMAND,
        inline: { shell: "system" },
      });

      expect(
        (await successfulOsOnlyResult.summary).scriptResults[0].exitCode,
      ).toBe(0);
    });
  });

  // The vitest test env sets PACWICH_SHELL_DEFAULT=bun for
  // historical compatibility; these tests scrub it to assert the
  // actual runtime default ("system") that ships to users.
  //
  // Each test wraps its body in try/finally to restore the var
  // even on assertion failure. The file-level `afterEach` already
  // does this, but vitest runs files in a shared context
  // (`isolate: false`), so explicit cleanup here makes the leak
  // surface impossible to silently miss in CI on other platforms.
  describe("default shell (no env override)", () => {
    const withShellDefaultUnset = async <T>(fn: () => Promise<T> | T) => {
      const envVarName = getUserEnvVarName("scriptShellDefault");
      const previous = process.env[envVarName];
      delete process.env[envVarName];
      try {
        return await fn();
      } finally {
        if (previous === undefined) {
          delete process.env[envVarName];
        } else {
          process.env[envVarName] = previous;
        }
      }
    };

    test("resolveScriptShell returns 'system' when PACWICH_SHELL_DEFAULT is unset", async () => {
      await withShellDefaultUnset(() => {
        expect(resolveScriptShell()).toBe("system");
        expect(resolveScriptShell("default")).toBe("system");
      });
    });

    test("CLI uses system shell when PACWICH_SHELL_DEFAULT is unset", async () => {
      await withShellDefaultUnset(async () => {
        const result = await setupCliTest().run(
          "run-script",
          IS_WINDOWS
            ? `echo %_PACWICH_SCRIPT_SHELL_OPTION%`
            : "echo $_PACWICH_SCRIPT_SHELL_OPTION",
          "application-a",
          "-i",
          "--inline-name",
          "test",
        );
        expect(result.exitCode).toBe(0);
        expect(result.stdout.sanitizedCompactLines).toInclude(
          "[application-a] system",
        );
      });
    });

    test("runWorkspaceScript API uses system shell when PACWICH_SHELL_DEFAULT is unset", async () => {
      await withShellDefaultUnset(async () => {
        const project = createFileSystemProject({
          rootDirectory: getProjectRoot("default"),
        });

        const result = await project.runWorkspaceScript({
          workspaceNameOrAlias: "application-a",
          script: IS_WINDOWS
            ? `echo %_PACWICH_SCRIPT_SHELL_OPTION%`
            : "echo $_PACWICH_SCRIPT_SHELL_OPTION",
          inline: true,
        });

        for await (const { chunk } of result.output.text()) {
          expect(chunk.trim()).toBe("system");
        }
        expect((await result.exit).exitCode).toBe(0);
      });
    });
  });

  describe("explicit bun shell without bun installed", () => {
    test("createScriptExecutor throws BunShellUnavailable", () => {
      const spy = spyOn(shellAvailability, "isBunAvailable").mockReturnValue(
        false,
      );
      try {
        expect(() => createScriptExecutor("echo hi", "bun")).toThrow(
          SCRIPT_SHELL_ERRORS.BunShellUnavailable,
        );
        expect(() => createScriptExecutor("echo hi", "bun")).toThrow(
          /Bun is not installed/,
        );
      } finally {
        spy.mockRestore();
      }
    });

    test("system shell still works when bun is reported unavailable", () => {
      const spy = spyOn(shellAvailability, "isBunAvailable").mockReturnValue(
        false,
      );
      try {
        const { argv, cleanup } = createScriptExecutor("echo hi", "system");
        expect(argv.length).toBeGreaterThan(0);
        cleanup();
      } finally {
        spy.mockRestore();
      }
    });
  });
});
