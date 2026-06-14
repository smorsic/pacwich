import {
  getGitAffectedWorkspaces,
  type GitAffectedWorkspaceResult,
} from "../../../src/affected";
import { resolvePackageManagerAdapter } from "../../../src/packageManager/adapter";
import { createGitFixture } from "../../util/gitFixtures";
import { makeTestWorkspace } from "../../util/testData";
import { describe, expect, test } from "../../util/testFramework";

// Default adapter for tests that don't exercise external-dep version
// tracking (workspacesOptions has no `workspaces` array or sets
// `ignoreExternalDependencies`). `adapter` is required by the type but
// unused at runtime on these paths.
const adapter = resolvePackageManagerAdapter("bun");

const findResult = (
  results: GitAffectedWorkspaceResult[],
  workspaceName: string,
): GitAffectedWorkspaceResult => {
  const match = results.find((r) => r.workspace.name === workspaceName);
  if (!match) {
    throw new Error(`No result for workspace "${workspaceName}"`);
  }
  return match;
};

describe("getGitAffectedWorkspaces", () => {
  describe("git → workspace composition", () => {
    test("attaches git metadata to changed files for a matching workspace", async () => {
      await using fixture = await createGitFixture({
        commits: [
          {
            message: "init",
            files: [{ path: "packages/a/src/index.ts", content: "1" }],
          },
          {
            message: "change",
            files: [{ path: "packages/a/src/index.ts", content: "2" }],
          },
        ],
      });

      const workspace = makeTestWorkspace({
        name: "a",
        path: "packages/a",
      });

      const { affectedWorkspaces } = await getGitAffectedWorkspaces({
        adapter,
        rootDirectory: fixture.projectPath,
        workspacesOptions: {
          rootWorkspace: makeTestWorkspace({ name: "root", isRoot: true }),
          workspaceInputs: [
            {
              workspace,
              inputFilePatterns: ["src"],
              inputWorkspacePatterns: [],
            },
          ],
        },
        gitOptions: {
          baseRef: fixture.shaForMessage("init"),
          headRef: fixture.shaForMessage("change"),
          ignoreUncommitted: true,
        },
      });

      expect(affectedWorkspaces).toHaveLength(1);
      const result = affectedWorkspaces[0];
      expect(result.isAffected).toBe(true);
      expect(result.affectedReasons.changedFiles).toEqual([
        {
          filePath: "packages/a/src/index.ts",
          inputPattern: "src",
          fileMetadata: {
            git: {
              projectFilePath: "packages/a/src/index.ts",
              reasons: ["diff"],
            },
          },
        },
      ]);
    });

    test("preserves multiple git reasons in fileMetadata", async () => {
      await using fixture = await createGitFixture({
        commits: [
          {
            message: "init",
            files: [{ path: "packages/a/src/index.ts", content: "1" }],
          },
          {
            message: "change",
            files: [{ path: "packages/a/src/index.ts", content: "2" }],
          },
        ],
        workingState: {
          partiallyStage: [
            {
              path: "packages/a/src/index.ts",
              staged: "3",
              working: "4",
            },
          ],
        },
      });

      const workspace = makeTestWorkspace({
        name: "a",
        path: "packages/a",
      });

      const { affectedWorkspaces } = await getGitAffectedWorkspaces({
        adapter,
        rootDirectory: fixture.projectPath,
        workspacesOptions: {
          rootWorkspace: makeTestWorkspace({ name: "root", isRoot: true }),
          workspaceInputs: [
            {
              workspace,
              inputFilePatterns: ["src"],
              inputWorkspacePatterns: [],
            },
          ],
        },
        gitOptions: {
          baseRef: fixture.shaForMessage("init"),
          headRef: fixture.shaForMessage("change"),
        },
      });

      const result = affectedWorkspaces[0];
      expect(result.affectedReasons.changedFiles).toHaveLength(1);
      expect(
        result.affectedReasons.changedFiles[0].fileMetadata?.git.reasons,
      ).toEqual(["diff", "staged", "unstaged"]);
    });

    test("includes untracked files as changes when not ignored", async () => {
      await using fixture = await createGitFixture({
        commits: [{ message: "init", files: [{ path: "seed", content: "1" }] }],
        workingState: {
          modify: [{ path: "packages/a/src/new.ts", content: "1" }],
        },
      });

      const workspace = makeTestWorkspace({
        name: "a",
        path: "packages/a",
      });

      const { affectedWorkspaces } = await getGitAffectedWorkspaces({
        adapter,
        rootDirectory: fixture.projectPath,
        workspacesOptions: {
          rootWorkspace: makeTestWorkspace({ name: "root", isRoot: true }),
          workspaceInputs: [
            {
              workspace,
              inputFilePatterns: ["src"],
              inputWorkspacePatterns: [],
            },
          ],
        },
        gitOptions: {
          baseRef: fixture.headSha,
          headRef: fixture.headSha,
        },
      });

      const result = affectedWorkspaces[0];
      expect(result.isAffected).toBe(true);
      expect(result.affectedReasons.changedFiles).toEqual([
        {
          filePath: "packages/a/src/new.ts",
          inputPattern: "src",
          fileMetadata: {
            git: {
              projectFilePath: "packages/a/src/new.ts",
              reasons: ["untracked"],
            },
          },
        },
      ]);
    });

    test("forwards ignoreUncommitted to git so working-tree changes do not surface", async () => {
      await using fixture = await createGitFixture({
        commits: [
          {
            message: "init",
            files: [{ path: "packages/a/src/index.ts", content: "1" }],
          },
        ],
        workingState: {
          modify: [{ path: "packages/a/src/index.ts", content: "2" }],
        },
      });

      const workspace = makeTestWorkspace({
        name: "a",
        path: "packages/a",
      });

      const { affectedWorkspaces } = await getGitAffectedWorkspaces({
        adapter,
        rootDirectory: fixture.projectPath,
        workspacesOptions: {
          rootWorkspace: makeTestWorkspace({ name: "root", isRoot: true }),
          workspaceInputs: [
            {
              workspace,
              inputFilePatterns: ["src"],
              inputWorkspacePatterns: [],
            },
          ],
        },
        gitOptions: {
          baseRef: fixture.headSha,
          headRef: fixture.headSha,
          ignoreUncommitted: true,
        },
      });

      const result = affectedWorkspaces[0];
      expect(result.isAffected).toBe(false);
      expect(result.affectedReasons.changedFiles).toEqual([]);
    });
  });

  describe("workspace filtering", () => {
    test("does not mark a workspace affected when changed files are outside its inputs", async () => {
      await using fixture = await createGitFixture({
        commits: [
          {
            message: "init",
            files: [{ path: "packages/a/README.md", content: "1" }],
          },
          {
            message: "change",
            files: [{ path: "packages/a/README.md", content: "2" }],
          },
        ],
      });

      const workspace = makeTestWorkspace({
        name: "a",
        path: "packages/a",
      });

      const { affectedWorkspaces } = await getGitAffectedWorkspaces({
        adapter,
        rootDirectory: fixture.projectPath,
        workspacesOptions: {
          rootWorkspace: makeTestWorkspace({ name: "root", isRoot: true }),
          workspaceInputs: [
            {
              workspace,
              inputFilePatterns: ["src"],
              inputWorkspacePatterns: [],
            },
          ],
        },
        gitOptions: {
          baseRef: fixture.shaForMessage("init"),
          headRef: fixture.shaForMessage("change"),
          ignoreUncommitted: true,
        },
      });

      expect(affectedWorkspaces[0].isAffected).toBe(false);
      expect(affectedWorkspaces[0].affectedReasons.changedFiles).toEqual([]);
    });

    test("marks only the workspaces matching the changed file paths", async () => {
      await using fixture = await createGitFixture({
        commits: [
          {
            message: "init",
            files: [
              { path: "packages/a/src/index.ts", content: "1" },
              { path: "packages/b/src/index.ts", content: "1" },
            ],
          },
          {
            message: "change",
            files: [{ path: "packages/a/src/index.ts", content: "2" }],
          },
        ],
      });

      const workspaceA = makeTestWorkspace({ name: "a", path: "packages/a" });
      const workspaceB = makeTestWorkspace({ name: "b", path: "packages/b" });

      const { affectedWorkspaces } = await getGitAffectedWorkspaces({
        adapter,
        rootDirectory: fixture.projectPath,
        workspacesOptions: {
          rootWorkspace: makeTestWorkspace({ name: "root", isRoot: true }),
          workspaceInputs: [
            {
              workspace: workspaceA,
              inputFilePatterns: ["src"],
              inputWorkspacePatterns: [],
            },
            {
              workspace: workspaceB,
              inputFilePatterns: ["src"],
              inputWorkspacePatterns: [],
            },
          ],
        },
        gitOptions: {
          baseRef: fixture.shaForMessage("init"),
          headRef: fixture.shaForMessage("change"),
          ignoreUncommitted: true,
        },
      });

      expect(findResult(affectedWorkspaces, "a").isAffected).toBe(true);
      expect(findResult(affectedWorkspaces, "b").isAffected).toBe(false);
    });
  });

  describe("dependency cascade", () => {
    test("propagates affected state to dependents based on workspace package dependencies", async () => {
      await using fixture = await createGitFixture({
        commits: [
          {
            message: "init",
            files: [{ path: "packages/a/src/index.ts", content: "1" }],
          },
          {
            message: "change",
            files: [{ path: "packages/a/src/index.ts", content: "2" }],
          },
        ],
      });

      const workspaceA = makeTestWorkspace({
        name: "a",
        path: "packages/a",
        dependents: ["b"],
      });
      const workspaceB = makeTestWorkspace({
        name: "b",
        path: "packages/b",
        dependencies: ["a"],
      });

      const { affectedWorkspaces } = await getGitAffectedWorkspaces({
        adapter,
        rootDirectory: fixture.projectPath,
        workspacesOptions: {
          rootWorkspace: makeTestWorkspace({ name: "root", isRoot: true }),
          workspaceInputs: [
            {
              workspace: workspaceA,
              inputFilePatterns: ["src"],
              inputWorkspacePatterns: [],
            },
            {
              workspace: workspaceB,
              inputFilePatterns: ["src"],
              inputWorkspacePatterns: [],
            },
          ],
        },
        gitOptions: {
          baseRef: fixture.shaForMessage("init"),
          headRef: fixture.shaForMessage("change"),
          ignoreUncommitted: true,
        },
      });

      const resultB = findResult(affectedWorkspaces, "b");
      expect(resultB.isAffected).toBe(true);
      expect(resultB.affectedReasons.changedFiles).toEqual([]);
      expect(resultB.affectedReasons.dependencies).toEqual([
        {
          dependencyName: "a",
          chain: [
            { workspaceName: "b" },
            { workspaceName: "a", edgeSource: "package" },
          ],
        },
      ]);
    });

    test("forwards ignoreWorkspaceDependencies to file-affected logic", async () => {
      await using fixture = await createGitFixture({
        commits: [
          {
            message: "init",
            files: [{ path: "packages/a/src/index.ts", content: "1" }],
          },
          {
            message: "change",
            files: [{ path: "packages/a/src/index.ts", content: "2" }],
          },
        ],
      });

      const workspaceA = makeTestWorkspace({
        name: "a",
        path: "packages/a",
        dependents: ["b"],
      });
      const workspaceB = makeTestWorkspace({
        name: "b",
        path: "packages/b",
        dependencies: ["a"],
      });

      const { affectedWorkspaces } = await getGitAffectedWorkspaces({
        adapter,
        rootDirectory: fixture.projectPath,
        workspacesOptions: {
          rootWorkspace: makeTestWorkspace({ name: "root", isRoot: true }),
          workspaceInputs: [
            {
              workspace: workspaceA,
              inputFilePatterns: ["src"],
              inputWorkspacePatterns: [],
            },
            {
              workspace: workspaceB,
              inputFilePatterns: ["src"],
              inputWorkspacePatterns: [],
            },
          ],
          ignoreWorkspaceDependencies: true,
        },
        gitOptions: {
          baseRef: fixture.shaForMessage("init"),
          headRef: fixture.shaForMessage("change"),
          ignoreUncommitted: true,
        },
      });

      expect(findResult(affectedWorkspaces, "a").isAffected).toBe(true);
      expect(findResult(affectedWorkspaces, "b").isAffected).toBe(false);
    });
  });

  describe("project subdirectory", () => {
    test("scopes git results to files within the project subdirectory", async () => {
      await using fixture = await createGitFixture({
        projectSubdir: "project",
        commits: [
          {
            message: "init",
            files: [
              { path: "project/packages/a/src/index.ts", content: "1" },
              { path: "outside/file.ts", content: "1" },
            ],
          },
          {
            message: "change",
            files: [
              { path: "project/packages/a/src/index.ts", content: "2" },
              { path: "outside/file.ts", content: "2" },
            ],
          },
        ],
      });

      const workspace = makeTestWorkspace({
        name: "a",
        path: "packages/a",
      });

      const { affectedWorkspaces } = await getGitAffectedWorkspaces({
        adapter,
        rootDirectory: fixture.projectPath,
        workspacesOptions: {
          rootWorkspace: makeTestWorkspace({ name: "root", isRoot: true }),
          workspaceInputs: [
            {
              workspace,
              inputFilePatterns: ["src"],
              inputWorkspacePatterns: [],
            },
          ],
        },
        gitOptions: {
          baseRef: fixture.shaForMessage("init"),
          headRef: fixture.shaForMessage("change"),
          ignoreUncommitted: true,
        },
      });

      const result = affectedWorkspaces[0];
      expect(result.isAffected).toBe(true);
      expect(result.affectedReasons.changedFiles).toEqual([
        {
          filePath: "packages/a/src/index.ts",
          inputPattern: "src",
          fileMetadata: {
            git: {
              projectFilePath: "packages/a/src/index.ts",
              reasons: ["diff"],
            },
          },
        },
      ]);
    });
  });
});
