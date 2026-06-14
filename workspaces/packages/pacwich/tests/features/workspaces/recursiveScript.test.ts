import { createFileSystemProject } from "../../../src";
import { IS_WINDOWS } from "../../../src/internal/core";
import { getProjectRoot } from "../../fixtures/testProjects";
import { bunVersionSatisfies, stripANSI } from "../../util/runtime";
import { describe, test, expect } from "../../util/testFramework";

describe("Recursive Script", () => {
  if (IS_WINDOWS && bunVersionSatisfies("1.2.x")) {
    // eslint-disable-next-line no-console
    console.log(
      "Skipping recursive script test on Windows with Bun 1.2.x (test project cannot be installed)",
    );
    return;
  }

  test("Recursive scripts are detected and prevented", async () => {
    const project = createFileSystemProject({
      rootDirectory: getProjectRoot("recursiveScript"),
    });

    const runPackageA = project.runWorkspaceScript({
      workspaceNameOrAlias: "package-a",
      script: "test-script",
    });

    const errorMessage = `Script "test-script" recursively calls itself in workspace "package-a"`;

    for await (const { chunk, metadata } of runPackageA.output.text()) {
      expect(metadata.streamName).toBe("stderr");
      expect(stripANSI(chunk.trim())).toMatch(errorMessage);
    }

    expect((await runPackageA.exit).exitCode).toBe(1);

    const runPackages = project.runScriptAcrossWorkspaces({
      script: "test-script",
    });

    for await (const { chunk, metadata } of runPackages.output.text()) {
      if (metadata.workspace.name === "package-a") {
        expect(metadata.streamName).toBe("stderr");
        expect(stripANSI(chunk.trim())).toMatch(errorMessage);
      } else {
        expect(metadata.streamName).toBe("stdout");
        expect(stripANSI(chunk.trim())).toMatch("hello from package-b");
      }
    }

    expect((await runPackages.summary).allSuccess).toBe(false);
  });
});
