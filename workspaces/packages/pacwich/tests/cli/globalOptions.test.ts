import fs from "fs";
import os from "os";
import path from "path";
import { getUserEnvVarName } from "@pacwich/common/config";
import { createFileSystemProject } from "../../src";
import { getProjectRoot } from "../fixtures/testProjects";
import {
  setupCliTest,
  assertOutputMatches,
  USAGE_OUTPUT_PATTERN,
} from "../util/cliTestUtils";
import { makeTestWorkspace } from "../util/testData";
import {
  test,
  expect,
  describe,
  beforeAll,
  afterAll,
} from "../util/testFramework";

describe("CLI Global Options", () => {
  describe("usage/help", () => {
    test("--help flag shows usage", async () => {
      const { run } = setupCliTest();
      const result = await run("--help");
      expect(result.stderr.raw).toBeEmpty();
      expect(result.exitCode).toBe(0);
      assertOutputMatches(result.stdout.raw, USAGE_OUTPUT_PATTERN);
    });

    test("help command shows usage", async () => {
      const { run } = setupCliTest();
      const result = await run("help");
      expect(result.stderr.raw).toBeEmpty();
      expect(result.exitCode).toBe(0);
      assertOutputMatches(result.stdout.raw, USAGE_OUTPUT_PATTERN);
    });

    test("empty command shows error with usage", async () => {
      const { run } = setupCliTest();
      const result = await run("");
      assertOutputMatches(
        result.stderr.sanitized,
        /^error: unknown command ''/,
      );
      expect(result.exitCode).toBe(1);
      assertOutputMatches(result.stderr.sanitized, USAGE_OUTPUT_PATTERN);
    });

    test("unknown command shows error with usage", async () => {
      const { run } = setupCliTest();
      const result = await run("something-very-wrong");
      assertOutputMatches(
        result.stderr.sanitized,
        /^error: unknown command 'something-very-wrong'/,
      );
      expect(result.exitCode).toBe(1);
      assertOutputMatches(result.stderr.sanitized, USAGE_OUTPUT_PATTERN);
    });

    test("help command works in invalid project", async () => {
      const { run } = setupCliTest({ testProject: "invalidDuplicateName" });
      const result = await run("help");
      expect(result.stderr.raw).toBeEmpty();
      expect(result.exitCode).toBe(0);
      assertOutputMatches(result.stdout.raw, USAGE_OUTPUT_PATTERN);
    });
  });

  describe("--log-level", () => {
    test("accepts silent level", async () => {
      const { run } = setupCliTest();
      const result = await run("--log-level=silent", "ls");
      expect(result.stderr.raw).toBeEmpty();
      expect(result.exitCode).toBe(0);
    });

    test("accepts debug level", async () => {
      const { run } = setupCliTest();
      const result = await run("--log-level=debug", "ls");
      expect(result.exitCode).toBe(0);
    });

    test("accepts info level", async () => {
      const { run } = setupCliTest();
      const result = await run("--log-level=info", "ls");
      expect(result.stderr.raw).toBeEmpty();
      expect(result.exitCode).toBe(0);
    });

    test("accepts warn level", async () => {
      const { run } = setupCliTest();
      const result = await run("--log-level=warn", "ls");
      expect(result.stderr.raw).toBeEmpty();
      expect(result.exitCode).toBe(0);
    });

    test("accepts error level", async () => {
      const { run } = setupCliTest();
      const result = await run("--log-level=error", "ls");
      expect(result.stderr.raw).toBeEmpty();
      expect(result.exitCode).toBe(0);
    });

    test("rejects invalid level", async () => {
      const { run } = setupCliTest();
      const result = await run("--log-level=wrong", "ls");
      expect(result.exitCode).toBe(1);
      assertOutputMatches(
        result.stderr.sanitized,
        /option.+--log-level.+wrong.+is invalid/,
      );
    });
  });

  describe("--cwd", () => {
    test("lists workspaces for simple1 project", async () => {
      const { run } = setupCliTest();
      const result = await run(
        `--cwd=${getProjectRoot("simple1")}`,
        "ls",
        "--name-only",
      );
      expect(result.stderr.raw).toBeEmpty();
      expect(result.exitCode).toBe(0);
      assertOutputMatches(
        result.stdout.raw,
        /application-1a\napplication-1b\nlibrary-1a\nlibrary-1b$/m,
      );
    });

    test("lists workspaces for simple2 project", async () => {
      const { run } = setupCliTest();
      const result = await run(
        `--cwd=${getProjectRoot("simple2")}`,
        "ls",
        "--name-only",
      );
      expect(result.stderr.raw).toBeEmpty();
      expect(result.exitCode).toBe(0);
      assertOutputMatches(
        result.stdout.raw,
        /application-2a\napplication-2b\nlibrary-2a\nlibrary-2b$/m,
      );
    });

    test("expands home path", async () => {
      const { run } = setupCliTest();
      const root = getProjectRoot("simple1");
      const result = await run(
        `--cwd=${root.replace(os.homedir(), "~")}`,
        "ls",
        "--name-only",
      );
      expect(result.stderr.raw).toBeEmpty();
      expect(result.exitCode).toBe(0);
      assertOutputMatches(
        result.stdout.raw,
        /application-1a\napplication-1b\nlibrary-1a\nlibrary-1b$/m,
      );
    });

    test("errors for nonexistent path", async () => {
      const { run } = setupCliTest();
      const result = await run("--cwd=does-not-exist", "ls");
      expect(result.stdout.raw).toBeEmpty();
      expect(result.exitCode).toBe(1);
      assertOutputMatches(
        result.stderr.sanitized,
        /Working directory not found at path "does-not-exist"/,
      );
    });

    test("errors for non-directory path", async () => {
      const { run } = setupCliTest();
      const notADirectoryPath = path.resolve(
        __dirname,
        "../fixtures/not-a-directory",
      );
      const result = await run(`--cwd=${notADirectoryPath}`, "ls");
      expect(result.stdout.raw).toBeEmpty();
      expect(result.exitCode).toBe(1);
      assertOutputMatches(
        result.stderr.sanitized,
        `Working directory is not a directory at path "${notADirectoryPath}"`,
      );
    });

    test("-d short form sets the working directory", async () => {
      const { run } = setupCliTest();
      const result = await run(
        "-d",
        getProjectRoot("simple1"),
        "ls",
        "--name-only",
      );
      expect(result.exitCode).toBe(0);
      expect(result.stderr.raw).toBeEmpty();
      assertOutputMatches(
        result.stdout.raw,
        /application-1a\napplication-1b\nlibrary-1a\nlibrary-1b$/m,
      );
    });

    test("space form (--cwd <path>) works alongside the = form", async () => {
      const { run } = setupCliTest();
      const result = await run(
        "--cwd",
        getProjectRoot("simple1"),
        "ls",
        "--name-only",
      );
      expect(result.exitCode).toBe(0);
      expect(result.stderr.raw).toBeEmpty();
      assertOutputMatches(
        result.stdout.raw,
        /application-1a\napplication-1b\nlibrary-1a\nlibrary-1b$/m,
      );
    });
  });

  describe("--include-root", () => {
    const expectedWorkspaces = [
      makeTestWorkspace({
        name: "application-1a",
        path: "applications/applicationA",
        matchPattern: "applications/*",
        scripts: ["a-workspaces", "all-workspaces", "application-a"],
      }),
      makeTestWorkspace({
        name: "application-1b",
        path: "applications/applicationB",
        matchPattern: "applications/*",
        scripts: ["all-workspaces", "application-b", "b-workspaces"],
      }),
      makeTestWorkspace({
        name: "library-1a",
        path: "libraries/libraryA",
        matchPattern: "libraries/*",
        scripts: ["a-workspaces", "all-workspaces", "library-a"],
      }),
      makeTestWorkspace({
        name: "library-1b",
        path: "libraries/libraryB",
        matchPattern: "libraries/*",
        scripts: ["all-workspaces", "b-workspaces", "library-b"],
      }),
    ];

    const rootWorkspace = makeTestWorkspace({
      name: "test-root",
      isRoot: true,
      path: "",
      matchPattern: "",
      scripts: ["all-workspaces", "root-workspace"],
      aliases: ["my-root-alias"],
    });

    const expectedWithConfigFiles = [
      makeTestWorkspace({
        name: "application-1a",
        path: "applications/applicationA",
        matchPattern: "applications/*",
        scripts: ["a-workspaces", "all-workspaces", "application-a"],
        aliases: ["appA"],
      }),
      makeTestWorkspace({
        name: "application-1b",
        path: "applications/applicationB",
        matchPattern: "applications/*",
        scripts: ["all-workspaces", "application-b", "b-workspaces"],
        aliases: ["appB"],
      }),
      makeTestWorkspace({
        name: "library-1a",
        path: "libraries/libraryA",
        matchPattern: "libraries/*",
        scripts: ["a-workspaces", "all-workspaces", "library-a"],
        aliases: ["libA"],
      }),
      makeTestWorkspace({
        name: "library-1b",
        path: "libraries/libraryB",
        matchPattern: "libraries/*",
        scripts: ["all-workspaces", "b-workspaces", "library-b"],
        aliases: ["libB"],
      }),
    ];

    const expectedWithRoot = [rootWorkspace, ...expectedWorkspaces];

    test("--include-root flag includes root workspace", async () => {
      const { run } = setupCliTest({ testProject: "withRootWorkspace" });
      const result = await run("--include-root", "ls", "--json");
      expect(result.stderr.raw).toBeEmpty();
      expect(result.exitCode).toBe(0);
      expect(JSON.parse(result.stdout.raw)).toEqual(expectedWithRoot);
    });

    test("-r shorthand includes root workspace", async () => {
      const { run } = setupCliTest({ testProject: "withRootWorkspace" });
      const result = await run("-r", "ls", "--json");
      expect(result.stderr.raw).toBeEmpty();
      expect(result.exitCode).toBe(0);
      expect(JSON.parse(result.stdout.raw)).toEqual(expectedWithRoot);
    });

    test("excludes root workspace by default", async () => {
      const { run } = setupCliTest({ testProject: "withRootWorkspace" });
      const result = await run("ls", "--json");
      expect(result.stderr.raw).toBeEmpty();
      expect(result.exitCode).toBe(0);
      expect(JSON.parse(result.stdout.raw)).toEqual(expectedWorkspaces);
    });

    test("env var includes root workspace", async () => {
      const { run } = setupCliTest({
        testProject: "withRootWorkspace",
        env: { [getUserEnvVarName("includeRootWorkspaceDefault")]: "true" },
      });
      const result = await run("ls", "--json");
      expect(result.stderr.raw).toBeEmpty();
      expect(result.exitCode).toBe(0);
      expect(JSON.parse(result.stdout.raw)).toEqual(expectedWithRoot);
    });

    test("--no-include-root overrides env var", async () => {
      const { run } = setupCliTest({
        testProject: "withRootWorkspace",
        env: { [getUserEnvVarName("includeRootWorkspaceDefault")]: "true" },
      });
      const result = await run("--no-include-root", "ls", "--json");
      expect(result.stderr.raw).toBeEmpty();
      expect(result.exitCode).toBe(0);
      expect(JSON.parse(result.stdout.raw)).toEqual(expectedWorkspaces);
    });

    test("--include-root then --no-include-root: last wins (excludes root)", async () => {
      const { run } = setupCliTest({ testProject: "withRootWorkspace" });
      const result = await run(
        "--include-root",
        "--no-include-root",
        "ls",
        "--json",
      );
      expect(result.stderr.raw).toBeEmpty();
      expect(result.exitCode).toBe(0);
      expect(JSON.parse(result.stdout.raw)).toEqual(expectedWorkspaces);
    });

    test("--no-include-root then --include-root: last wins (includes root)", async () => {
      const { run } = setupCliTest({ testProject: "withRootWorkspace" });
      const result = await run(
        "--no-include-root",
        "--include-root",
        "ls",
        "--json",
      );
      expect(result.stderr.raw).toBeEmpty();
      expect(result.exitCode).toBe(0);
      expect(JSON.parse(result.stdout.raw)).toEqual(expectedWithRoot);
    });

    test("env var false excludes root workspace", async () => {
      const { run } = setupCliTest({
        testProject: "withRootWorkspace",
        env: { [getUserEnvVarName("includeRootWorkspaceDefault")]: "false" },
      });
      const result = await run("ls", "--json");
      expect(result.stderr.raw).toBeEmpty();
      expect(result.exitCode).toBe(0);
      expect(JSON.parse(result.stdout.raw)).toEqual(expectedWorkspaces);
    });

    test("config file includes root workspace", async () => {
      const { run } = setupCliTest({
        testProject: "withRootWorkspaceWithConfigFiles",
      });

      const result = await run("ls", "--json");
      expect(result.stderr.raw).toBeEmpty();
      expect(result.exitCode).toBe(0);
      expect(JSON.parse(result.stdout.raw)).toEqual([
        rootWorkspace,
        ...expectedWithConfigFiles,
      ]);
    });

    test("--no-include-root overrides config file", async () => {
      const { run } = setupCliTest({
        testProject: "withRootWorkspaceWithConfigFiles",
      });

      const result = await run("--no-include-root", "ls", "--json");
      expect(result.stderr.raw).toBeEmpty();
      expect(result.exitCode).toBe(0);
      expect(JSON.parse(result.stdout.raw)).toEqual(expectedWithConfigFiles);
    });
  });

  describe("project root resolution", () => {
    test.each([
      ["."],
      ["applications"],
      ["applications/applicationA"],
      ["libraries"],
      ["libraries/libraryB"],
      ["node_modules/"],
    ])(
      "walks up to find the project root by default (cwd: %s)",
      async (workspacePath: string) => {
        const { run } = setupCliTest({
          workingDirectory: path.resolve(
            getProjectRoot("simple1"),
            workspacePath,
          ),
        });
        const result = await run("ls", "--json");
        expect(result.stderr.raw).toBeEmpty();
        expect(result.exitCode).toBe(0);
        expect(JSON.parse(result.stdout.raw)).toEqual(
          createFileSystemProject({
            rootDirectory: getProjectRoot("simple1"),
          }).workspaces,
        );
      },
    );

    test("falls back to cwd when no workspaces-field ancestor exists", async () => {
      // os.tmpdir() is guaranteed to have no workspaces-field
      // package.json anywhere from itself up to /, so the walk-up
      // can never escape to an unrelated monorepo.
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pacwich-noroot-"));
      try {
        const { run } = setupCliTest({ workingDirectory: tmpDir });
        const result = await run("ls", "--json");
        expect(result.stdout.raw).toBeEmpty();
        expect(result.exitCode).toBe(1);
        // Project-load failure should reference the cwd the user
        // ran from, proving the walk-up fell back rather than
        // silently jumping to some other dir.
        expect(result.stderr.sanitized).toContain(tmpDir);
      } finally {
        fs.rmSync(tmpDir, { force: true, recursive: true });
      }
    });

    test("does not escape a tmp dir that has a non-workspaces package.json", async () => {
      // Regression case: a plain package (no workspaces field). The
      // walk-up will pass through it looking for a workspaces-field
      // ancestor; without isolation it could find an unrelated one
      // higher up. Inside /tmp there is no such ancestor, so the
      // walk falls back to the tmp dir itself and the project-load
      // error surfaces there.
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pacwich-plain-"));
      try {
        fs.writeFileSync(
          path.join(tmpDir, "package.json"),
          JSON.stringify({ name: "plain-package", version: "1.0.0" }),
        );
        const { run } = setupCliTest({ workingDirectory: tmpDir });
        const result = await run("ls", "--json");
        expect(result.exitCode).toBe(1);
        expect(result.stderr.sanitized).toContain(tmpDir);
      } finally {
        fs.rmSync(tmpDir, { force: true, recursive: true });
      }
    });

    test("--workspace-root / -w is accepted but warns it is deprecated (now the default)", async () => {
      for (const flag of ["--workspace-root", "-w"]) {
        const { run } = setupCliTest();
        const result = await run(flag, "ls");
        expect(result.exitCode).toBe(0);
        assertOutputMatches(
          result.stderr.sanitized,
          new RegExp(`The ${flag} flag from bun-workspaces is deprecated`),
        );
      }
    });
  });

  describe("--disable-executable-configs", () => {
    const findAlias = (
      workspaces: { name: string; aliases: string[] }[],
      name: string,
    ) => workspaces.find((w) => w.name === name)?.aliases ?? [];

    test("without the flag, pacwich.workspace.ts wins precedence (appA-ts alias)", async () => {
      const { run } = setupCliTest({
        testProject: "workspaceConfigTsPrecedence",
      });
      const result = await run("ls", "--json");
      expect(result.exitCode).toBe(0);
      const workspaces = JSON.parse(result.stdout.raw);
      expect(findAlias(workspaces, "application-1a")).toContain("appA-ts");
    });

    test("with the flag, pacwich.workspace.ts is skipped (jsonc alias wins)", async () => {
      const { run } = setupCliTest({
        testProject: "workspaceConfigTsPrecedence",
      });
      const result = await run("--disable-executable-configs", "ls", "--json");
      expect(result.exitCode).toBe(0);
      const workspaces = JSON.parse(result.stdout.raw);
      const aliases = findAlias(workspaces, "application-1a");
      expect(aliases).toContain("appA-jsonc");
      expect(aliases).not.toContain("appA-ts");
      expect(aliases).not.toContain("appA-js");
    });

    test("--no-disable-executable-configs explicitly re-enables (no-op default)", async () => {
      const { run } = setupCliTest({
        testProject: "workspaceConfigTsPrecedence",
      });
      const result = await run(
        "--no-disable-executable-configs",
        "ls",
        "--json",
      );
      expect(result.exitCode).toBe(0);
      const workspaces = JSON.parse(result.stdout.raw);
      expect(findAlias(workspaces, "application-1a")).toContain("appA-ts");
    });

    test("PACWICH_DISABLE_EXECUTABLE_CONFIGS_DEFAULT=true skips pacwich.workspace.ts", async () => {
      const { run } = setupCliTest({
        testProject: "workspaceConfigTsPrecedence",
        env: {
          [getUserEnvVarName("disableExecutableConfigsDefault")]: "true",
        },
      });
      const result = await run("ls", "--json");
      expect(result.exitCode).toBe(0);
      const workspaces = JSON.parse(result.stdout.raw);
      const aliases = findAlias(workspaces, "application-1a");
      expect(aliases).toContain("appA-jsonc");
      expect(aliases).not.toContain("appA-ts");
    });

    test("PACWICH_DISABLE_EXECUTABLE_CONFIGS_DEFAULT=false honors pacwich.workspace.ts", async () => {
      const { run } = setupCliTest({
        testProject: "workspaceConfigTsPrecedence",
        env: {
          [getUserEnvVarName("disableExecutableConfigsDefault")]: "false",
        },
      });
      const result = await run("ls", "--json");
      expect(result.exitCode).toBe(0);
      const workspaces = JSON.parse(result.stdout.raw);
      expect(findAlias(workspaces, "application-1a")).toContain("appA-ts");
    });

    test("--no-disable-executable-configs CLI flag overrides env var", async () => {
      const { run } = setupCliTest({
        testProject: "workspaceConfigTsPrecedence",
        env: {
          [getUserEnvVarName("disableExecutableConfigsDefault")]: "true",
        },
      });
      const result = await run(
        "--no-disable-executable-configs",
        "ls",
        "--json",
      );
      expect(result.exitCode).toBe(0);
      const workspaces = JSON.parse(result.stdout.raw);
      expect(findAlias(workspaces, "application-1a")).toContain("appA-ts");
    });
  });

  describe("--pm", () => {
    test("accepts --pm bun on a bun-lockfile project (succeeds)", async () => {
      const { run } = setupCliTest();
      const result = await run("--pm", "bun", "ls", "--json");
      expect(result.exitCode).toBe(0);
      const workspaces = JSON.parse(result.stdout.raw);
      expect(Array.isArray(workspaces)).toBe(true);
    });

    test("accepts --pm auto (probes lockfile)", async () => {
      const { run } = setupCliTest();
      const result = await run("--pm", "auto", "ls", "--json");
      expect(result.exitCode).toBe(0);
    });

    test("accepts --pm=bun (= form) alongside the space form", async () => {
      const { run } = setupCliTest();
      const result = await run("--pm=bun", "ls", "--json");
      expect(result.exitCode).toBe(0);
      const workspaces = JSON.parse(result.stdout.raw);
      expect(Array.isArray(workspaces)).toBe(true);
    });

    test("--pm npm on a bun-only project exits non-zero with the npm-specific missing-lockfile error", async () => {
      // The default test project ships a bun.lock but no
      // package-lock.json. Selecting npm via --pm routes through the
      // npm adapter, which surfaces NpmLockNotFound — the message is
      // the signal that npm (not bun) was the active backend.
      const { run } = setupCliTest();
      const result = await run("--pm", "npm", "ls");
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr.sanitized).toMatch(/No package-lock\.json found/);
    });

    test("--pm yarn is rejected by commander (choices enforcement)", async () => {
      const { run } = setupCliTest();
      const result = await run("--pm", "yarn", "ls");
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr.sanitized).toMatch(
        /Allowed choices are .*bun.* npm/,
      );
    });

    test("--pm bun overrides a project that pins packageManager: 'npm' in root config", async () => {
      const { run } = setupCliTest({
        testProject: "projectConfigPackageManagerNpm",
      });
      const result = await run("--pm", "bun", "ls", "--json");
      expect(result.exitCode).toBe(0);
      const workspaces = JSON.parse(result.stdout.raw);
      expect(workspaces.map((w: { name: string }) => w.name)).toContain(
        "workspace-a",
      );
    });

    test("without --pm, the npm-pinned config drives selection (surfaces npm-specific lockfile error)", async () => {
      const { run } = setupCliTest({
        testProject: "projectConfigPackageManagerNpm",
      });
      const result = await run("ls");
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr.sanitized).toMatch(/No package-lock\.json found/);
    });

    test("PACWICH_PACKAGE_MANAGER env var alone selects the backend on a bun project", async () => {
      const { run } = setupCliTest({
        env: { [getUserEnvVarName("packageManager")]: "bun" },
      });
      const result = await run("ls", "--json");
      expect(result.exitCode).toBe(0);
    });

    test("--pm overrides PACWICH_PACKAGE_MANAGER env var", async () => {
      const { run } = setupCliTest({
        env: { [getUserEnvVarName("packageManager")]: "npm" },
      });
      const result = await run("--pm", "bun", "ls", "--json");
      expect(result.exitCode).toBe(0);
    });
  });

  // A global command (completion, doctor, ...) never operates on a
  // project, so the CLI must not eagerly assemble one. Assembling a
  // workspaceless project emits a "No workspaces declared" hint, which
  // is precisely the noise that must not leak into e.g.
  // `eval "$(pacwich completion zsh)"`.
  describe("global commands do not load the project", () => {
    const NO_WORKSPACES_HINT = /No workspaces declared/;

    // A valid-but-workspaceless project: a parseable bun.lock (so
    // assembly succeeds) plus a package.json with no "workspaces" field
    // (so the hint fires when a project IS loaded).
    let workspacelessDir: string;

    beforeAll(() => {
      workspacelessDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "pacwich-noworkspaces-"),
      );
      fs.writeFileSync(
        path.join(workspacelessDir, "package.json"),
        JSON.stringify({ name: "no-workspaces-field" }),
      );
      fs.writeFileSync(
        path.join(workspacelessDir, "bun.lock"),
        JSON.stringify({
          lockfileVersion: 1,
          configVersion: 1,
          workspaces: { "": { name: "no-workspaces-field" } },
          packages: {},
        }),
      );
    });

    afterAll(() => {
      fs.rmSync(workspacelessDir, { force: true, recursive: true });
    });

    test("a project command surfaces the no-workspaces hint (control)", async () => {
      const { run } = setupCliTest({ workingDirectory: workspacelessDir });
      const result = await run("ls", "--name-only");
      expect(result.exitCode).toBe(0);
      assertOutputMatches(result.stderr.sanitized, NO_WORKSPACES_HINT);
    });

    test("completion <shell> prints the script with no log output", async () => {
      const { run } = setupCliTest({ workingDirectory: workspacelessDir });
      const result = await run("completion", "zsh");
      expect(result.exitCode).toBe(0);
      expect(result.stderr.raw).toBeEmpty();
      expect(result.stdout.raw.length).toBeGreaterThan(0);
    });

    test("doctor produces no log output", async () => {
      const { run } = setupCliTest({ workingDirectory: workspacelessDir });
      const result = await run("doctor");
      expect(result.exitCode).toBe(0);
      expect(result.stderr.raw).toBeEmpty();
    });

    test("global options before the command still skip project loading", async () => {
      const { run } = setupCliTest({ workingDirectory: workspacelessDir });
      const result = await run("--log-level", "info", "completion", "zsh");
      expect(result.exitCode).toBe(0);
      expect(result.stderr.raw).toBeEmpty();
    });

    test("--cwd targeting the workspaceless project still stays silent for a global command", async () => {
      const { run } = setupCliTest();
      const result = await run(`--cwd=${workspacelessDir}`, "doctor");
      expect(result.exitCode).toBe(0);
      expect(result.stderr.raw).toBeEmpty();
    });
  });
});
