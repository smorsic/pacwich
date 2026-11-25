import type { ShellOption } from "@pacwich/common/parameters";
import { InvalidJSTypeError } from "../../../src/internal/core";
import {
  createFileSystemProject,
  PROJECT_ERRORS,
  type RunWorkspaceScriptExit,
} from "../../../src/project";
import { getProjectRoot } from "../../fixtures/testProjects";
import { makeTestWorkspace } from "../../util/testData";
import { expect, test, describe } from "../../util/testFramework";
import { withWindowsPath } from "../../util/windows";

const makeExitResult = (
  overrides: Partial<RunWorkspaceScriptExit>,
): RunWorkspaceScriptExit => ({
  exitCode: 0,
  success: true,
  startTimeISO: expect.any(String),
  endTimeISO: expect.any(String),
  durationMs: expect.any(Number),
  signal: null,
  metadata: {
    workspace: makeTestWorkspace({
      name: "test",
      path: "test",
      matchPattern: "test",
      scripts: ["test"],
    }),
  },
  ...overrides,
});

const makeProject = () =>
  createFileSystemProject({ rootDirectory: getProjectRoot("default") });

describe("FileSystemProject runWorkspaceScript - type validation", () => {
  test("throws for non-string workspaceNameOrAlias", () => {
    const project = makeProject();
    expect(() =>
      project.runWorkspaceScript({
        workspaceNameOrAlias: 123 as unknown as string,
        script: "a-workspaces",
      }),
    ).toThrow(InvalidJSTypeError);
  });

  test("throws for non-string script", () => {
    const project = makeProject();
    expect(() =>
      project.runWorkspaceScript({
        workspaceNameOrAlias: "application-a",
        script: 123 as unknown as string,
      }),
    ).toThrow(InvalidJSTypeError);
  });

  test("throws for non-string args", () => {
    const project = makeProject();
    expect(() =>
      project.runWorkspaceScript({
        workspaceNameOrAlias: "application-a",
        script: "a-workspaces",
        args: 123 as unknown as string,
      }),
    ).toThrow(InvalidJSTypeError);
  });

  test("throws for non-boolean ignoreOutput", () => {
    const project = makeProject();
    expect(() =>
      project.runWorkspaceScript({
        workspaceNameOrAlias: "application-a",
        script: "a-workspaces",
        ignoreOutput: "yes" as unknown as boolean,
      }),
    ).toThrow(InvalidJSTypeError);
  });

  test("throws for invalid inline type", () => {
    const project = makeProject();
    expect(() =>
      project.runWorkspaceScript({
        workspaceNameOrAlias: "application-a",
        script: "a-workspaces",
        inline: "true" as unknown as boolean,
      }),
    ).toThrow(InvalidJSTypeError);
  });

  test("throws for invalid inline object scriptName", () => {
    const project = makeProject();
    expect(() =>
      project.runWorkspaceScript({
        workspaceNameOrAlias: "application-a",
        script: "a-workspaces",
        inline: { scriptName: 123 as unknown as string },
      }),
    ).toThrow(InvalidJSTypeError);
  });

  test("throws for invalid inline object shell", () => {
    const project = makeProject();
    expect(() =>
      project.runWorkspaceScript({
        workspaceNameOrAlias: "application-a",
        script: "a-workspaces",
        inline: { shell: 123 as unknown as ShellOption },
      }),
    ).toThrow(InvalidJSTypeError);
  });

  test("does not throw for valid optional args omitted", () => {
    const project = makeProject();
    expect(() =>
      project.runWorkspaceScript({
        workspaceNameOrAlias: "application-a",
        script: "a-workspaces",
      }),
    ).not.toThrow(InvalidJSTypeError);
  });
});

describe("FileSystemProject runWorkspaceScript", () => {
  test("simple success", async () => {
    const project = createFileSystemProject({
      rootDirectory: getProjectRoot("default"),
    });

    const { output, exit } = project.runWorkspaceScript({
      workspaceNameOrAlias: "application-a",
      script: "a-workspaces",
    });

    for await (const { metadata, chunk } of output.text()) {
      expect(metadata.streamName).toBe("stdout");
      expect(chunk.trim()).toMatch("script for a workspaces");
    }

    const exitResult = await exit;

    expect(exitResult).toEqual(
      makeExitResult({
        metadata: {
          workspace: makeTestWorkspace({
            name: "application-a",
            path: "applications/applicationA",
            matchPattern: "applications/*",
            scripts: ["a-workspaces", "all-workspaces", "application-a"],
          }),
        },
      }),
    );
  });

  test("runs inline script with args", async () => {
    const project = createFileSystemProject({
      rootDirectory: getProjectRoot("runScriptWithEchoArgs"),
    });

    const inline = project.runWorkspaceScript({
      workspaceNameOrAlias: "application-1a",
      script: `echo inline passed args: `,
      inline: true,
      args: "--arg1=value1 --arg2=value2",
    });

    for await (const { chunk, metadata } of inline.output.text()) {
      expect(metadata.streamName).toBe("stdout");
      expect(chunk.trim()).toBe(
        "inline passed args: --arg1=value1 --arg2=value2",
      );
    }

    const inlineExitResult = await inline.exit;
    expect(inlineExitResult).toEqual({
      exitCode: 0,
      success: true,
      startTimeISO: expect.any(String),
      endTimeISO: expect.any(String),
      durationMs: expect.any(Number),
      signal: null,
      metadata: {
        workspace: makeTestWorkspace({
          name: "application-1a",
          aliases: ["appA"],
          path: "applications/applicationA",
          matchPattern: "applications/*",
          scripts: ["test-echo"],
        }),
      },
    });
  });

  test("runs package script with args", async () => {
    const project = createFileSystemProject({
      rootDirectory: getProjectRoot("runScriptWithEchoArgs"),
    });

    const packageScript = project.runWorkspaceScript({
      workspaceNameOrAlias: "application-1a",
      script: "test-echo",
      args: "--arg1=value1 --arg2=value2",
    });

    for await (const { chunk, metadata } of packageScript.output.text()) {
      expect(metadata.streamName).toBe("stdout");
      expect(chunk.trim()).toBe("passed args: --arg1=value1 --arg2=value2");
    }

    const exitResult = await packageScript.exit;
    expect(exitResult).toEqual({
      exitCode: 0,
      success: true,
      startTimeISO: expect.any(String),
      endTimeISO: expect.any(String),
      durationMs: expect.any(Number),
      signal: null,
      metadata: {
        workspace: makeTestWorkspace({
          name: "application-1a",
          aliases: ["appA"],
          path: "applications/applicationA",
          matchPattern: "applications/*",
          scripts: ["test-echo"],
        }),
      },
    });
  });

  test("runs inline script", async () => {
    const project = createFileSystemProject({
      rootDirectory: getProjectRoot("default"),
    });

    const echo = `this is my inline script ${Math.round(Math.random() * 1000000)}`;

    const { output, exit } = project.runWorkspaceScript({
      workspaceNameOrAlias: "application-a",
      script: `echo ${echo}`,
      inline: true,
    });

    for await (const { chunk, metadata } of output.text()) {
      expect(chunk.trim()).toBe(`${echo}`);
      expect(metadata.streamName).toBe("stdout");
    }

    const exitResult = await exit;
    expect(exitResult).toEqual({
      exitCode: 0,
      success: true,
      startTimeISO: expect.any(String),
      endTimeISO: expect.any(String),
      durationMs: expect.any(Number),
      signal: null,
      metadata: {
        workspace: makeTestWorkspace({
          name: "application-a",
          path: "applications/applicationA",
          matchPattern: "applications/*",
          scripts: ["a-workspaces", "all-workspaces", "application-a"],
        }),
      },
    });
  });

  test("ignore output", async () => {
    const project = createFileSystemProject({
      rootDirectory: getProjectRoot("default"),
    });

    const { output, exit } = project.runWorkspaceScript({
      workspaceNameOrAlias: "application-a",
      script: "a-workspaces",
      ignoreOutput: true,
    });

    let chunkCount = 0;
    for await (const _chunk of output.text()) {
      chunkCount++;
    }

    expect(chunkCount).toBe(0);

    const exitResult = await exit;

    expect(exitResult).toEqual(
      makeExitResult({
        metadata: {
          workspace: makeTestWorkspace({
            name: "application-a",
            path: "applications/applicationA",
            matchPattern: "applications/*",
            scripts: ["a-workspaces", "all-workspaces", "application-a"],
          }),
        },
      }),
    );
  });

  test("using workspace alias", async () => {
    const project = createFileSystemProject({
      rootDirectory: getProjectRoot("workspaceConfigPackageOnly"),
    });

    const { output, exit } = project.runWorkspaceScript({
      workspaceNameOrAlias: "appA",
      script: "a-workspaces",
    });

    for await (const { metadata, chunk } of output.text()) {
      expect(metadata.streamName).toBe("stdout");
      expect(chunk.trim()).toMatch("script for a workspaces");
    }

    const exitResult = await exit;

    expect(exitResult).toEqual(
      makeExitResult({
        metadata: {
          workspace: makeTestWorkspace({
            name: "application-1a",
            path: "applications/application-a",
            matchPattern: "applications/*",
            scripts: ["a-workspaces", "all-workspaces", "application-a"],
            aliases: ["appA"],
          }),
        },
      }),
    );
  });

  test("invalid workspace", () => {
    const project = createFileSystemProject({
      rootDirectory: getProjectRoot("default"),
    });

    expect(() =>
      project.runWorkspaceScript({
        workspaceNameOrAlias: "invalid-workspace",
        script: "a-workspaces",
      }),
    ).toThrow(PROJECT_ERRORS.ProjectWorkspaceNotFound);
  });

  test("throws WorkspaceScriptDoesNotExist when workspace exists but script does not", () => {
    const project = createFileSystemProject({
      rootDirectory: getProjectRoot("default"),
    });

    expect(() =>
      project.runWorkspaceScript({
        workspaceNameOrAlias: "application-a",
        script: "not-a-real-script",
      }),
    ).toThrow(PROJECT_ERRORS.WorkspaceScriptDoesNotExist);
  });

  test("inline path skips the script-name check (inline strings are not in workspace.scripts)", async () => {
    const project = createFileSystemProject({
      rootDirectory: getProjectRoot("default"),
    });

    const { output, exit } = project.runWorkspaceScript({
      workspaceNameOrAlias: "application-a",
      script: "echo not-a-real-script",
      inline: true,
    });

    for await (const _ of output.text()) {
      // drain
    }
    const exitResult = await exit;
    expect(exitResult.success).toBe(true);
  });

  test("@root selector resolves to the root workspace even when not included", async () => {
    const project = createFileSystemProject({
      rootDirectory: getProjectRoot("withRootWorkspace"),
      includeRootWorkspace: false,
    });

    const { output, exit } = project.runWorkspaceScript({
      workspaceNameOrAlias: "@root",
      script: "root-workspace",
    });

    const chunks: string[] = [];
    for await (const { chunk } of output.text()) {
      chunks.push(chunk.trim());
    }

    const exitResult = await exit;
    expect(exitResult.success).toBe(true);
    expect(exitResult.metadata.workspace.name).toBe("test-root");
    expect(chunks.join("\n")).toContain("script for root workspace");
  });

  test("@root selector still resolves when root is included in workspaces", async () => {
    const project = createFileSystemProject({
      rootDirectory: getProjectRoot("withRootWorkspace"),
      includeRootWorkspace: true,
    });

    const { exit } = project.runWorkspaceScript({
      workspaceNameOrAlias: "@root",
      script: "root-workspace",
      ignoreOutput: true,
    });

    const exitResult = await exit;
    expect(exitResult.success).toBe(true);
    expect(exitResult.metadata.workspace.name).toBe("test-root");
  });

  test("empty args string is treated as no args", async () => {
    const project = createFileSystemProject({
      rootDirectory: getProjectRoot("runScriptWithEchoArgs"),
    });

    const { output, exit } = project.runWorkspaceScript({
      workspaceNameOrAlias: "application-1a",
      script: "test-echo",
      args: "",
    });

    for await (const { chunk } of output.text()) {
      expect(chunk.trim()).toBe("passed args:");
    }
    expect((await exit).success).toBe(true);
  });

  test("whitespace-only args string is treated as no args", async () => {
    const project = createFileSystemProject({
      rootDirectory: getProjectRoot("runScriptWithEchoArgs"),
    });

    const { output, exit } = project.runWorkspaceScript({
      workspaceNameOrAlias: "application-1a",
      script: "test-echo",
      args: "   ",
    });

    for await (const { chunk } of output.text()) {
      expect(chunk.trim()).toBe("passed args:");
    }
    expect((await exit).success).toBe(true);
  });

  test("args with shell metacharacters land as literal strings (no command substitution)", async () => {
    const project = createFileSystemProject({
      rootDirectory: getProjectRoot("runScriptWithEchoArgs"),
    });

    const { output, exit } = project.runWorkspaceScript({
      workspaceNameOrAlias: "application-1a",
      script: "test-echo",
      args: "--literal='hello world' --nested=\"value\"",
    });

    const chunks: string[] = [];
    for await (const { chunk } of output.text()) {
      chunks.push(chunk.trim());
    }
    const exitResult = await exit;
    expect(exitResult.success).toBe(true);
    expect(chunks.join("\n")).toBe(
      "passed args: --literal=hello world --nested=value",
    );
  });

  test("a script name carrying shell metacharacters is not injected into the command", async () => {
    // The package.json script key contains `;` and `echo INJECTED`. It must
    // be quoted where it lands in the generated shell command, so the shell
    // runs only the real script body and never the appended `echo INJECTED`.
    const project = createFileSystemProject({
      rootDirectory: getProjectRoot("runScriptWithMetacharScriptName"),
    });

    const { output, exit } = project.runWorkspaceScript({
      workspaceNameOrAlias: "pkg-a",
      script: "evil; echo INJECTED",
    });

    const chunks: string[] = [];
    for await (const { chunk } of output.text()) {
      chunks.push(chunk.trim());
    }
    const exitResult = await exit;
    expect(exitResult.success).toBe(true);
    expect(chunks.join("\n")).toBe("ran the real script");
  });

  test("string args with shell operators are passed literally, never executed", async () => {
    const project = createFileSystemProject({
      rootDirectory: getProjectRoot("runScriptWithEchoArgs"),
    });

    // `;`, `&&`, and `|` would each start/chain a separate command if they
    // reached the generated shell script unquoted (command injection).
    const { output, exit } = project.runWorkspaceScript({
      workspaceNameOrAlias: "application-1a",
      script: "test-echo",
      args: "; echo INJECTED && echo AGAIN | tee /tmp/pacwich-should-not-exist",
    });

    const chunks: string[] = [];
    for await (const { chunk } of output.text()) {
      chunks.push(chunk.trim());
    }
    const exitResult = await exit;
    expect(exitResult.success).toBe(true);
    expect(chunks.join("\n")).toBe(
      "passed args: ; echo INJECTED && echo AGAIN | tee /tmp/pacwich-should-not-exist",
    );
  });

  test("expected output - process output (bytes)", async () => {
    const project = createFileSystemProject({
      rootDirectory: getProjectRoot("runScriptWithMixedOutput"),
    });

    const { output, exit } = project.runWorkspaceScript({
      workspaceNameOrAlias: "fail1",
      script: "test-exit",
    });

    const expectedOutput = [
      { text: "fail1 stdout 1", streamName: "stdout" as const },
      { text: "fail1 stderr 1", streamName: "stderr" as const },
      { text: "fail1 stdout 2", streamName: "stdout" as const },
    ];

    let i = 0;
    for await (const { metadata, chunk } of output.bytes()) {
      expect(metadata.streamName).toBe(expectedOutput[i].streamName);
      expect(new TextDecoder().decode(chunk).trim()).toMatch(
        expectedOutput[i].text,
      );
      i++;
    }

    const exitResult = await exit;
    expect(exitResult).toEqual(
      makeExitResult({
        exitCode: 1,
        success: false,
        metadata: {
          workspace: makeTestWorkspace({
            name: "fail1",
            path: "packages/fail1",
            matchPattern: "packages/**/*",
            scripts: ["test-exit"],
          }),
        },
      }),
    );
  });

  test("expected output - process output (text)", async () => {
    const project = createFileSystemProject({
      rootDirectory: getProjectRoot("runScriptWithMixedOutput"),
    });

    const { output, exit } = project.runWorkspaceScript({
      workspaceNameOrAlias: "fail1",
      script: "test-exit",
    });

    const expectedOutput = [
      { text: "fail1 stdout 1", streamName: "stdout" as const },
      { text: "fail1 stderr 1", streamName: "stderr" as const },
      { text: "fail1 stdout 2", streamName: "stdout" as const },
    ];

    let i = 0;
    for await (const { metadata, chunk } of output.text()) {
      expect(metadata.streamName).toBe(expectedOutput[i].streamName);
      expect(chunk.trim()).toMatch(expectedOutput[i].text);
      i++;
    }

    const exitResult = await exit;
    expect(exitResult).toEqual(
      makeExitResult({
        exitCode: 1,
        success: false,
        metadata: {
          workspace: makeTestWorkspace({
            name: "fail1",
            path: "packages/fail1",
            matchPattern: "packages/**/*",
            scripts: ["test-exit"],
          }),
        },
      }),
    );
  });

  test("runtime metadata", async () => {
    const project = createFileSystemProject({
      rootDirectory: getProjectRoot("runScriptWithRuntimeMetadataDebug"),
    });

    const plainResult = project.runWorkspaceScript({
      workspaceNameOrAlias: "application-a",
      script: "test-echo",
    });

    for await (const { metadata, chunk } of plainResult.output.text()) {
      expect(metadata.streamName).toBe("stdout");
      expect(chunk.trim()).toBe(
        `${project.rootDirectory} test-root application-a ${project.rootDirectory}${withWindowsPath("/applications/application-a")} applications/application-a test-echo`,
      );
    }

    const argsResult = project.runWorkspaceScript({
      workspaceNameOrAlias: "application-a",
      script: "test-echo",
      args: "--arg1=<projectPath> --arg2=<projectName> --arg3=<workspaceName> --arg4=<workspacePath> --arg5=<workspaceRelativePath> --arg6=<scriptName>",
    });

    for await (const { metadata, chunk } of argsResult.output.text()) {
      expect(metadata.streamName).toBe("stdout");
      expect(chunk.trim()).toBe(
        `${project.rootDirectory} test-root application-a ${project.rootDirectory}${withWindowsPath("/applications/application-a")} applications/application-a test-echo --arg1=${project.rootDirectory} --arg2=test-root --arg3=application-a --arg4=${project.rootDirectory}${withWindowsPath("/applications/application-a")} --arg5=applications/application-a --arg6=test-echo`,
      );
    }
  });

  test("runtime metadata (inline)", async () => {
    const project = createFileSystemProject({
      rootDirectory: getProjectRoot("runScriptWithRuntimeMetadataDebug"),
    });

    const anonymousScriptResult = project.runWorkspaceScript({
      workspaceNameOrAlias: "application-a",
      script:
        "echo <projectPath> <projectName> <workspaceName> <workspacePath> <workspaceRelativePath> <scriptName>",
      inline: true,
    });

    for await (const {
      metadata,
      chunk,
    } of anonymousScriptResult.output.text()) {
      expect(metadata.streamName).toBe("stdout");
      expect(chunk.trim()).toBe(
        `${project.rootDirectory} test-root application-a ${project.rootDirectory}${withWindowsPath("/applications/application-a")} applications/application-a`,
      );
    }

    const namedScriptResult = project.runWorkspaceScript({
      workspaceNameOrAlias: "application-a",
      script:
        "echo <projectPath> <projectName> <workspaceName> <workspacePath> <workspaceRelativePath> <scriptName>",
      inline: { scriptName: "my-named-script" },
    });

    for await (const { metadata, chunk } of namedScriptResult.output.text()) {
      expect(metadata.streamName).toBe("stdout");
      expect(chunk.trim()).toBe(
        `${project.rootDirectory} test-root application-a ${project.rootDirectory}${withWindowsPath("/applications/application-a")} applications/application-a my-named-script`,
      );
    }
  });
});
