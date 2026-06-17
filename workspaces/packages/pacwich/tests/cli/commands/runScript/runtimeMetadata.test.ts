import { getProjectRoot } from "../../../fixtures/testProjects";
import { setupCliTest, assertOutputMatches } from "../../../util/cliTestUtils";
import { test, expect, describe } from "../../../util/testFramework";
import { withWindowsPath } from "../../../util/windows";

describe("CLI Run Script (runtime metadata)", () => {
  const projectRoot = getProjectRoot("runScriptWithRuntimeMetadataDebug");

  test("script receives metadata via env", async () => {
    const { run } = setupCliTest({
      testProject: "runScriptWithRuntimeMetadataDebug",
    });
    const result = await run("run-script", "test-echo", "--parallel=false");
    expect(result.exitCode).toBe(0);
    assertOutputMatches(
      result.stdoutAndErr.sanitizedCompactLines,
      `[application-a] ${projectRoot} test-root application-a ${withWindowsPath(projectRoot + "/applications/application-a")} applications/application-a test-echo
[application-b] ${projectRoot} test-root application-b ${withWindowsPath(projectRoot + "/applications/application-b")} applications/application-b test-echo
✅ application-a: test-echo
✅ application-b: test-echo
2 scripts ran successfully`,
    );
  });

  test("--args interpolates metadata placeholders", async () => {
    const { run } = setupCliTest({
      testProject: "runScriptWithRuntimeMetadataDebug",
    });
    const result = await run(
      "run-script",
      "test-echo",
      "--args=--arg1=<projectPath> --arg2=<projectName> --arg3=<workspaceName> --arg4=<workspacePath> --arg5=<workspaceRelativePath> --arg6=<scriptName>",
      "--parallel=false",
    );
    expect(result.exitCode).toBe(0);
    assertOutputMatches(
      result.stdoutAndErr.sanitizedCompactLines,
      `[application-a] ${projectRoot} test-root application-a ${withWindowsPath(projectRoot + "/applications/application-a")} applications/application-a test-echo --arg1=${projectRoot} --arg2=test-root --arg3=application-a --arg4=${withWindowsPath(projectRoot + "/applications/application-a")} --arg5=applications/application-a --arg6=test-echo
[application-b] ${projectRoot} test-root application-b ${withWindowsPath(projectRoot + "/applications/application-b")} applications/application-b test-echo --arg1=${projectRoot} --arg2=test-root --arg3=application-b --arg4=${withWindowsPath(projectRoot + "/applications/application-b")} --arg5=applications/application-b --arg6=test-echo
✅ application-a: test-echo
✅ application-b: test-echo
2 scripts ran successfully`,
    );
  });

  test("inline script interpolates metadata placeholders", async () => {
    const { run } = setupCliTest({
      testProject: "runScriptWithRuntimeMetadataDebug",
    });
    const result = await run(
      "run-script",
      "echo <projectPath> <projectName> <workspaceName> <workspacePath> <workspaceRelativePath> <scriptName>",
      "--inline",
      "--parallel=false",
    );
    expect(result.exitCode).toBe(0);
    assertOutputMatches(
      result.stdoutAndErr.sanitizedCompactLines,
      `[application-a] ${projectRoot} test-root application-a ${withWindowsPath(projectRoot + "/applications/application-a")} applications/application-a
[application-b] ${projectRoot} test-root application-b ${withWindowsPath(projectRoot + "/applications/application-b")} applications/application-b
✅ application-a: (inline)
✅ application-b: (inline)
2 scripts ran successfully`,
    );
  });
});
