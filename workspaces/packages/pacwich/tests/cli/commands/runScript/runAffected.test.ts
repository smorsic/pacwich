import fs from "fs";
import path from "path";
import { resolvePackageManagerAdapter } from "../../../../src/packageManager/adapter";
import { getProjectRoot } from "../../../fixtures/testProjects";
import { assertOutputMatches, setupCliTest } from "../../../util/cliTestUtils";
import { createGitFixture } from "../../../util/gitFixtures";
import { getModuleDir } from "../../../util/runtime";
import { describe, expect, test } from "../../../util/testFramework";

// `--files` callsites that target the project's lockfile go through
// `adapter.lockfile.projectRelativePath` rather than the literal
// `"bun.lock"`, so the CLI affected-signal tests track whatever
// lockfile path the active adapter exposes.
//
// The synthetic git fixtures below still use the literal `"bun.lock"`
// for `path:` and a bun-format JSON body for `content:` — that JSON is
// intrinsically bun-shaped, so those tests are bun-only by
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

const PACKAGE_A_JSON = JSON.stringify({
  name: "a",
  scripts: { "echo-script": "echo a" },
});

const PACKAGE_B_JSON = JSON.stringify({
  name: "b",
  dependencies: { a: "workspace:*" },
  scripts: { "echo-script": "echo b" },
});

const TWO_WORKSPACE_PROJECT_FILES = [
  { path: "package.json", content: PROJECT_ROOT_PACKAGE_JSON },
  { path: "bun.lock", content: TWO_WORKSPACE_BUN_LOCK },
  { path: "packages/a/package.json", content: PACKAGE_A_JSON },
  { path: "packages/b/package.json", content: PACKAGE_B_JSON },
];

describe("CLI Run Affected", () => {
  describe("script name resolution", () => {
    test("positional script name runs the script across affected workspaces", async () => {
      const { run } = setupCliTest({ testProject: "affectedWithInputs" });
      const result = await run(
        "run-affected",
        "echo-script",
        "--files",
        "packages/a/src/index.ts",
        "--parallel=false",
        "--output-style=plain",
      );
      expect(result.exitCode).toBe(0);
      const out = result.stdoutAndErr.sanitizedCompactLines;
      expect(out).toContain("✅ a: echo-script");
      expect(out).toContain("✅ b: echo-script");
      expect(out).toContain("2 scripts ran successfully");
    });

    test("--script flag is equivalent to the positional", async () => {
      const { run } = setupCliTest({ testProject: "affectedWithInputs" });
      const result = await run(
        "run-affected",
        "--script=echo-script",
        "--files",
        "packages/a/src/index.ts",
        "--parallel=false",
        "--output-style=plain",
      );
      expect(result.exitCode).toBe(0);
      const out = result.stdoutAndErr.sanitizedCompactLines;
      expect(out).toContain("✅ a: echo-script");
      expect(out).toContain("✅ b: echo-script");
    });

    test("-S short form works", async () => {
      const { run } = setupCliTest({ testProject: "affectedWithInputs" });
      const result = await run(
        "run-affected",
        "-S",
        "echo-script",
        "-F",
        "packages/a/src/index.ts",
        "--parallel=false",
        "--output-style=plain",
      );
      expect(result.exitCode).toBe(0);
      expect(result.stdoutAndErr.sanitizedCompactLines).toContain(
        "2 scripts ran successfully",
      );
    });

    test("errors when both positional script and --script are used", async () => {
      const { run } = setupCliTest({ testProject: "affectedWithInputs" });
      const result = await run(
        "run-affected",
        "echo-script",
        "--script=echo-script",
        "--files",
        "packages/a/src/index.ts",
        "--parallel=false",
      );
      expect(result.exitCode).toBe(1);
      assertOutputMatches(
        result.stderr.sanitizedCompactLines,
        "CLI syntax error: Cannot use both inline script positional and --script|-S option",
      );
    });
  });

  describe("no affected workspaces", () => {
    test("emits a clean summary with no failures", async () => {
      const { run } = setupCliTest({ testProject: "affectedWithInputs" });
      const result = await run(
        "run-affected",
        "echo-script",
        "--files",
        "unrelated/path.txt",
        "--ignore-workspace-deps",
        "--parallel=false",
        "--output-style=plain",
      );
      expect(result.exitCode).toBe(0);
      expect(result.stdoutAndErr.sanitizedCompactLines).toContain(
        "0 scripts ran successfully",
      );
    });
  });

  describe("--files mode", () => {
    test("only runs in affected workspaces (cascade through workspace deps)", async () => {
      const { run } = setupCliTest({ testProject: "affectedWithInputs" });
      const result = await run(
        "run-affected",
        "echo-script",
        "--files",
        "packages/a/src/index.ts",
        "--parallel=false",
        "--output-style=plain",
      );
      expect(result.exitCode).toBe(0);
      const out = result.stdoutAndErr.sanitizedCompactLines;
      // 'a' is changed directly; 'b' is reached via workspace dep cascade
      expect(out).toContain("✅ a: echo-script");
      expect(out).toContain("✅ b: echo-script");
    });

    test("--ignore-workspace-deps blocks the cascade", async () => {
      const { run } = setupCliTest({ testProject: "affectedWithInputs" });
      const result = await run(
        "run-affected",
        "echo-script",
        "--files",
        "packages/a/src/index.ts",
        "--ignore-workspace-deps",
        "--parallel=false",
        "--output-style=plain",
      );
      expect(result.exitCode).toBe(0);
      const out = result.stdoutAndErr.sanitizedCompactLines;
      expect(out).toContain("✅ a: echo-script");
      expect(out).not.toContain("b: echo-script");
      expect(out).toContain("1 script ran successfully");
    });

    test("--ignore-external-deps suppresses lockfile-based external dep tracking", async () => {
      const { run } = setupCliTest({
        testProject: "withDependenciesWithExternal",
      });
      // Workspace 'a' has externals in this fixture and would be flagged via
      // the bun.lock heuristic without suppression
      const result = await run(
        "run-affected",
        "--script=does-not-exist",
        "--files",
        PROJECT_LOCKFILE_PATH,
        "--ignore-external-deps",
        "--parallel=false",
        "--output-style=plain",
      );
      expect(result.exitCode).toBe(0);
      expect(result.stdoutAndErr.sanitizedCompactLines).toContain(
        "0 scripts ran successfully",
      );
    });

    test("auto-derives script-level inputs from the script being run", async () => {
      const { run } = setupCliTest({ testProject: "affectedWithInputs" });
      // 'a' has scripts.echo-script.inputs.files=["src/**/*"] (the default
      // inputs); a build/ change should NOT match echo-script's inputs.
      const result = await run(
        "run-affected",
        "echo-script",
        "--files",
        "packages/a/build/out.js",
        "--ignore-workspace-deps",
        "--parallel=false",
        "--output-style=plain",
      );
      expect(result.exitCode).toBe(0);
      expect(result.stdoutAndErr.sanitizedCompactLines).toContain(
        "0 scripts ran successfully",
      );
    });
  });

  describe("--files vs git options conflict", () => {
    test("--files + --base errors", async () => {
      const { run } = setupCliTest({ testProject: "affectedWithInputs" });
      const result = await run(
        "run-affected",
        "echo-script",
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
        "run-affected",
        "echo-script",
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
    test("--base/--head selects the diff range and runs only affected", async () => {
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
      const { run } = setupCliTest({ workingDirectory: fixture.projectPath });
      const result = await run(
        "run-affected",
        "echo-script",
        "--base",
        "HEAD~1",
        "--head",
        "HEAD",
        "--ignore-uncommitted",
        "--parallel=false",
        "--output-style=plain",
      );
      expect(result.exitCode).toBe(0);
      const out = result.stdoutAndErr.sanitizedCompactLines;
      expect(out).toContain("✅ a: echo-script");
      expect(out).toContain("✅ b: echo-script");
    });

    test("-B/-H short forms work", async () => {
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
      const { run } = setupCliTest({ workingDirectory: fixture.projectPath });
      const result = await run(
        "run-affected",
        "echo-script",
        "-B",
        "HEAD~1",
        "-H",
        "HEAD",
        "--ignore-uncommitted",
        "--parallel=false",
        "--output-style=plain",
      );
      expect(result.exitCode).toBe(0);
      expect(result.stdoutAndErr.sanitizedCompactLines).toContain(
        "2 scripts ran successfully",
      );
    });

    test("--ignore-uncommitted excludes working-tree state", async () => {
      await using fixture = await createGitFixture({
        commits: [{ message: "init", files: TWO_WORKSPACE_PROJECT_FILES }],
        workingState: {
          modify: [{ path: "packages/a/src/index.ts", content: "x" }],
        },
        initialBranch: "main",
      });
      const { run } = setupCliTest({ workingDirectory: fixture.projectPath });
      const result = await run(
        "run-affected",
        "echo-script",
        "--base",
        "HEAD",
        "--head",
        "HEAD",
        "--ignore-uncommitted",
        "--parallel=false",
        "--output-style=plain",
      );
      expect(result.exitCode).toBe(0);
      expect(result.stdoutAndErr.sanitizedCompactLines).toContain(
        "0 scripts ran successfully",
      );
    });

    test("--ignore-untracked excludes untracked files", async () => {
      await using fixture = await createGitFixture({
        commits: [{ message: "init", files: TWO_WORKSPACE_PROJECT_FILES }],
        workingState: {
          modify: [{ path: "packages/a/src/new.ts", content: "x" }],
        },
        initialBranch: "main",
      });
      const { run } = setupCliTest({ workingDirectory: fixture.projectPath });
      const result = await run(
        "run-affected",
        "echo-script",
        "--base",
        "HEAD",
        "--head",
        "HEAD",
        "--ignore-untracked",
        "--parallel=false",
        "--output-style=plain",
      );
      expect(result.exitCode).toBe(0);
      expect(result.stdoutAndErr.sanitizedCompactLines).toContain(
        "0 scripts ran successfully",
      );
    });

    test("--ignore-staged excludes staged files", async () => {
      await using fixture = await createGitFixture({
        commits: [{ message: "init", files: TWO_WORKSPACE_PROJECT_FILES }],
        workingState: {
          stage: [{ path: "packages/a/src/index.ts", content: "1" }],
        },
        initialBranch: "main",
      });
      const { run } = setupCliTest({ workingDirectory: fixture.projectPath });
      const result = await run(
        "run-affected",
        "echo-script",
        "--base",
        "HEAD",
        "--head",
        "HEAD",
        "--ignore-staged",
        "--parallel=false",
        "--output-style=plain",
      );
      expect(result.exitCode).toBe(0);
      expect(result.stdoutAndErr.sanitizedCompactLines).toContain(
        "0 scripts ran successfully",
      );
    });

    test("--ignore-unstaged excludes unstaged files", async () => {
      await using fixture = await createGitFixture({
        commits: [{ message: "init", files: TWO_WORKSPACE_PROJECT_FILES }],
        workingState: {
          modify: [{ path: "packages/a/src/index.ts", content: "x" }],
        },
        initialBranch: "main",
      });
      const { run } = setupCliTest({ workingDirectory: fixture.projectPath });
      const result = await run(
        "run-affected",
        "echo-script",
        "--base",
        "HEAD",
        "--head",
        "HEAD",
        "--ignore-unstaged",
        "--ignore-untracked",
        "--parallel=false",
        "--output-style=plain",
      );
      expect(result.exitCode).toBe(0);
      expect(result.stdoutAndErr.sanitizedCompactLines).toContain(
        "0 scripts ran successfully",
      );
    });
  });

  describe("script-run option passthrough", () => {
    test("--args appends args to the script command (passthrough to inline)", async () => {
      const { run } = setupCliTest({ testProject: "affectedWithInputs" });
      const result = await run(
        "run-affected",
        "--inline",
        "echo with-arg",
        "--args=hello",
        "--files",
        "packages/a/src/index.ts",
        "--ignore-workspace-deps",
        "--parallel=false",
        "--output-style=plain",
      );
      expect(result.exitCode).toBe(0);
      // The inline command runs with the appended args
      expect(result.stdoutAndErr.sanitizedCompactLines).toContain(
        "with-arg hello",
      );
    });

    test("--inline runs an inline command across affected workspaces", async () => {
      const { run } = setupCliTest({ testProject: "affectedWithInputs" });
      const result = await run(
        "run-affected",
        "--inline",
        "echo inline-ok",
        "--files",
        "packages/a/src/index.ts",
        "--ignore-workspace-deps",
        "--parallel=false",
        "--output-style=plain",
      );
      expect(result.exitCode).toBe(0);
      const out = result.stdoutAndErr.sanitizedCompactLines;
      expect(out).toContain("inline-ok");
      expect(out).toContain("✅ a: (inline)");
    });

    test("--inline-name labels the inline run in the summary", async () => {
      const { run } = setupCliTest({ testProject: "affectedWithInputs" });
      const result = await run(
        "run-affected",
        "--inline",
        "echo named",
        "--inline-name=my-inline",
        "--files",
        "packages/a/src/index.ts",
        "--ignore-workspace-deps",
        "--parallel=false",
        "--output-style=plain",
      );
      expect(result.exitCode).toBe(0);
      expect(result.stdoutAndErr.sanitizedCompactLines).toContain(
        "✅ a: my-inline",
      );
    });

    test("--json-outfile writes the run summary to a file", async () => {
      // Use workingDirectory (not testProject) so the subprocess cwd
      // and the file we read back are the same path. setupCliTest's
      // testProject route goes through loadFixture, which
      // materializes into a tmpdir — the file would land there,
      // making the test's source-path read fail.
      const workingDirectory = getProjectRoot("affectedWithInputs");
      const { run } = setupCliTest({ workingDirectory });
      const outfile = `tests/test-output/run-affected-${Date.now()}.json`;
      const result = await run(
        "run-affected",
        "echo-script",
        "--files",
        "packages/a/src/index.ts",
        "--parallel=false",
        "--output-style=plain",
        `--json-outfile=${outfile}`,
      );
      expect(result.exitCode).toBe(0);
      const fullPath = path.join(workingDirectory, outfile);
      const written = fs.readFileSync(fullPath, "utf-8");
      const parsed = JSON.parse(written);
      expect(parsed).toHaveProperty("scriptResults");
      expect(parsed.totalCount).toBe(2);
      fs.rmSync(fullPath);
    });
  });
});
