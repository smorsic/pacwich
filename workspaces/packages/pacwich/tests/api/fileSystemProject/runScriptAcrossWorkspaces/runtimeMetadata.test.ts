import { createFileSystemProject } from "../../../../src/project";
import { getProjectRoot } from "../../../fixtures/testProjects";
import { collectStdout } from "../../../util/collectOutput";
import { expect, test, describe } from "../../../util/testFramework";
import { withWindowsPath } from "../../../util/windows";

describe("FileSystemProject runScriptAcrossWorkspaces - runtime metadata", () => {
  test("runtime metadata", async () => {
    const project = createFileSystemProject({
      rootDirectory: getProjectRoot("runScriptWithRuntimeMetadataDebug"),
    });

    const plainResult = project.runScriptAcrossWorkspaces({
      workspacePatterns: ["application-*"],
      script: "test-echo",
      parallel: false,
    });

    const plainChunks = await collectStdout(plainResult.output);
    expect(plainChunks.map((c) => c.text)).toEqual(
      ["a", "b"].map(
        (appLetter) =>
          `${project.rootDirectory} test-root application-${appLetter} ${project.rootDirectory}${withWindowsPath(`/applications/application-${appLetter}`)} ${withWindowsPath(`applications/application-${appLetter}`)} test-echo`,
      ),
    );

    const argsResult = project.runScriptAcrossWorkspaces({
      workspacePatterns: ["application-*"],
      script: "test-echo",
      args: "--arg1=<projectPath> --arg2=<projectName> --arg3=<workspaceName> --arg4=<workspacePath> --arg5=<workspaceRelativePath> --arg6=<scriptName>",
      parallel: false,
    });

    const argsChunks = await collectStdout(argsResult.output);
    expect(argsChunks.map((c) => c.text)).toEqual(
      ["a", "b"].map(
        (appLetter) =>
          `${project.rootDirectory} test-root application-${appLetter} ${project.rootDirectory}${withWindowsPath(`/applications/application-${appLetter}`)} ${withWindowsPath(`applications/application-${appLetter}`)} test-echo --arg1=${project.rootDirectory} --arg2=test-root --arg3=application-${appLetter} --arg4=${project.rootDirectory}${withWindowsPath(`/applications/application-${appLetter}`)} --arg5=${withWindowsPath(`applications/application-${appLetter}`)} --arg6=test-echo`,
      ),
    );
  });

  test("runtime metadata (inline)", async () => {
    const project = createFileSystemProject({
      rootDirectory: getProjectRoot("runScriptWithRuntimeMetadataDebug"),
    });

    const anonymousScriptResult = project.runScriptAcrossWorkspaces({
      workspacePatterns: ["application-*"],
      script:
        "echo <projectPath> <workspaceName> <workspacePath> <workspaceRelativePath> <scriptName>",
      inline: true,
      parallel: false,
    });

    const anonymousChunks = await collectStdout(anonymousScriptResult.output);
    expect(anonymousChunks.map((c) => c.text)).toEqual(
      ["a", "b"].map(
        (appLetter) =>
          `${project.rootDirectory} application-${appLetter} ${project.rootDirectory}${withWindowsPath(`/applications/application-${appLetter}`)} ${withWindowsPath(`applications/application-${appLetter}`)}`,
      ),
    );

    const namedScriptResult = project.runScriptAcrossWorkspaces({
      workspacePatterns: ["application-*"],
      script:
        "echo <projectPath> <workspaceName> <workspacePath> <workspaceRelativePath> <scriptName>",
      inline: { scriptName: "my-named-script" },
      parallel: false,
    });

    const namedChunks = await collectStdout(namedScriptResult.output);
    expect(namedChunks.map((c) => c.text)).toEqual(
      ["a", "b"].map(
        (appLetter) =>
          `${project.rootDirectory} application-${appLetter} ${project.rootDirectory}${withWindowsPath(`/applications/application-${appLetter}`)} ${withWindowsPath(`applications/application-${appLetter}`)} my-named-script`,
      ),
    );
  });
});
