import { describe, expect, test } from "bun:test";
import {
  createFileSystemProject,
  type FileSystemProject,
} from "../../../src/project";
import { getProjectRoot } from "../../fixtures/testProjects";

const SCRIPT_NAME = "echo-script";

const makeProject = (): FileSystemProject =>
  createFileSystemProject({
    rootDirectory: getProjectRoot("affectedWithInputs"),
  });

const ranWorkspaceNames = async (
  result: Awaited<ReturnType<FileSystemProject["runAffectedWorkspaceScript"]>>,
): Promise<string[]> => {
  // Drain output so processes complete cleanly, then await the summary
  for await (const _ of result.output.text()) {
    /* drain */
  }
  await result.summary;
  return result.workspaces.map((w) => w.name).sort();
};

describe("FileSystemProject.runAffectedWorkspaceScript", () => {
  test("only runs the script on workspaces that are actually affected", async () => {
    const project = makeProject();
    const result = await project.runAffectedWorkspaceScript({
      affectedOptions: {
        diffSource: "fileList",
        // 'a' has defaultInputs.files=["src/**/*"], so this hits 'a'
        // and via package dependency, 'b' too.
        changedFiles: ["packages/a/src/index.ts"],
        ignoreWorkspaceDependencies: false,
      },
      scriptOptions: { script: SCRIPT_NAME },
    });
    expect(await ranWorkspaceNames(result)).toEqual(["a", "b"]);
  });

  test("returns a clean empty result when no workspaces are affected", async () => {
    const project = makeProject();
    const result = await project.runAffectedWorkspaceScript({
      affectedOptions: {
        diffSource: "fileList",
        changedFiles: [],
      },
      scriptOptions: { script: SCRIPT_NAME },
    });
    expect(result.workspaces).toEqual([]);
    const summary = await result.summary;
    expect(summary.totalCount).toBe(0);
    expect(summary.successCount).toBe(0);
    expect(summary.failureCount).toBe(0);
    expect(summary.allSuccess).toBe(true);
    expect(summary.scriptResults).toEqual([]);
  });

  test("auto-derives the inputs-lookup script from scriptOptions.script", async () => {
    const project = makeProject();
    // 'a' has scripts.build.inputs.files=["build/**/*"] so a build/ change
    // affects 'a' only when the script-level inputs are looked up.
    // We use scriptOptions.script="build" but no actual build script in
    // package.json — so we use inline so the script can run and we can
    // verify which workspaces were targeted.
    const result = await project.runAffectedWorkspaceScript({
      affectedOptions: {
        diffSource: "fileList",
        changedFiles: ["packages/a/build/x.ts"],
        ignoreWorkspaceDependencies: true,
      },
      scriptOptions: {
        script: "echo running",
        inline: { scriptName: "build" },
      },
    });
    // Only 'a' has script-level inputs for "build" matching build/**/*
    expect(await ranWorkspaceNames(result)).toEqual(["a"]);
  });

  test("inline without scriptName falls back to defaultInputs (no script-level lookup)", async () => {
    const project = makeProject();
    // No inline.scriptName → no script-level inputs lookup → 'a' uses
    // defaultInputs.files=["src/**/*"], which doesn't match build/**/*
    const result = await project.runAffectedWorkspaceScript({
      affectedOptions: {
        diffSource: "fileList",
        changedFiles: ["packages/a/build/x.ts"],
        ignoreWorkspaceDependencies: true,
      },
      scriptOptions: {
        script: "echo running",
        inline: true,
      },
    });
    expect(await ranWorkspaceNames(result)).toEqual([]);
  });
});
