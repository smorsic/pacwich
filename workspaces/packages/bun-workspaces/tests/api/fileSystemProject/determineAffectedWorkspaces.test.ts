import { afterEach, describe, expect, test } from "bun:test";
import { InvalidJSTypeError } from "../../../src/internal/core";
import {
  createFileSystemProject,
  type AffectedWorkspaceResult,
  type FileSystemProject,
} from "../../../src/project";
import { getProjectRoot } from "../../fixtures/testProjects";
import { createGitFixture, type GitFixture } from "../../util/gitFixtures";

const PROJECT_ROOT_PACKAGE_JSON = JSON.stringify({
  name: "test-root",
  workspaces: ["packages/*"],
});

const TWO_WORKSPACE_BUN_LOCK = JSON.stringify({
  lockfileVersion: 1,
  configVersion: 1,
  workspaces: {
    "": { name: "test-root" },
    "packages/a": { name: "a" },
    "packages/b": {
      name: "b",
      dependencies: { a: "workspace:*" },
    },
  },
  packages: {
    a: ["a@workspace:packages/a"],
    b: ["b@workspace:packages/b"],
  },
});

const TWO_WORKSPACE_PROJECT_FILES = [
  { path: "package.json", content: PROJECT_ROOT_PACKAGE_JSON },
  { path: "bun.lock", content: TWO_WORKSPACE_BUN_LOCK },
  {
    path: "packages/a/package.json",
    content: JSON.stringify({ name: "a" }),
  },
  {
    path: "packages/b/package.json",
    content: JSON.stringify({
      name: "b",
      dependencies: { a: "workspace:*" },
    }),
  },
];

const fixtures: GitFixture[] = [];

const newFixture = async (
  ...args: Parameters<typeof createGitFixture>
): Promise<GitFixture> => {
  const fixture = await createGitFixture(...args);
  fixtures.push(fixture);
  return fixture;
};

afterEach(() => {
  while (fixtures.length) {
    fixtures.pop()!.cleanup();
  }
});

const findResult = (
  results: AffectedWorkspaceResult[],
  workspaceName: string,
): AffectedWorkspaceResult => {
  const match = results.find((r) => r.workspace.name === workspaceName);
  if (!match) {
    throw new Error(`No result for workspace "${workspaceName}"`);
  }
  return match;
};

const makeProject = (
  rootDirectory = getProjectRoot("default"),
): FileSystemProject => createFileSystemProject({ rootDirectory });

describe("FileSystemProject.determineAffectedWorkspaces", () => {
  describe("type validation", () => {
    test("throws for non-string diffSource", () => {
      const project = makeProject();
      expect(() =>
        project.determineAffectedWorkspaces({
          diffSource: 123 as unknown as "git",
        }),
      ).toThrow(InvalidJSTypeError);
    });

    test("throws for unknown diffSource value", () => {
      const project = makeProject();
      expect(() =>
        project.determineAffectedWorkspaces({
          diffSource: "other" as unknown as "git",
        }),
      ).toThrow(InvalidJSTypeError);
    });

    test("throws for non-boolean ignorePackageDependencies", () => {
      const project = makeProject();
      expect(() =>
        project.determineAffectedWorkspaces({
          diffSource: "fileList",
          changedFiles: [],
          ignorePackageDependencies: "yes" as unknown as boolean,
        }),
      ).toThrow(InvalidJSTypeError);
    });

    test("throws for non-array fileList changedFiles", () => {
      const project = makeProject();
      expect(() =>
        project.determineAffectedWorkspaces({
          diffSource: "fileList",
          changedFiles: "x" as unknown as string[],
        }),
      ).toThrow(InvalidJSTypeError);
    });

    test("throws for non-string item in fileList changedFiles", () => {
      const project = makeProject();
      expect(() =>
        project.determineAffectedWorkspaces({
          diffSource: "fileList",
          changedFiles: [123 as unknown as string],
        }),
      ).toThrow(InvalidJSTypeError);
    });

    test("throws for missing fileList changedFiles", () => {
      const project = makeProject();
      expect(() =>
        project.determineAffectedWorkspaces({
          diffSource: "fileList",
        } as unknown as { diffSource: "fileList"; changedFiles: string[] }),
      ).toThrow(InvalidJSTypeError);
    });

    test("throws for non-object git diffOptions", () => {
      const project = makeProject();
      expect(() =>
        project.determineAffectedWorkspaces({
          diffSource: "git",
          diffOptions: 5 as unknown as undefined,
        }),
      ).toThrow(InvalidJSTypeError);
    });

    test("throws for non-string git baseRef", () => {
      const project = makeProject();
      expect(() =>
        project.determineAffectedWorkspaces({
          diffSource: "git",
          diffOptions: { baseRef: 5 as unknown as string },
        }),
      ).toThrow(InvalidJSTypeError);
    });

    test("throws for non-string git headRef", () => {
      const project = makeProject();
      expect(() =>
        project.determineAffectedWorkspaces({
          diffSource: "git",
          diffOptions: { headRef: 5 as unknown as string },
        }),
      ).toThrow(InvalidJSTypeError);
    });

    test("throws for non-boolean git ignoreUntracked", () => {
      const project = makeProject();
      expect(() =>
        project.determineAffectedWorkspaces({
          diffSource: "git",
          diffOptions: { ignoreUntracked: "no" as unknown as boolean },
        }),
      ).toThrow(InvalidJSTypeError);
    });

    test("throws for non-boolean git ignoreStaged", () => {
      const project = makeProject();
      expect(() =>
        project.determineAffectedWorkspaces({
          diffSource: "git",
          diffOptions: { ignoreStaged: "no" as unknown as boolean },
        }),
      ).toThrow(InvalidJSTypeError);
    });

    test("throws for non-boolean git ignoreUnstaged", () => {
      const project = makeProject();
      expect(() =>
        project.determineAffectedWorkspaces({
          diffSource: "git",
          diffOptions: { ignoreUnstaged: "no" as unknown as boolean },
        }),
      ).toThrow(InvalidJSTypeError);
    });

    test("throws for non-boolean git ignoreUncommitted", () => {
      const project = makeProject();
      expect(() =>
        project.determineAffectedWorkspaces({
          diffSource: "git",
          diffOptions: { ignoreUncommitted: "no" as unknown as boolean },
        }),
      ).toThrow(InvalidJSTypeError);
    });

    test("throws for non-string script option", () => {
      const project = makeProject();
      expect(() =>
        project.determineAffectedWorkspaces({
          diffSource: "fileList",
          changedFiles: [],
          script: 123 as unknown as string,
        }),
      ).toThrow(InvalidJSTypeError);
    });
  });

  describe("fileList diffSource", () => {
    test("returns metadata.diffSource = 'fileList' and no git metadata", async () => {
      const project = makeProject(getProjectRoot("withDependenciesSimple"));
      const result = await project.determineAffectedWorkspaces({
        diffSource: "fileList",
        changedFiles: [],
      });
      expect(result.metadata).toEqual({ diffSource: "fileList" });
    });

    test("includes a result for every workspace in the project", async () => {
      const project = makeProject(getProjectRoot("withDependenciesSimple"));
      const result = await project.determineAffectedWorkspaces({
        diffSource: "fileList",
        changedFiles: [],
      });
      expect(
        result.workspaceResults.map((r) => r.workspace.name).sort(),
      ).toEqual(project.workspaces.map((w) => w.name).sort());
      for (const r of result.workspaceResults) {
        expect(r.isAffected).toBe(false);
      }
    });

    test("a file inside a workspace marks that workspace affected", async () => {
      const project = makeProject(getProjectRoot("withDependenciesSimple"));
      const result = await project.determineAffectedWorkspaces({
        diffSource: "fileList",
        changedFiles: ["packages/e/src/index.ts"],
      });
      const e = findResult(result.workspaceResults, "e");
      expect(e.isAffected).toBe(true);
      expect(e.affectedReasons.changedFiles[0]).toMatchObject({
        projectFilePath: "packages/e/src/index.ts",
      });
      // No git metadata in fileList mode
      expect(e.affectedReasons.changedFiles[0].gitReasons).toBeUndefined();
    });

    test("dependency cascade marks dependents affected", async () => {
      const project = makeProject(getProjectRoot("withDependenciesSimple"));
      const result = await project.determineAffectedWorkspaces({
        diffSource: "fileList",
        changedFiles: ["packages/e/src/index.ts"],
      });
      // a, c, d all depend on e directly; b depends on c/d transitively
      for (const name of [
        "a-depends-e",
        "c-depends-e",
        "d-depends-e",
        "b-depends-cd",
      ]) {
        expect(findResult(result.workspaceResults, name).isAffected).toBe(true);
      }
    });

    test("ignorePackageDependencies disables dependency cascade", async () => {
      const project = makeProject(getProjectRoot("withDependenciesSimple"));
      const result = await project.determineAffectedWorkspaces({
        diffSource: "fileList",
        changedFiles: ["packages/e/src/index.ts"],
        ignorePackageDependencies: true,
      });
      expect(findResult(result.workspaceResults, "e").isAffected).toBe(true);
      for (const name of [
        "a-depends-e",
        "c-depends-e",
        "d-depends-e",
        "b-depends-cd",
      ]) {
        expect(findResult(result.workspaceResults, name).isAffected).toBe(
          false,
        );
      }
    });

    test("dependency chain is recorded for transitively affected workspaces", async () => {
      const project = makeProject(getProjectRoot("withDependenciesSimple"));
      const result = await project.determineAffectedWorkspaces({
        diffSource: "fileList",
        changedFiles: ["packages/e/src/index.ts"],
      });
      const a = findResult(result.workspaceResults, "a-depends-e");
      expect(a.affectedReasons.changedFiles).toEqual([]);
      expect(a.affectedReasons.dependencies).toEqual([
        {
          dependencyName: "e",
          chain: [
            { workspaceName: "a-depends-e" },
            { workspaceName: "e", edgeSource: "package" },
          ],
        },
      ]);
    });

    test("file outside any workspace affects no workspaces", async () => {
      const project = makeProject(getProjectRoot("withDependenciesSimple"));
      const result = await project.determineAffectedWorkspaces({
        diffSource: "fileList",
        changedFiles: ["docs/README.md"],
      });
      for (const r of result.workspaceResults) {
        expect(r.isAffected).toBe(false);
      }
    });
  });

  describe("changedFiles pattern expansion", () => {
    test("expands a directory entry to all its files", async () => {
      const project = makeProject(getProjectRoot("affectedWithInputs"));
      // packages/a/src/** is the configured input; "packages/a/src" as a dir
      // entry should expand to its files. We need actual files on disk for the
      // dir walk, so we use the project package.json paths instead:
      // pass the project's "packages/a" dir which contains package.json + bw.workspace.json
      const result = await project.determineAffectedWorkspaces({
        diffSource: "fileList",
        changedFiles: ["packages/a"],
      });
      // packages/a contains package.json + bw.workspace.json. With implicit
      // package.json input, "a" is affected via package.json.
      expect(findResult(result.workspaceResults, "a").isAffected).toBe(true);
    });

    test("expands a glob pattern to matching files", async () => {
      const project = makeProject(getProjectRoot("affectedWithInputs"));
      const result = await project.determineAffectedWorkspaces({
        diffSource: "fileList",
        changedFiles: ["packages/*/package.json"],
      });
      // every workspace's package.json matches → all workspaces affected
      for (const name of ["a", "b", "c", "d", "e"]) {
        expect(findResult(result.workspaceResults, name).isAffected).toBe(true);
      }
    });

    test("'!' exclusions remove files from the include set", async () => {
      const project = makeProject(getProjectRoot("affectedWithInputs"));
      const result = await project.determineAffectedWorkspaces({
        diffSource: "fileList",
        changedFiles: ["packages/*/package.json", "!packages/d/package.json"],
      });
      expect(findResult(result.workspaceResults, "a").isAffected).toBe(true);
      expect(findResult(result.workspaceResults, "d").isAffected).toBe(false);
    });

    test("non-existent literal paths pass through (treated as deleted)", async () => {
      const project = makeProject(getProjectRoot("withDependenciesSimple"));
      const result = await project.determineAffectedWorkspaces({
        diffSource: "fileList",
        changedFiles: ["packages/e/src/deleted.ts"],
      });
      expect(findResult(result.workspaceResults, "e").isAffected).toBe(true);
    });

    test("'.' literal expands to every file under the project root", async () => {
      const project = makeProject(getProjectRoot("affectedWithInputs"));
      const result = await project.determineAffectedWorkspaces({
        diffSource: "fileList",
        changedFiles: ["."],
      });
      // every workspace's files end up in the expansion → all affected
      for (const name of ["a", "b", "c", "d", "e"]) {
        expect(findResult(result.workspaceResults, name).isAffected).toBe(true);
      }
    });

    test("'./' prefixed paths are stripped before matching", async () => {
      const project = makeProject(getProjectRoot("affectedWithInputs"));
      const result = await project.determineAffectedWorkspaces({
        diffSource: "fileList",
        changedFiles: ["./packages/a/src/index.ts"],
      });
      // Without ./ stripping, this would not match 'a's "src/**/*" pattern.
      expect(findResult(result.workspaceResults, "a").isAffected).toBe(true);
    });
  });

  describe("defaultInputs from workspace config", () => {
    test("scopes file matches to configured patterns", async () => {
      const project = makeProject(getProjectRoot("affectedWithInputs"));
      // 'a' has defaultInputs.files = ["src/**/*"]
      // A file outside src/ in package 'a' (and outside implicit triggers)
      // should not affect it.
      const result = await project.determineAffectedWorkspaces({
        diffSource: "fileList",
        changedFiles: ["packages/a/other/file.ts"],
      });
      expect(findResult(result.workspaceResults, "a").isAffected).toBe(false);
    });

    test("matches when file falls inside the configured input", async () => {
      const project = makeProject(getProjectRoot("affectedWithInputs"));
      const result = await project.determineAffectedWorkspaces({
        diffSource: "fileList",
        changedFiles: ["packages/a/src/index.ts"],
      });
      expect(findResult(result.workspaceResults, "a").isAffected).toBe(true);
    });

    test("result.inputs reflects the effective inputs used (configured + implicit)", async () => {
      const project = makeProject(getProjectRoot("affectedWithInputs"));
      const result = await project.determineAffectedWorkspaces({
        diffSource: "fileList",
        changedFiles: [],
      });
      expect(findResult(result.workspaceResults, "a").inputs).toEqual({
        files: ["src/**/*", "package.json", "/package.json"],
        workspacePatterns: [],
      });
      // 'd' has no bw.workspace.json → falls back to default "." pattern + implicit
      expect(findResult(result.workspaceResults, "d").inputs).toEqual({
        files: [".", "package.json", "/package.json"],
        workspacePatterns: [],
      });
    });

    test("result.inputs omits implicit patterns when ignorePackageDependencies is true", async () => {
      const project = makeProject(getProjectRoot("affectedWithInputs"));
      const result = await project.determineAffectedWorkspaces({
        diffSource: "fileList",
        changedFiles: [],
        ignorePackageDependencies: true,
      });
      expect(findResult(result.workspaceResults, "a").inputs).toEqual({
        files: ["src/**/*"],
        workspacePatterns: [],
      });
    });

    test("effective input files are deduped when configured patterns overlap implicits", async () => {
      const project = makeProject(getProjectRoot("affectedWithInputs"));
      // 'e' has defaultInputs.files = ["package.json", "/package.json"]
      // which exactly overlaps the implicit triggers. Effective files
      // should appear once each, in the original order.
      const result = await project.determineAffectedWorkspaces({
        diffSource: "fileList",
        changedFiles: [],
      });
      expect(findResult(result.workspaceResults, "e").inputs).toEqual({
        files: ["package.json", "/package.json"],
        workspacePatterns: [],
      });
    });

    test("workspacePatterns inputs treat matched workspaces as input dependencies", async () => {
      const project = makeProject(getProjectRoot("affectedWithInputs"));
      // c has defaultInputs.workspacePatterns = ["d"]; d has no inputs config
      // changing a file in d (which becomes affected via implicit package.json)
      // should also propagate to c via input workspace dependency.
      const result = await project.determineAffectedWorkspaces({
        diffSource: "fileList",
        changedFiles: ["packages/d/package.json"],
      });
      expect(findResult(result.workspaceResults, "d").isAffected).toBe(true);
      const c = findResult(result.workspaceResults, "c");
      expect(c.isAffected).toBe(true);
      expect(c.affectedReasons.dependencies).toContainEqual({
        dependencyName: "d",
        chain: [
          { workspaceName: "c" },
          { workspaceName: "d", edgeSource: "input" },
        ],
      });
    });
  });

  describe("implicit package.json inputs", () => {
    test("changing a workspace's own package.json marks it affected", async () => {
      const project = makeProject(getProjectRoot("affectedWithInputs"));
      // Workspace 'a' has narrow defaultInputs.files=["src/**/*"], so
      // package.json hits only via the implicit pattern.
      const result = await project.determineAffectedWorkspaces({
        diffSource: "fileList",
        changedFiles: ["packages/a/package.json"],
      });
      expect(findResult(result.workspaceResults, "a").isAffected).toBe(true);
    });

    test("changing the root package.json marks every workspace affected", async () => {
      const project = makeProject(getProjectRoot("affectedWithInputs"));
      const result = await project.determineAffectedWorkspaces({
        diffSource: "fileList",
        changedFiles: ["package.json"],
      });
      for (const name of ["a", "b", "c", "d", "e"]) {
        expect(findResult(result.workspaceResults, name).isAffected).toBe(true);
      }
    });

    test("ignorePackageDependencies disables implicit package.json triggers", async () => {
      const project = makeProject(getProjectRoot("affectedWithInputs"));
      const result = await project.determineAffectedWorkspaces({
        diffSource: "fileList",
        changedFiles: ["packages/a/package.json", "package.json"],
        ignorePackageDependencies: true,
      });
      // 'a' has narrow files=["src/**/*"], so without implicit triggers
      // package.json edits don't mark it affected.
      expect(findResult(result.workspaceResults, "a").isAffected).toBe(false);
    });
  });

  describe("script option", () => {
    test("uses script-level inputs when configured for that script", async () => {
      const project = makeProject(getProjectRoot("affectedWithInputs"));
      // 'a' has scripts.build.inputs.files = ["build/**/*"]
      // packages/a/build/x.ts matches the build script's inputs
      const result = await project.determineAffectedWorkspaces({
        diffSource: "fileList",
        changedFiles: ["packages/a/build/x.ts"],
        script: "build",
      });
      expect(findResult(result.workspaceResults, "a").isAffected).toBe(true);
    });

    test("script-level inputs replace defaultInputs.files for matching", async () => {
      const project = makeProject(getProjectRoot("affectedWithInputs"));
      // With script="build", 'a' uses build/**/* (not src/**/*).
      // A file under src/ should no longer match for 'a'.
      const result = await project.determineAffectedWorkspaces({
        diffSource: "fileList",
        changedFiles: ["packages/a/src/index.ts"],
        script: "build",
        ignorePackageDependencies: true,
      });
      expect(findResult(result.workspaceResults, "a").isAffected).toBe(false);
    });

    test("falls back to defaultInputs when workspace has no inputs for that script", async () => {
      const project = makeProject(getProjectRoot("affectedWithInputs"));
      // 'b' has only defaultInputs.files=["src/**/*"], no scripts.build.inputs.
      // With script="build", 'b' should use defaultInputs.
      const result = await project.determineAffectedWorkspaces({
        diffSource: "fileList",
        changedFiles: ["packages/b/src/index.ts"],
        script: "build",
        ignorePackageDependencies: true,
      });
      expect(findResult(result.workspaceResults, "b").isAffected).toBe(true);
    });

    test("result.inputs reflects script-level inputs when used", async () => {
      const project = makeProject(getProjectRoot("affectedWithInputs"));
      const result = await project.determineAffectedWorkspaces({
        diffSource: "fileList",
        changedFiles: [],
        script: "build",
        ignorePackageDependencies: true,
      });
      // 'a' has script-level inputs for "build"
      expect(findResult(result.workspaceResults, "a").inputs).toEqual({
        files: ["build/**/*"],
        workspacePatterns: [],
      });
      // 'b' falls back to defaultInputs
      expect(findResult(result.workspaceResults, "b").inputs).toEqual({
        files: ["src/**/*"],
        workspacePatterns: [],
      });
      // 'd' has no config → default "." pattern
      expect(findResult(result.workspaceResults, "d").inputs).toEqual({
        files: ["."],
        workspacePatterns: [],
      });
    });

    test("without script option, only defaultInputs is used (script-level inputs ignored)", async () => {
      const project = makeProject(getProjectRoot("affectedWithInputs"));
      // packages/a/build/x.ts matches script-level but NOT defaultInputs.
      // Without script option, 'a' should not be affected.
      const result = await project.determineAffectedWorkspaces({
        diffSource: "fileList",
        changedFiles: ["packages/a/build/x.ts"],
        ignorePackageDependencies: true,
      });
      expect(findResult(result.workspaceResults, "a").isAffected).toBe(false);
    });

    test("falls back to defaultInputs when the named script has no per-script config", async () => {
      const project = makeProject(getProjectRoot("affectedWithInputs"));
      // 'a' has scripts.build but no scripts.lint config.
      // With script="lint", 'a' uses defaultInputs.files=["src/**/*"].
      const result = await project.determineAffectedWorkspaces({
        diffSource: "fileList",
        changedFiles: ["packages/a/src/index.ts"],
        script: "lint",
        ignorePackageDependencies: true,
      });
      expect(findResult(result.workspaceResults, "a").isAffected).toBe(true);
    });
  });

  describe("git diffSource", () => {
    test("metadata.git carries the resolved baseRef and headRef", async () => {
      const fixture = await newFixture({
        commits: [
          { message: "init", files: TWO_WORKSPACE_PROJECT_FILES },
          {
            message: "change",
            files: [{ path: "packages/a/src/index.ts", content: "1" }],
          },
        ],
      });
      const project = makeProject(fixture.projectPath);
      const baseSha = fixture.shaForMessage("init");
      const headSha = fixture.shaForMessage("change");
      const result = await project.determineAffectedWorkspaces({
        diffSource: "git",
        diffOptions: {
          baseRef: baseSha,
          headRef: headSha,
          ignoreUncommitted: true,
        },
      });
      expect(result.metadata).toEqual({
        diffSource: "git",
        git: { baseRef: baseSha, headRef: headSha },
      });
    });

    test("default baseRef comes from root config / 'main' fallback; default headRef is 'HEAD'", async () => {
      const fixture = await newFixture({
        commits: [
          { message: "init", files: TWO_WORKSPACE_PROJECT_FILES },
          {
            message: "change",
            files: [{ path: "packages/a/src/index.ts", content: "1" }],
          },
        ],
        initialBranch: "main",
      });
      const project = makeProject(fixture.projectPath);
      const result = await project.determineAffectedWorkspaces({
        diffSource: "git",
        diffOptions: { ignoreUncommitted: true },
      });
      expect(result.metadata.git).toEqual({ baseRef: "main", headRef: "HEAD" });
    });

    test("changed files are populated with gitReasons", async () => {
      const fixture = await newFixture({
        commits: [
          { message: "init", files: TWO_WORKSPACE_PROJECT_FILES },
          {
            message: "change",
            files: [{ path: "packages/a/src/index.ts", content: "1" }],
          },
        ],
      });
      const project = makeProject(fixture.projectPath);
      const result = await project.determineAffectedWorkspaces({
        diffSource: "git",
        diffOptions: {
          baseRef: fixture.shaForMessage("init"),
          headRef: fixture.shaForMessage("change"),
          ignoreUncommitted: true,
        },
      });
      const a = findResult(result.workspaceResults, "a");
      expect(a.isAffected).toBe(true);
      expect(a.affectedReasons.changedFiles).toEqual([
        {
          projectFilePath: "packages/a/src/index.ts",
          inputMatch: ".",
          gitReasons: ["diff"],
        },
      ]);
    });

    test("ignoreUncommitted is forwarded so working-tree changes do not surface", async () => {
      const fixture = await newFixture({
        commits: [{ message: "init", files: TWO_WORKSPACE_PROJECT_FILES }],
        workingState: {
          modify: [{ path: "packages/a/src/index.ts", content: "x" }],
        },
      });
      const project = makeProject(fixture.projectPath);
      const result = await project.determineAffectedWorkspaces({
        diffSource: "git",
        diffOptions: {
          baseRef: fixture.headSha,
          headRef: fixture.headSha,
          ignoreUncommitted: true,
        },
      });
      expect(findResult(result.workspaceResults, "a").isAffected).toBe(false);
    });

    test("untracked files are treated as changes when not ignored", async () => {
      const fixture = await newFixture({
        commits: [{ message: "init", files: TWO_WORKSPACE_PROJECT_FILES }],
        workingState: {
          modify: [{ path: "packages/a/src/new.ts", content: "x" }],
        },
      });
      const project = makeProject(fixture.projectPath);
      const result = await project.determineAffectedWorkspaces({
        diffSource: "git",
        diffOptions: {
          baseRef: fixture.headSha,
          headRef: fixture.headSha,
        },
      });
      const a = findResult(result.workspaceResults, "a");
      expect(a.isAffected).toBe(true);
      expect(a.affectedReasons.changedFiles[0]).toMatchObject({
        projectFilePath: "packages/a/src/new.ts",
        gitReasons: ["untracked"],
      });
    });

    test("dependency cascade also works with the git diffSource", async () => {
      const fixture = await newFixture({
        commits: [
          { message: "init", files: TWO_WORKSPACE_PROJECT_FILES },
          {
            message: "change",
            files: [{ path: "packages/a/src/index.ts", content: "1" }],
          },
        ],
      });
      const project = makeProject(fixture.projectPath);
      const result = await project.determineAffectedWorkspaces({
        diffSource: "git",
        diffOptions: {
          baseRef: fixture.shaForMessage("init"),
          headRef: fixture.shaForMessage("change"),
          ignoreUncommitted: true,
        },
      });
      // 'b' depends on 'a' → cascades
      expect(findResult(result.workspaceResults, "b").isAffected).toBe(true);
    });
  });

  test("isOptionsForDiffSource narrows correctly", async () => {
    const { isOptionsForDiffSource } = await import("../../../src/project");
    expect(isOptionsForDiffSource({ diffSource: "git" }, "git")).toBe(true);
    expect(
      isOptionsForDiffSource(
        { diffSource: "fileList", changedFiles: [] },
        "git",
      ),
    ).toBe(false);
  });
});
