import { InvalidJSTypeError } from "../../../src/internal/core";
import { resolvePackageManagerAdapter } from "../../../src/packageManager/adapter";
import {
  createFileSystemProject,
  type AffectedWorkspaceResult,
  type FileSystemProject,
} from "../../../src/project";
import { getProjectRoot } from "../../fixtures/testProjects";
import { loadFixture } from "../../util/fixtures";
import { createGitFixture } from "../../util/gitFixtures";
import { describe, expect, test } from "../../util/testFramework";

// `changedFiles` entries that target the project's lockfile route
// through `adapter.lockfile.projectRelativePath` rather than the literal
// `"bun.lock"`, so the affected-signal tests track whatever lockfile
// path the active adapter exposes.
//
// The synthetic git fixtures further down still use the literal
// `"bun.lock"` for `path:` and a bun-shaped JSON body for `content:` —
// that JSON is intrinsically bun-format, so those tests are bun-only by
// construction. When another PM ships, the corresponding fixtures will
// need a per-PM lockfile-content builder.
const adapter = resolvePackageManagerAdapter("bun");
const PROJECT_LOCKFILE_PATH = adapter.lockfile.projectRelativePath;

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
    // determineAffectedWorkspaces is async, so its synchronous validation
    // throws surface as Promise rejections. Bun's toThrow auto-awaits
    // rejected Promises; vitest's doesn't — use rejects.toThrow + await.
    test("throws for non-string diffSource", async () => {
      const project = makeProject();
      await expect(
        project.determineAffectedWorkspaces({
          diffSource: 123 as unknown as "git",
        }),
      ).rejects.toThrow(InvalidJSTypeError);
    });

    test("throws for unknown diffSource value", async () => {
      const project = makeProject();
      await expect(
        project.determineAffectedWorkspaces({
          diffSource: "other" as unknown as "git",
        }),
      ).rejects.toThrow(InvalidJSTypeError);
    });

    test("throws for non-boolean ignoreWorkspaceDependencies", async () => {
      const project = makeProject();
      await expect(
        project.determineAffectedWorkspaces({
          diffSource: "fileList",
          changedFiles: [],
          ignoreWorkspaceDependencies: "yes" as unknown as boolean,
        }),
      ).rejects.toThrow(InvalidJSTypeError);
    });

    test("throws for non-boolean ignoreExternalDependencies", async () => {
      const project = makeProject();
      await expect(
        project.determineAffectedWorkspaces({
          diffSource: "fileList",
          changedFiles: [],
          ignoreExternalDependencies: "yes" as unknown as boolean,
        }),
      ).rejects.toThrow(InvalidJSTypeError);
    });

    test("throws for non-array fileList changedFiles", async () => {
      const project = makeProject();
      await expect(
        project.determineAffectedWorkspaces({
          diffSource: "fileList",
          changedFiles: "x" as unknown as string[],
        }),
      ).rejects.toThrow(InvalidJSTypeError);
    });

    test("throws for non-string item in fileList changedFiles", async () => {
      const project = makeProject();
      await expect(
        project.determineAffectedWorkspaces({
          diffSource: "fileList",
          changedFiles: [123 as unknown as string],
        }),
      ).rejects.toThrow(InvalidJSTypeError);
    });

    test("throws for missing fileList changedFiles", async () => {
      const project = makeProject();
      await expect(
        project.determineAffectedWorkspaces({
          diffSource: "fileList",
        } as unknown as { diffSource: "fileList"; changedFiles: string[] }),
      ).rejects.toThrow(InvalidJSTypeError);
    });

    test("throws for non-object git diffOptions", async () => {
      const project = makeProject();
      await expect(
        project.determineAffectedWorkspaces({
          diffSource: "git",
          diffOptions: 5 as unknown as undefined,
        }),
      ).rejects.toThrow(InvalidJSTypeError);
    });

    test("throws for non-string git baseRef", async () => {
      const project = makeProject();
      await expect(
        project.determineAffectedWorkspaces({
          diffSource: "git",
          diffOptions: { baseRef: 5 as unknown as string },
        }),
      ).rejects.toThrow(InvalidJSTypeError);
    });

    test("throws for non-string git headRef", async () => {
      const project = makeProject();
      await expect(
        project.determineAffectedWorkspaces({
          diffSource: "git",
          diffOptions: { headRef: 5 as unknown as string },
        }),
      ).rejects.toThrow(InvalidJSTypeError);
    });

    test("throws for non-boolean git ignoreUntracked", async () => {
      const project = makeProject();
      await expect(
        project.determineAffectedWorkspaces({
          diffSource: "git",
          diffOptions: { ignoreUntracked: "no" as unknown as boolean },
        }),
      ).rejects.toThrow(InvalidJSTypeError);
    });

    test("throws for non-boolean git ignoreStaged", async () => {
      const project = makeProject();
      await expect(
        project.determineAffectedWorkspaces({
          diffSource: "git",
          diffOptions: { ignoreStaged: "no" as unknown as boolean },
        }),
      ).rejects.toThrow(InvalidJSTypeError);
    });

    test("throws for non-boolean git ignoreUnstaged", async () => {
      const project = makeProject();
      await expect(
        project.determineAffectedWorkspaces({
          diffSource: "git",
          diffOptions: { ignoreUnstaged: "no" as unknown as boolean },
        }),
      ).rejects.toThrow(InvalidJSTypeError);
    });

    test("throws for non-boolean git ignoreUncommitted", async () => {
      const project = makeProject();
      await expect(
        project.determineAffectedWorkspaces({
          diffSource: "git",
          diffOptions: { ignoreUncommitted: "no" as unknown as boolean },
        }),
      ).rejects.toThrow(InvalidJSTypeError);
    });

    test("throws for non-string script option", async () => {
      const project = makeProject();
      await expect(
        project.determineAffectedWorkspaces({
          diffSource: "fileList",
          changedFiles: [],
          script: 123 as unknown as string,
        }),
      ).rejects.toThrow(InvalidJSTypeError);
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

    test("ignoreWorkspaceDependencies disables dependency cascade", async () => {
      const project = makeProject(getProjectRoot("withDependenciesSimple"));
      const result = await project.determineAffectedWorkspaces({
        diffSource: "fileList",
        changedFiles: ["packages/e/src/index.ts"],
        ignoreWorkspaceDependencies: true,
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

    test("included root workspace is not affected by nested workspace file changes", async () => {
      const project = createFileSystemProject({
        rootDirectory: getProjectRoot("withRootWorkspace"),
        includeRootWorkspace: true,
      });
      const result = await project.determineAffectedWorkspaces({
        diffSource: "fileList",
        changedFiles: ["applications/applicationA/src/index.ts"],
      });
      const root = findResult(result.workspaceResults, "test-root");
      expect(root.isAffected).toBe(false);
      expect(root.affectedReasons.changedFiles).toEqual([]);
      expect(
        findResult(result.workspaceResults, "application-1a").isAffected,
      ).toBe(true);
    });

    test("included root workspace is affected by root-owned file changes", async () => {
      const project = createFileSystemProject({
        rootDirectory: getProjectRoot("withRootWorkspace"),
        includeRootWorkspace: true,
      });
      const result = await project.determineAffectedWorkspaces({
        diffSource: "fileList",
        changedFiles: ["package.json"],
      });
      const root = findResult(result.workspaceResults, "test-root");
      expect(root.isAffected).toBe(true);
      expect(root.affectedReasons.changedFiles).toEqual([
        { projectFilePath: "package.json", inputMatch: "." },
      ]);
      for (const workspaceResult of result.workspaceResults) {
        if (workspaceResult.workspace.name === "test-root") continue;
        expect(workspaceResult.isAffected).toBe(false);
      }
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
      // 'd' has no workspace config so its input falls back to '.'. Listing
      // its directory should expand to packages/d/package.json which 'd's
      // input matches.
      const result = await project.determineAffectedWorkspaces({
        diffSource: "fileList",
        changedFiles: ["packages/d"],
      });
      expect(findResult(result.workspaceResults, "d").isAffected).toBe(true);
      // 'a' has narrow src/**/* input — package.json under packages/a/ does
      // not match (and 'a' has no path under packages/d).
      expect(findResult(result.workspaceResults, "a").isAffected).toBe(false);
    });

    test("expands a glob pattern to matching files", async () => {
      const project = makeProject(getProjectRoot("affectedWithInputs"));
      const result = await project.determineAffectedWorkspaces({
        diffSource: "fileList",
        changedFiles: ["packages/*/package.json"],
      });
      // 'e' explicitly lists package.json in its inputs → directly affected
      expect(findResult(result.workspaceResults, "e").isAffected).toBe(true);
      // 'd' has '.' default input → its package.json matches → affected
      expect(findResult(result.workspaceResults, "d").isAffected).toBe(true);
      // 'a' has src/**/* — package.json doesn't match. No package.json edit
      // for 'a's deps either, so not affected.
      expect(findResult(result.workspaceResults, "a").isAffected).toBe(false);
    });

    test("'!' exclusions remove files from the include set", async () => {
      const project = makeProject(getProjectRoot("affectedWithInputs"));
      const result = await project.determineAffectedWorkspaces({
        diffSource: "fileList",
        changedFiles: ["packages/*/package.json", "!packages/e/package.json"],
      });
      // 'e's package.json was excluded so its only matching file is gone
      expect(findResult(result.workspaceResults, "e").isAffected).toBe(false);
      // 'd' still affected via '.' input matching its own package.json
      expect(findResult(result.workspaceResults, "d").isAffected).toBe(true);
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
      // 'd' (input='.'), 'e' (package.json input), and 'c' (workspacePatterns
      // includes 'd') are affected via the broad expansion.
      expect(findResult(result.workspaceResults, "d").isAffected).toBe(true);
      expect(findResult(result.workspaceResults, "e").isAffected).toBe(true);
      expect(findResult(result.workspaceResults, "c").isAffected).toBe(true);
      // 'a' and 'b' have narrow src/**/* inputs — fixture has no src files,
      // so nothing matches and the workspace dep chain doesn't trigger them.
      expect(findResult(result.workspaceResults, "a").isAffected).toBe(false);
      expect(findResult(result.workspaceResults, "b").isAffected).toBe(false);
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

    test("result.inputs reflects configured inputs verbatim", async () => {
      const project = makeProject(getProjectRoot("affectedWithInputs"));
      const result = await project.determineAffectedWorkspaces({
        diffSource: "fileList",
        changedFiles: [],
      });
      expect(findResult(result.workspaceResults, "a").inputs).toEqual({
        files: ["src/**/*"],
        workspacePatterns: [],
      });
      // 'd' has no pacwich.workspace.json → falls back to default "." pattern
      expect(findResult(result.workspaceResults, "d").inputs).toEqual({
        files: ["."],
        workspacePatterns: [],
      });
    });

    test("workspacePatterns inputs treat matched workspaces as input dependencies", async () => {
      const project = makeProject(getProjectRoot("affectedWithInputs"));
      // c has defaultInputs.workspacePatterns = ["d"]; d has no inputs config
      // (default "." input). Changing a file under packages/d affects 'd'
      // which propagates to 'c' via the input workspace dependency.
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

  describe("bun.lock as a fileList signal", () => {
    test("workspaces without external deps are not affected by bun.lock alone", async () => {
      const project = makeProject(getProjectRoot("affectedWithInputs"));
      const result = await project.determineAffectedWorkspaces({
        diffSource: "fileList",
        changedFiles: [PROJECT_LOCKFILE_PATH],
      });
      // The affectedWithInputs fixture's workspaces have no external deps,
      // so the lockfile-as-trigger heuristic produces no synthetic entries.
      for (const name of ["a", "b", "c", "d", "e"]) {
        expect(findResult(result.workspaceResults, name).isAffected).toBe(
          false,
        );
      }
    });

    test("workspaces with external deps are flagged with synthetic null/null entries", async () => {
      const project = makeProject(loadFixture("withDependenciesWithExternal"));
      const result = await project.determineAffectedWorkspaces({
        diffSource: "fileList",
        changedFiles: [PROJECT_LOCKFILE_PATH],
      });
      // 'a' has lodash + typescript externals → flagged
      const a = findResult(result.workspaceResults, "a");
      expect(a.isAffected).toBe(true);
      expect(a.affectedReasons.externalDependencies).toEqual([
        {
          name: "lodash",
          source: "dependencies",
          baseVersion: null,
          headVersion: null,
        },
        {
          name: "typescript",
          source: "devDependencies",
          baseVersion: null,
          headVersion: null,
        },
      ]);
      // 'c' has peer + optional externals → also flagged (all four sources participate)
      const c = findResult(result.workspaceResults, "c");
      expect(c.isAffected).toBe(true);
      expect(c.affectedReasons.externalDependencies).toEqual([
        {
          name: "fsevents",
          source: "optionalDependencies",
          baseVersion: null,
          headVersion: null,
        },
        {
          name: "react",
          source: "peerDependencies",
          baseVersion: null,
          headVersion: null,
        },
      ]);
      // 'd' has no external deps → not flagged via this signal
      expect(findResult(result.workspaceResults, "d").isAffected).toBe(false);
    });

    test("ignoreExternalDependencies suppresses the bun.lock signal in fileList mode", async () => {
      const project = makeProject(loadFixture("withDependenciesWithExternal"));
      const result = await project.determineAffectedWorkspaces({
        diffSource: "fileList",
        changedFiles: [PROJECT_LOCKFILE_PATH],
        ignoreExternalDependencies: true,
      });
      // Even 'a' (which has externals) is not flagged when suppressed
      expect(findResult(result.workspaceResults, "a").isAffected).toBe(false);
      for (const ws of result.workspaceResults) {
        expect(ws.affectedReasons.externalDependencies).toEqual([]);
      }
    });
  });

  describe("inputs.externalDependencies filter", () => {
    test("non-empty filter limits affectedReasons to listed deps and excludes others", async () => {
      const project = makeProject(
        getProjectRoot("affectedWithExternalDepInputs"),
      );
      const result = await project.determineAffectedWorkspaces({
        diffSource: "fileList",
        changedFiles: [PROJECT_LOCKFILE_PATH],
      });
      const a = findResult(result.workspaceResults, "a-filtered");
      // a-filtered has externals lodash + typescript (dev) but the
      // workspace's defaultInputs.externalDependencies = ["lodash"], so
      // typescript is filtered out from both the affected trigger and the
      // reported reasons.
      expect(a.isAffected).toBe(true);
      expect(a.affectedReasons.externalDependencies).toEqual([
        {
          name: "lodash",
          source: "dependencies",
          baseVersion: null,
          headVersion: null,
        },
      ]);
    });

    test("empty array filter excludes the workspace from the lockfile signal", async () => {
      const project = makeProject(
        getProjectRoot("affectedWithExternalDepInputs"),
      );
      const result = await project.determineAffectedWorkspaces({
        diffSource: "fileList",
        changedFiles: [PROJECT_LOCKFILE_PATH],
      });
      const b = findResult(result.workspaceResults, "b-empty");
      // b-empty has externals react + lodash but defaultInputs.externalDependencies = []
      // silences lockfile-driven affectedness for this workspace.
      expect(b.isAffected).toBe(false);
      expect(b.affectedReasons.externalDependencies).toEqual([]);
    });

    test("undefined filter (no config) lets every declared external participate", async () => {
      const project = makeProject(
        getProjectRoot("affectedWithExternalDepInputs"),
      );
      const result = await project.determineAffectedWorkspaces({
        diffSource: "fileList",
        changedFiles: [PROJECT_LOCKFILE_PATH],
      });
      const c = findResult(result.workspaceResults, "c-default");
      // c-default has no pacwich.workspace.json → no filter → react participates.
      expect(c.isAffected).toBe(true);
      expect(c.affectedReasons.externalDependencies).toEqual([
        {
          name: "react",
          source: "dependencies",
          baseVersion: null,
          headVersion: null,
        },
      ]);
    });

    test("result.inputs reflects configured externalDependencies field", async () => {
      const project = makeProject(
        getProjectRoot("affectedWithExternalDepInputs"),
      );
      const result = await project.determineAffectedWorkspaces({
        diffSource: "fileList",
        changedFiles: [],
      });
      expect(findResult(result.workspaceResults, "a-filtered").inputs).toEqual({
        files: ["."],
        workspacePatterns: [],
        externalDependencies: ["lodash"],
      });
      expect(findResult(result.workspaceResults, "b-empty").inputs).toEqual({
        files: ["."],
        workspacePatterns: [],
        externalDependencies: [],
      });
      // No config → externalDependencies field omitted from result.inputs
      expect(findResult(result.workspaceResults, "c-default").inputs).toEqual({
        files: ["."],
        workspacePatterns: [],
      });
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
        ignoreWorkspaceDependencies: true,
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
        ignoreWorkspaceDependencies: true,
      });
      expect(findResult(result.workspaceResults, "b").isAffected).toBe(true);
    });

    test("result.inputs reflects script-level inputs when used", async () => {
      const project = makeProject(getProjectRoot("affectedWithInputs"));
      const result = await project.determineAffectedWorkspaces({
        diffSource: "fileList",
        changedFiles: [],
        script: "build",
        ignoreWorkspaceDependencies: true,
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
        ignoreWorkspaceDependencies: true,
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
        ignoreWorkspaceDependencies: true,
      });
      expect(findResult(result.workspaceResults, "a").isAffected).toBe(true);
    });
  });

  describe("git diffSource", () => {
    test("metadata.git carries the resolved baseRef and headRef", async () => {
      await using fixture = await createGitFixture({
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
        git: {
          baseRef: baseSha,
          headRef: headSha,
          baseSha,
          headSha,
        },
      });
    });

    test("default baseRef comes from root config / 'main' fallback; default headRef is 'HEAD'", async () => {
      await using fixture = await createGitFixture({
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
      expect(result.metadata.git).toEqual({
        baseRef: "main",
        headRef: "HEAD",
        baseSha: fixture.headSha,
        headSha: fixture.headSha,
      });
    });

    test("metadata.git includes baseSha and headSha resolved from named refs", async () => {
      await using fixture = await createGitFixture({
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
        diffOptions: {
          baseRef: "HEAD~1",
          headRef: "HEAD",
          ignoreUncommitted: true,
        },
      });
      expect(result.metadata.git).toEqual({
        baseRef: "HEAD~1",
        headRef: "HEAD",
        baseSha: fixture.shaForMessage("init"),
        headSha: fixture.shaForMessage("change"),
      });
    });

    test("changed files are populated with gitReasons", async () => {
      await using fixture = await createGitFixture({
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
      await using fixture = await createGitFixture({
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
      await using fixture = await createGitFixture({
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
      await using fixture = await createGitFixture({
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

  describe("git diffSource with external dependency tracking", () => {
    const buildExternalDepLockfile = (lodashVersion: string): string =>
      JSON.stringify({
        lockfileVersion: 1,
        configVersion: 1,
        workspaces: {
          "": { name: "test-root" },
          "packages/a": {
            name: "a",
            dependencies: { lodash: "^4.17.0" },
          },
          "packages/b": { name: "b" },
        },
        packages: {
          a: ["a@workspace:packages/a"],
          b: ["b@workspace:packages/b"],
          lodash: [`lodash@${lodashVersion}`, {}, "<sha>"],
        },
      });

    const EXTERNAL_DEP_FILES = [
      {
        path: "package.json",
        content: JSON.stringify({
          name: "test-root",
          workspaces: ["packages/*"],
        }),
      },
      {
        path: "packages/a/package.json",
        content: JSON.stringify({
          name: "a",
          dependencies: { lodash: "^4.17.0" },
        }),
      },
      {
        path: "packages/b/package.json",
        content: JSON.stringify({ name: "b" }),
      },
    ];

    test("a lockfile-only version bump for an external dep flags the workspace", async () => {
      await using fixture = await createGitFixture({
        commits: [
          {
            message: "init",
            files: [
              ...EXTERNAL_DEP_FILES,
              {
                path: "bun.lock",
                content: buildExternalDepLockfile("4.17.21"),
              },
            ],
          },
          {
            message: "bump",
            files: [
              {
                path: "bun.lock",
                content: buildExternalDepLockfile("4.17.22"),
              },
            ],
          },
        ],
      });
      const project = makeProject(fixture.projectPath);
      const result = await project.determineAffectedWorkspaces({
        diffSource: "git",
        diffOptions: {
          baseRef: fixture.shaForMessage("init"),
          headRef: fixture.shaForMessage("bump"),
          ignoreUncommitted: true,
        },
      });
      const a = findResult(result.workspaceResults, "a");
      expect(a.isAffected).toBe(true);
      expect(a.affectedReasons.externalDependencies).toEqual([
        {
          name: "lodash",
          source: "dependencies",
          baseVersion: "4.17.21",
          headVersion: "4.17.22",
        },
      ]);
      // 'b' has no external deps, no source files changed → not affected
      expect(findResult(result.workspaceResults, "b").isAffected).toBe(false);
    });

    test("ignoreExternalDependencies suppresses lockfile-based tracking entirely", async () => {
      await using fixture = await createGitFixture({
        commits: [
          {
            message: "init",
            files: [
              ...EXTERNAL_DEP_FILES,
              {
                path: "bun.lock",
                content: buildExternalDepLockfile("4.17.21"),
              },
            ],
          },
          {
            message: "bump",
            files: [
              {
                path: "bun.lock",
                content: buildExternalDepLockfile("4.17.22"),
              },
            ],
          },
        ],
      });
      const project = makeProject(fixture.projectPath);
      const result = await project.determineAffectedWorkspaces({
        diffSource: "git",
        diffOptions: {
          baseRef: fixture.shaForMessage("init"),
          headRef: fixture.shaForMessage("bump"),
          ignoreUncommitted: true,
        },
        ignoreExternalDependencies: true,
      });
      // Lockfile in changed files won't match 'a's defaults — and external
      // tracking is disabled — so 'a' is not affected.
      const a = findResult(result.workspaceResults, "a");
      expect(a.isAffected).toBe(false);
      expect(a.affectedReasons.externalDependencies).toEqual([]);
    });

    test("an external dep change cascades through workspace deps unless ignored", async () => {
      const cascadeProjectFiles = [
        {
          path: "package.json",
          content: JSON.stringify({
            name: "test-root",
            workspaces: ["packages/*"],
          }),
        },
        {
          path: "bun.lock",
          content: JSON.stringify({
            lockfileVersion: 1,
            configVersion: 1,
            workspaces: {
              "": { name: "test-root" },
              "packages/a": {
                name: "a",
                dependencies: { lodash: "^4.17.0" },
              },
              "packages/b": {
                name: "b",
                dependencies: { a: "workspace:*" },
              },
            },
            packages: {
              a: ["a@workspace:packages/a"],
              b: ["b@workspace:packages/b"],
              lodash: ["lodash@4.17.21", {}, "<sha>"],
            },
          }),
        },
        {
          path: "packages/a/package.json",
          content: JSON.stringify({
            name: "a",
            dependencies: { lodash: "^4.17.0" },
          }),
        },
        {
          path: "packages/b/package.json",
          content: JSON.stringify({
            name: "b",
            dependencies: { a: "workspace:*" },
          }),
        },
      ];
      await using fixture = await createGitFixture({
        commits: [
          { message: "init", files: cascadeProjectFiles },
          {
            message: "bump",
            files: [
              {
                path: "bun.lock",
                content: JSON.stringify({
                  lockfileVersion: 1,
                  configVersion: 1,
                  workspaces: {
                    "": { name: "test-root" },
                    "packages/a": {
                      name: "a",
                      dependencies: { lodash: "^4.17.0" },
                    },
                    "packages/b": {
                      name: "b",
                      dependencies: { a: "workspace:*" },
                    },
                  },
                  packages: {
                    a: ["a@workspace:packages/a"],
                    b: ["b@workspace:packages/b"],
                    lodash: ["lodash@4.17.22", {}, "<sha>"],
                  },
                }),
              },
            ],
          },
        ],
      });
      const project = makeProject(fixture.projectPath);
      const result = await project.determineAffectedWorkspaces({
        diffSource: "git",
        diffOptions: {
          baseRef: fixture.shaForMessage("init"),
          headRef: fixture.shaForMessage("bump"),
          ignoreUncommitted: true,
        },
      });
      // 'a' directly affected via lodash version change; 'b' cascades via dep
      expect(findResult(result.workspaceResults, "a").isAffected).toBe(true);
      expect(findResult(result.workspaceResults, "b").isAffected).toBe(true);

      // With ignoreWorkspaceDependencies, the cascade is dropped
      const noCascade = await project.determineAffectedWorkspaces({
        diffSource: "git",
        diffOptions: {
          baseRef: fixture.shaForMessage("init"),
          headRef: fixture.shaForMessage("bump"),
          ignoreUncommitted: true,
        },
        ignoreWorkspaceDependencies: true,
      });
      expect(findResult(noCascade.workspaceResults, "a").isAffected).toBe(true);
      expect(findResult(noCascade.workspaceResults, "b").isAffected).toBe(
        false,
      );
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

  describe("option-shape edge cases", () => {
    test("fileList silently ignores diffOptions (the field belongs to the git shape)", async () => {
      const project = makeProject(getProjectRoot("affectedWithInputs"));
      const result = await project.determineAffectedWorkspaces({
        diffSource: "fileList",
        changedFiles: ["packages/a/src/index.ts"],
        // diffOptions is part of the git shape; passing it under fileList
        // should be ignored at runtime, not surface as a validation error.
        diffOptions: { baseRef: "bogus" },
      } as unknown as Parameters<
        typeof project.determineAffectedWorkspaces
      >[0]);

      expect(result.metadata.diffSource).toBe("fileList");
      expect("git" in result.metadata).toBe(false);
      expect(findResult(result.workspaceResults, "a").isAffected).toBe(true);
    });

    test("changedFiles with only '!' negations matches nothing", async () => {
      const project = makeProject(getProjectRoot("affectedWithInputs"));
      const result = await project.determineAffectedWorkspaces({
        diffSource: "fileList",
        changedFiles: ["!packages/a/src/**/*"],
      });
      for (const workspaceResult of result.workspaceResults) {
        expect(workspaceResult.isAffected).toBe(false);
      }
    });

    test("ignoreWorkspaceDependencies + ignoreExternalDependencies leaves only direct file signals", async () => {
      await using fixture = await createGitFixture({
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
        ignoreWorkspaceDependencies: true,
        ignoreExternalDependencies: true,
      });
      // 'a' has the direct file change → affected via its own input
      expect(findResult(result.workspaceResults, "a").isAffected).toBe(true);
      // 'b' depends on 'a' but cascade is suppressed
      expect(findResult(result.workspaceResults, "b").isAffected).toBe(false);
    });
  });
});
