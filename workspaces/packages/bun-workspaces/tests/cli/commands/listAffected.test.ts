import { afterEach, describe, expect, test } from "bun:test";
import {
  assertOutputMatches,
  listCommandAndAliases,
  setupCliTest,
} from "../../util/cliTestUtils";
import { createGitFixture, type GitFixture } from "../../util/gitFixtures";
import { withWindowsPath } from "../../util/windows";

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

const newGitFixture = async (
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

describe("List Affected", () => {
  describe("command and aliases", () => {
    test.each(listCommandAndAliases("listAffected"))(
      "default output lists affected workspace names: %s",
      async (command) => {
        const { run } = setupCliTest({ testProject: "affectedWithInputs" });
        const result = await run(command, "--files", "packages/a/src/index.ts");
        expect(result.exitCode).toBe(0);
        assertOutputMatches(result.stdout.sanitized, "a\nb");
      },
    );
  });

  describe("default output (no flags)", () => {
    test("returns newline-separated affected workspace names", async () => {
      const { run } = setupCliTest({ testProject: "affectedWithInputs" });
      const result = await run(
        "list-affected",
        "--files",
        "packages/a/src/index.ts",
      );
      expect(result.exitCode).toBe(0);
      assertOutputMatches(result.stdout.sanitized, "a\nb");
    });

    test("emits 'No affected workspaces' when nothing is affected", async () => {
      const { run } = setupCliTest({ testProject: "affectedWithInputs" });
      // 'e' has defaultInputs limited to package.json so an unrelated path
      // doesn't match; with --ignore-package-deps no cascade applies either
      const result = await run(
        "list-affected",
        "--files",
        "unrelated/path.txt",
        "--ignore-workspace-deps",
      );
      expect(result.exitCode).toBe(0);
      assertOutputMatches(result.stdout.sanitized, "No affected workspaces");
    });
  });

  describe("--json output", () => {
    test("emits a JSON array of workspace names", async () => {
      const { run } = setupCliTest({ testProject: "affectedWithInputs" });
      const result = await run(
        "list-affected",
        "--files",
        "packages/a/src/index.ts",
        "--json",
      );
      expect(result.exitCode).toBe(0);
      assertOutputMatches(result.stdout.sanitized, JSON.stringify(["a", "b"]));
    });

    test("-j short form works", async () => {
      const { run } = setupCliTest({ testProject: "affectedWithInputs" });
      const result = await run(
        "ls-affected",
        "-F",
        "packages/a/src/index.ts",
        "-j",
      );
      expect(result.exitCode).toBe(0);
      assertOutputMatches(result.stdout.sanitized, JSON.stringify(["a", "b"]));
    });

    test("--json --pretty pretty-prints", async () => {
      const { run } = setupCliTest({ testProject: "affectedWithInputs" });
      const result = await run(
        "list-affected",
        "--files",
        "packages/a/src/index.ts",
        "--json",
        "--pretty",
      );
      expect(result.exitCode).toBe(0);
      assertOutputMatches(
        result.stdout.sanitized,
        JSON.stringify(["a", "b"], null, 2),
      );
    });
  });

  describe("--explain output", () => {
    test("summary lists workspace, file count, and dep names", async () => {
      const { run } = setupCliTest({ testProject: "affectedWithInputs" });
      const result = await run(
        "list-affected",
        "--files",
        "packages/a/src/index.ts",
        "--explain",
      );
      expect(result.exitCode).toBe(0);
      const out = result.stdout.sanitized;
      expect(out).toContain("Workspace: a");
      expect(out).toContain("Workspace: b");
      // 'a' has its own changed file; 'b' is reached through a dep cascade
      expect(out).toMatch(/Workspace: a[\s\S]*Changed input files: 1/);
      expect(out).toMatch(/Workspace: b[\s\S]*Affected dependencies:.*a/);
      expect(out).toContain("Pass --detailed for more info");
    });

    test("-e short form works", async () => {
      const { run } = setupCliTest({ testProject: "affectedWithInputs" });
      const result = await run(
        "list-affected",
        "-F",
        "packages/a/src/index.ts",
        "-e",
      );
      expect(result.exitCode).toBe(0);
      expect(result.stdout.sanitized).toContain("Workspace: a");
    });

    test("emits 'No affected workspaces' inside --explain output too", async () => {
      const { run } = setupCliTest({ testProject: "affectedWithInputs" });
      const result = await run(
        "list-affected",
        "--files",
        "unrelated/path.txt",
        "--ignore-workspace-deps",
        "--explain",
      );
      expect(result.exitCode).toBe(0);
      expect(result.stdout.sanitized).toContain("No affected workspaces");
    });
  });

  describe("--explain --detailed output", () => {
    test("renders per-file paths and dep chains", async () => {
      const { run } = setupCliTest({ testProject: "affectedWithInputs" });
      const result = await run(
        "list-affected",
        "--files",
        "packages/a/src/index.ts",
        "--explain",
        "--detailed",
      );
      expect(result.exitCode).toBe(0);
      const out = result.stdout.sanitized;
      // 'a' has its file listed with the input pattern that matched.
      // The path is rendered with the OS-native separator, like
      // list-workspaces output, so wrap with `withWindowsPath`.
      expect(out).toContain("Workspace: a");
      expect(out).toContain(withWindowsPath("src/index.ts"));
      expect(out).toContain('(input: "src/**/*")');
      // 'b' has chain that traces back to 'a' via the package edge
      expect(out).toMatch(/chain: b.*--\[package\].*a/);
      // The "Pass --detailed" hint is suppressed in detailed mode
      expect(out).not.toContain("Pass --detailed");
    });

    test("-D requires -e (errors otherwise)", async () => {
      const { run } = setupCliTest({ testProject: "affectedWithInputs" });
      const result = await run(
        "list-affected",
        "--files",
        "packages/a/src/index.ts",
        "-D",
      );
      expect(result.exitCode).toBe(1);
      assertOutputMatches(
        result.stderr.sanitized,
        "CLI syntax error: --detailed requires --explain",
      );
    });
  });

  describe("--explain --json output", () => {
    test("emits the full result object instead of a name array", async () => {
      const { run } = setupCliTest({ testProject: "affectedWithInputs" });
      const result = await run(
        "list-affected",
        "--files",
        "packages/a/src/index.ts",
        "--explain",
        "--json",
      );
      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout.sanitized);
      expect(parsed).toHaveProperty("metadata");
      expect(parsed.metadata).toEqual({ diffSource: "fileList" });
      expect(parsed).toHaveProperty("workspaceResults");
      expect(Array.isArray(parsed.workspaceResults)).toBe(true);
      const a = parsed.workspaceResults.find(
        (r: { workspace: { name: string } }) => r.workspace.name === "a",
      );
      expect(a.isAffected).toBe(true);
      expect(a.affectedReasons.changedFiles[0]).toMatchObject({
        projectFilePath: "packages/a/src/index.ts",
        inputMatch: "src/**/*",
      });
    });

    test("--detailed has no effect on JSON output shape", async () => {
      const { run } = setupCliTest({ testProject: "affectedWithInputs" });
      const withDetailed = await run(
        "list-affected",
        "--files",
        "packages/a/src/index.ts",
        "--explain",
        "--json",
        "--detailed",
      );
      const withoutDetailed = await run(
        "list-affected",
        "--files",
        "packages/a/src/index.ts",
        "--explain",
        "--json",
      );
      expect(withDetailed.exitCode).toBe(0);
      expect(withoutDetailed.exitCode).toBe(0);
      expect(withDetailed.stdout.sanitized).toBe(
        withoutDetailed.stdout.sanitized,
      );
    });
  });

  describe("--script", () => {
    test("uses per-script inputs when present", async () => {
      const { run } = setupCliTest({ testProject: "affectedWithInputs" });
      // 'a' has scripts.build.inputs.files=["build/**/*"], so a change to
      // src/ should NOT match the build script's inputs
      const result = await run(
        "list-affected",
        "--files",
        "packages/a/src/index.ts",
        "--script",
        "build",
        "--ignore-workspace-deps",
      );
      expect(result.exitCode).toBe(0);
      assertOutputMatches(result.stdout.sanitized, "No affected workspaces");
    });

    test("a build/ change matches the build script's inputs", async () => {
      const { run } = setupCliTest({ testProject: "affectedWithInputs" });
      const result = await run(
        "list-affected",
        "--files",
        "packages/a/build/out.js",
        "-S",
        "build",
        "--ignore-workspace-deps",
      );
      expect(result.exitCode).toBe(0);
      assertOutputMatches(result.stdout.sanitized, "a");
    });
  });

  describe("--ignore-workspace-deps", () => {
    test("blocks cascade through workspace:* dependencies", async () => {
      const { run } = setupCliTest({ testProject: "affectedWithInputs" });
      const result = await run(
        "list-affected",
        "--files",
        "packages/a/src/index.ts",
        "--ignore-workspace-deps",
      );
      expect(result.exitCode).toBe(0);
      // Without it, 'b' would also appear via the package dep on 'a'
      assertOutputMatches(result.stdout.sanitized, "a");
    });
  });

  describe("--ignore-external-deps", () => {
    test("suppresses lockfile-based external dep tracking in fileList mode", async () => {
      const { run } = setupCliTest({
        testProject: "withDependenciesWithExternal",
      });
      const result = await run(
        "list-affected",
        "--files",
        "bun.lock",
        "--ignore-external-deps",
      );
      expect(result.exitCode).toBe(0);
      // 'a' would have been flagged via lockfile heuristic but suppression
      // disables that path.
      assertOutputMatches(result.stdout.sanitized, "No affected workspaces");
    });
  });

  describe("external dependencies in --explain", () => {
    test("default summary lists external dep names", async () => {
      const { run } = setupCliTest({
        testProject: "withDependenciesWithExternal",
      });
      const result = await run(
        "list-affected",
        "--files",
        "bun.lock",
        "--explain",
      );
      expect(result.exitCode).toBe(0);
      const out = result.stdout.sanitized;
      expect(out).toContain("Workspace: a");
      // 'a' has lodash + typescript (dev) externals
      expect(out).toMatch(
        /Workspace: a[\s\S]*Changed external dependencies:.*lodash/,
      );
      expect(out).toContain("typescript (dev)");
    });

    test("detailed view renders 'lockfile changed' note for fileList mode", async () => {
      const { run } = setupCliTest({
        testProject: "withDependenciesWithExternal",
      });
      const result = await run(
        "list-affected",
        "--files",
        "bun.lock",
        "--explain",
        "--detailed",
      );
      expect(result.exitCode).toBe(0);
      expect(result.stdout.sanitized).toContain(
        "lockfile changed; precise diff unavailable",
      );
    });
  });

  describe("--files conflicts with git options", () => {
    test("--files + --base errors", async () => {
      const { run } = setupCliTest({ testProject: "affectedWithInputs" });
      const result = await run(
        "list-affected",
        "--files",
        "packages/a/src/index.ts",
        "--base",
        "main",
      );
      expect(result.exitCode).toBe(1);
      assertOutputMatches(
        result.stderr.sanitized,
        "CLI syntax error: --files cannot be used with --base or --head",
      );
    });

    test("--files + --head errors", async () => {
      const { run } = setupCliTest({ testProject: "affectedWithInputs" });
      const result = await run(
        "list-affected",
        "-F",
        "packages/a/src/index.ts",
        "-H",
        "HEAD",
      );
      expect(result.exitCode).toBe(1);
      assertOutputMatches(
        result.stderr.sanitized,
        "CLI syntax error: --files cannot be used with --base or --head",
      );
    });
  });

  describe("git diff source", () => {
    test("--base and --head select the diff range", async () => {
      const fixture = await newGitFixture({
        commits: [
          { message: "init", files: TWO_WORKSPACE_PROJECT_FILES },
          {
            message: "change",
            files: [{ path: "packages/a/src/index.ts", content: "1" }],
          },
        ],
        initialBranch: "main",
      });
      const { run } = setupCliTest({ workingDirectory: fixture.projectPath });
      const result = await run(
        "list-affected",
        "--base",
        "HEAD~1",
        "--head",
        "HEAD",
        "--ignore-uncommitted",
      );
      expect(result.exitCode).toBe(0);
      assertOutputMatches(result.stdout.sanitized, "a\nb");
    });

    test("--explain header shows the refs and short SHAs", async () => {
      const fixture = await newGitFixture({
        commits: [
          { message: "init", files: TWO_WORKSPACE_PROJECT_FILES },
          {
            message: "change",
            files: [{ path: "packages/a/src/index.ts", content: "1" }],
          },
        ],
        initialBranch: "main",
      });
      const baseSha = fixture.shaForMessage("init");
      const headSha = fixture.shaForMessage("change");
      const { run } = setupCliTest({ workingDirectory: fixture.projectPath });
      const result = await run(
        "list-affected",
        "-B",
        "HEAD~1",
        "-H",
        "HEAD",
        "--ignore-uncommitted",
        "-e",
      );
      expect(result.exitCode).toBe(0);
      const out = result.stdout.sanitized;
      expect(out).toContain(`Git base ref: HEAD~1 (${baseSha.slice(0, 7)})`);
      expect(out).toContain(`Git head ref: HEAD (${headSha.slice(0, 7)})`);
    });

    test("--ignore-uncommitted excludes working-tree state", async () => {
      const fixture = await newGitFixture({
        commits: [{ message: "init", files: TWO_WORKSPACE_PROJECT_FILES }],
        workingState: {
          modify: [{ path: "packages/a/src/index.ts", content: "x" }],
        },
        initialBranch: "main",
      });
      const { run } = setupCliTest({ workingDirectory: fixture.projectPath });
      const result = await run(
        "list-affected",
        "--base",
        "HEAD",
        "--head",
        "HEAD",
        "--ignore-uncommitted",
      );
      expect(result.exitCode).toBe(0);
      assertOutputMatches(result.stdout.sanitized, "No affected workspaces");
    });

    test("--ignore-untracked excludes untracked files", async () => {
      const fixture = await newGitFixture({
        commits: [{ message: "init", files: TWO_WORKSPACE_PROJECT_FILES }],
        workingState: {
          modify: [{ path: "packages/a/src/new.ts", content: "x" }],
        },
        initialBranch: "main",
      });
      const { run } = setupCliTest({ workingDirectory: fixture.projectPath });
      const result = await run(
        "list-affected",
        "--base",
        "HEAD",
        "--head",
        "HEAD",
        "--ignore-untracked",
      );
      expect(result.exitCode).toBe(0);
      assertOutputMatches(result.stdout.sanitized, "No affected workspaces");
    });

    test("--ignore-staged excludes staged files", async () => {
      const fixture = await newGitFixture({
        commits: [{ message: "init", files: TWO_WORKSPACE_PROJECT_FILES }],
        workingState: {
          stage: [{ path: "packages/a/src/index.ts", content: "1" }],
        },
        initialBranch: "main",
      });
      const { run } = setupCliTest({ workingDirectory: fixture.projectPath });
      const result = await run(
        "list-affected",
        "--base",
        "HEAD",
        "--head",
        "HEAD",
        "--ignore-staged",
      );
      expect(result.exitCode).toBe(0);
      // Staged change to packages/a/src/index.ts also surfaces as unstaged
      // because staged content differs from working tree only when file is
      // overwritten — but here writing then add leaves working == index.
      // So the unstaged collector sees no change either; only --ignore-staged
      // filters but unstaged is blank → no affected.
      assertOutputMatches(result.stdout.sanitized, "No affected workspaces");
    });

    test("--ignore-unstaged excludes unstaged files", async () => {
      const fixture = await newGitFixture({
        commits: [{ message: "init", files: TWO_WORKSPACE_PROJECT_FILES }],
        workingState: {
          modify: [{ path: "packages/a/src/index.ts", content: "x" }],
        },
        initialBranch: "main",
      });
      const { run } = setupCliTest({ workingDirectory: fixture.projectPath });
      const result = await run(
        "list-affected",
        "--base",
        "HEAD",
        "--head",
        "HEAD",
        "--ignore-unstaged",
        "--ignore-untracked",
      );
      expect(result.exitCode).toBe(0);
      assertOutputMatches(result.stdout.sanitized, "No affected workspaces");
    });
  });
});
