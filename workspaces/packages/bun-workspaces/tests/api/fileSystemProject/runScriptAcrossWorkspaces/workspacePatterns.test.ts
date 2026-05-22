import { expect, test, describe } from "bun:test";
import { createFileSystemProject } from "../../../../src/project";
import { getProjectRoot } from "../../../fixtures/testProjects";

const ranWorkspaceNames = async (
  summary: Promise<{
    scriptResults: { metadata: { workspace: { name: string } } }[];
  }>,
) => {
  const { scriptResults } = await summary;
  return scriptResults.map(({ metadata }) => metadata.workspace.name).sort();
};

describe("FileSystemProject runScriptAcrossWorkspaces - workspace patterns", () => {
  test("not: prefix excludes a single workspace from a wildcard match", async () => {
    const project = createFileSystemProject({
      rootDirectory: getProjectRoot("simple1"),
    });

    const { summary } = project.runScriptAcrossWorkspaces({
      workspacePatterns: ["*", "not:application-1a"],
      script: "all-workspaces",
      parallel: false,
    });

    expect(await ranWorkspaceNames(summary)).toEqual([
      "application-1b",
      "library-1a",
      "library-1b",
    ]);
  });

  test("! short-form prefix excludes a single workspace from a wildcard match", async () => {
    const project = createFileSystemProject({
      rootDirectory: getProjectRoot("simple1"),
    });

    const { summary } = project.runScriptAcrossWorkspaces({
      workspacePatterns: ["*", "!application-1a"],
      script: "all-workspaces",
      parallel: false,
    });

    expect(await ranWorkspaceNames(summary)).toEqual([
      "application-1b",
      "library-1a",
      "library-1b",
    ]);
  });

  test("not: with a wildcard excludes multiple workspaces", async () => {
    const project = createFileSystemProject({
      rootDirectory: getProjectRoot("simple1"),
    });

    const { summary } = project.runScriptAcrossWorkspaces({
      workspacePatterns: ["*", "not:application-*"],
      script: "all-workspaces",
      parallel: false,
    });

    expect(await ranWorkspaceNames(summary)).toEqual([
      "library-1a",
      "library-1b",
    ]);
  });

  test("not:alias: excludes by alias", async () => {
    const project = createFileSystemProject({
      rootDirectory: getProjectRoot("simple1"),
    });

    const { summary } = project.runScriptAcrossWorkspaces({
      workspacePatterns: ["*", "not:alias:appA"],
      script: "all-workspaces",
      parallel: false,
    });

    expect(await ranWorkspaceNames(summary)).toEqual([
      "application-1b",
      "library-1a",
      "library-1b",
    ]);
  });

  test("not:path: excludes by path glob", async () => {
    const project = createFileSystemProject({
      rootDirectory: getProjectRoot("simple1"),
    });

    const { summary } = project.runScriptAcrossWorkspaces({
      workspacePatterns: ["*", "not:path:applications/**/*"],
      script: "all-workspaces",
      parallel: false,
    });

    expect(await ranWorkspaceNames(summary)).toEqual([
      "library-1a",
      "library-1b",
    ]);
  });

  test("not:tag: excludes by tag", async () => {
    const project = createFileSystemProject({
      rootDirectory: getProjectRoot("workspaceTags"),
    });

    const { summary } = project.runScriptAcrossWorkspaces({
      workspacePatterns: ["*", "not:tag:app"],
      script: "all-workspaces",
      parallel: false,
    });

    expect(await ranWorkspaceNames(summary)).toEqual([
      "library-1a",
      "library-1b",
    ]);
  });

  test("not:re: excludes by regex against the default target", async () => {
    const project = createFileSystemProject({
      rootDirectory: getProjectRoot("simple1"),
    });

    const { summary } = project.runScriptAcrossWorkspaces({
      workspacePatterns: ["*", "not:re:^application-"],
      script: "all-workspaces",
      parallel: false,
    });

    expect(await ranWorkspaceNames(summary)).toEqual([
      "library-1a",
      "library-1b",
    ]);
  });

  test("multiple negation patterns compose (excludes are additive)", async () => {
    const project = createFileSystemProject({
      rootDirectory: getProjectRoot("simple1"),
    });

    const { summary } = project.runScriptAcrossWorkspaces({
      workspacePatterns: ["*", "not:application-1a", "not:library-1b"],
      script: "all-workspaces",
      parallel: false,
    });

    expect(await ranWorkspaceNames(summary)).toEqual([
      "application-1b",
      "library-1a",
    ]);
  });

  test("negation applies to includes from other patterns in the same list", async () => {
    // Include via two separate wildcard patterns, then exclude a single workspace.
    // The exclude must filter the union of all includes, not just the matching one.
    const project = createFileSystemProject({
      rootDirectory: getProjectRoot("simple1"),
    });

    const { summary } = project.runScriptAcrossWorkspaces({
      workspacePatterns: ["application-*", "library-*", "not:library-1a"],
      script: "all-workspaces",
      parallel: false,
    });

    expect(await ranWorkspaceNames(summary)).toEqual([
      "application-1a",
      "application-1b",
      "library-1b",
    ]);
  });

  test("path: target matches by path glob", async () => {
    const project = createFileSystemProject({
      rootDirectory: getProjectRoot("simple1"),
    });

    const { summary } = project.runScriptAcrossWorkspaces({
      workspacePatterns: ["path:libraries/**/*"],
      script: "all-workspaces",
      parallel: false,
    });

    expect(await ranWorkspaceNames(summary)).toEqual([
      "library-1a",
      "library-1b",
    ]);
  });

  test("tag: target matches by tag", async () => {
    const project = createFileSystemProject({
      rootDirectory: getProjectRoot("workspaceTags"),
    });

    const { summary } = project.runScriptAcrossWorkspaces({
      workspacePatterns: ["tag:lib"],
      script: "all-workspaces",
      parallel: false,
    });

    expect(await ranWorkspaceNames(summary)).toEqual([
      "library-1a",
      "library-1b",
    ]);
  });

  test("a sole negation pattern matches no workspaces", async () => {
    const project = createFileSystemProject({
      rootDirectory: getProjectRoot("simple1"),
    });

    expect(() =>
      project.runScriptAcrossWorkspaces({
        workspacePatterns: ["not:application-1a"],
        script: "all-workspaces",
        parallel: false,
      }),
    ).toThrow('No matching workspaces found with script "all-workspaces"');
  });
});
