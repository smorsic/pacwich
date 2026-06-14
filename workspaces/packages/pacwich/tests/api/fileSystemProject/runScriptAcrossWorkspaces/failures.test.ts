import { InvalidJSTypeError } from "../../../../src/internal/core";
import { createFileSystemProject } from "../../../../src/project";
import { getProjectRoot } from "../../../fixtures/testProjects";
import { makeTestWorkspace } from "../../../util/testData";
import { expect, test, describe } from "../../../util/testFramework";
import { makeScriptResult, makeSummaryResult } from "./util";

const makeProject = () =>
  createFileSystemProject({
    rootDirectory: getProjectRoot("default"),
  });

describe("FileSystemProject runScriptAcrossWorkspaces - type validation", () => {
  test("throws for non-string script", () => {
    const project = makeProject();
    expect(() =>
      project.runScriptAcrossWorkspaces({
        script: 123 as unknown as string,
      }),
    ).toThrow(InvalidJSTypeError);
  });

  test("throws for non-array workspacePatterns", () => {
    const project = makeProject();
    expect(() =>
      project.runScriptAcrossWorkspaces({
        script: "all-workspaces",
        workspacePatterns: "application-a" as unknown as string[],
      }),
    ).toThrow(InvalidJSTypeError);
  });

  test("throws for workspacePatterns with non-string items", () => {
    const project = makeProject();
    expect(() =>
      project.runScriptAcrossWorkspaces({
        script: "all-workspaces",
        workspacePatterns: [123] as unknown as string[],
      }),
    ).toThrow(InvalidJSTypeError);
  });

  test("throws for non-string inline.scriptName", () => {
    const project = makeProject();
    expect(() =>
      project.runScriptAcrossWorkspaces({
        script: "all-workspaces",
        inline: { scriptName: 123 as unknown as string },
      }),
    ).toThrow(InvalidJSTypeError);
  });

  test("throws for non-string inline.shell", () => {
    const project = makeProject();
    expect(() =>
      project.runScriptAcrossWorkspaces({
        script: "all-workspaces",
        inline: { shell: 123 as unknown as "bun" },
      }),
    ).toThrow(InvalidJSTypeError);
  });

  test("throws for invalid parallel.max type", () => {
    const project = makeProject();
    expect(() =>
      project.runScriptAcrossWorkspaces({
        script: "all-workspaces",
        parallel: { max: true as unknown as number },
      }),
    ).toThrow(InvalidJSTypeError);
  });

  test("throws for non-string args", () => {
    const project = makeProject();
    expect(() =>
      project.runScriptAcrossWorkspaces({
        script: "all-workspaces",
        args: 123 as unknown as string,
      }),
    ).toThrow(InvalidJSTypeError);
  });

  test("throws for invalid inline type", () => {
    const project = makeProject();
    expect(() =>
      project.runScriptAcrossWorkspaces({
        script: "all-workspaces",
        inline: "true" as unknown as boolean,
      }),
    ).toThrow(InvalidJSTypeError);
  });

  test("throws for invalid parallel type", () => {
    const project = makeProject();
    expect(() =>
      project.runScriptAcrossWorkspaces({
        script: "all-workspaces",
        parallel: "yes" as unknown as boolean,
      }),
    ).toThrow(InvalidJSTypeError);
  });

  test("throws for non-boolean dependencyOrder", () => {
    const project = makeProject();
    expect(() =>
      project.runScriptAcrossWorkspaces({
        script: "all-workspaces",
        dependencyOrder: "yes" as unknown as boolean,
      }),
    ).toThrow(InvalidJSTypeError);
  });

  test("throws for non-boolean ignoreDependencyFailure", () => {
    const project = makeProject();
    expect(() =>
      project.runScriptAcrossWorkspaces({
        script: "all-workspaces",
        ignoreDependencyFailure: "yes" as unknown as boolean,
      }),
    ).toThrow(InvalidJSTypeError);
  });

  test("throws for non-boolean ignoreOutput", () => {
    const project = makeProject();
    expect(() =>
      project.runScriptAcrossWorkspaces({
        script: "all-workspaces",
        ignoreOutput: "yes" as unknown as boolean,
      }),
    ).toThrow(InvalidJSTypeError);
  });

  test("throws for non-function onScriptEvent", () => {
    const project = makeProject();
    expect(() =>
      project.runScriptAcrossWorkspaces({
        script: "all-workspaces",
        onScriptEvent: "callback" as unknown as () => void,
      }),
    ).toThrow(InvalidJSTypeError);
  });

  test("does not throw for valid options with all optionals omitted", () => {
    const project = makeProject();
    expect(() =>
      project.runScriptAcrossWorkspaces({ script: "all-workspaces" }),
    ).not.toThrow(InvalidJSTypeError);
  });
});

describe("FileSystemProject runScriptAcrossWorkspaces - failures", () => {
  test("with failures - process output (bytes)", async () => {
    const project = createFileSystemProject({
      rootDirectory: getProjectRoot("runScriptWithFailures"),
    });

    const { output, summary } = project.runScriptAcrossWorkspaces({
      workspacePatterns: ["*"],
      script: "test-exit",
      parallel: false,
    });

    const expectedOutput = [
      { streamName: "stderr" as const, text: "fail1" },
      { streamName: "stderr" as const, text: "fail2" },
      { streamName: "stdout" as const, text: "success1" },
      { streamName: "stdout" as const, text: "success2" },
    ];

    let i = 0;
    for await (const { metadata, chunk } of output.bytes()) {
      expect(metadata.streamName).toBe(expectedOutput[i].streamName);
      expect(new TextDecoder().decode(chunk).trim()).toBe(
        expectedOutput[i].text,
      );
      i++;
    }

    const summaryResult = await summary;
    expect(summaryResult).toEqual(
      makeSummaryResult({
        totalCount: 4,
        successCount: 2,
        failureCount: 2,
        allSuccess: false,
        scriptResults: [
          makeScriptResult({
            exitCode: 1,
            success: false,
            metadata: {
              workspace: makeTestWorkspace({
                name: "fail1",
                matchPattern: "packages/**/*",
                path: "packages/fail1",
                scripts: ["test-exit"],
              }),
            },
          }),
          makeScriptResult({
            exitCode: 2,
            success: false,
            metadata: {
              workspace: makeTestWorkspace({
                name: "fail2",
                matchPattern: "packages/**/*",
                path: "packages/fail2",
                scripts: ["test-exit"],
              }),
            },
          }),
          makeScriptResult({
            metadata: {
              workspace: makeTestWorkspace({
                name: "success1",
                matchPattern: "packages/**/*",
                path: "packages/success1",
                scripts: ["test-exit"],
              }),
            },
          }),
          makeScriptResult({
            metadata: {
              workspace: makeTestWorkspace({
                name: "success2",
                matchPattern: "packages/**/*",
                path: "packages/success2",
                scripts: ["test-exit"],
              }),
            },
          }),
        ],
      }),
    );
  });

  test("with failures - process output (text)", async () => {
    const project = createFileSystemProject({
      rootDirectory: getProjectRoot("runScriptWithFailures"),
    });

    const { output, summary } = project.runScriptAcrossWorkspaces({
      workspacePatterns: ["*"],
      script: "test-exit",
      parallel: false,
    });

    const expectedOutput = [
      { streamName: "stderr" as const, text: "fail1" },
      { streamName: "stderr" as const, text: "fail2" },
      { streamName: "stdout" as const, text: "success1" },
      { streamName: "stdout" as const, text: "success2" },
    ];

    let i = 0;
    for await (const { metadata, chunk } of output.text()) {
      expect(metadata.streamName).toBe(expectedOutput[i].streamName);
      expect(chunk.trim()).toBe(expectedOutput[i].text);
      i++;
    }

    const summaryResult = await summary;
    expect(summaryResult).toEqual(
      makeSummaryResult({
        totalCount: 4,
        successCount: 2,
        failureCount: 2,
        allSuccess: false,
        scriptResults: [
          makeScriptResult({
            exitCode: 1,
            success: false,
            metadata: {
              workspace: makeTestWorkspace({
                name: "fail1",
                matchPattern: "packages/**/*",
                path: "packages/fail1",
                scripts: ["test-exit"],
              }),
            },
          }),
          makeScriptResult({
            exitCode: 2,
            success: false,
            metadata: {
              workspace: makeTestWorkspace({
                name: "fail2",
                matchPattern: "packages/**/*",
                path: "packages/fail2",
                scripts: ["test-exit"],
              }),
            },
          }),
          makeScriptResult({
            metadata: {
              workspace: makeTestWorkspace({
                name: "success1",
                matchPattern: "packages/**/*",
                path: "packages/success1",
                scripts: ["test-exit"],
              }),
            },
          }),
          makeScriptResult({
            metadata: {
              workspace: makeTestWorkspace({
                name: "success2",
                matchPattern: "packages/**/*",
                path: "packages/success2",
                scripts: ["test-exit"],
              }),
            },
          }),
        ],
      }),
    );
  });
});
