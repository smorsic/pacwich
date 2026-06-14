import fs from "fs";
import os from "os";
import path from "path";
import { assertOutputMatches, setupCliTest } from "../../../util/cliTestUtils";
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  test,
} from "../../../util/testFramework";
import { withWindowsPath } from "../../../util/windows";

/**
 * npm-specific CLI error rendering for the missing-lockfile path.
 * The npm adapter's `discoverWorkspacePaths` throws `NpmLockNotFound`
 * when no `package-lock.json` exists in the project root; this
 * asserts the human-facing rendering of that error.
 *
 * Uses a tmpdir-built fixture (with a `package.json.workspaces`
 * field but no lockfile and no `_pm/` marker) instead of materializing
 * an existing testProjects fixture, because the existing fixtures
 * either ship a bun.lock (incompatible) or use `_pm/` overlays that
 * setupTests skips installing.
 */
describe("CLI commands — missing package-lock.json error rendering", () => {
  let fixtureDir: string;

  beforeAll(() => {
    // Realpath the tmpdir so the fixture path matches what the spawned
    // CLI sees via process.cwd(). On macOS, /var/folders/... resolves
    // through /private/var/folders/... when the child inherits cwd
    // through getcwd(3), and the regex below would otherwise miss.
    fixtureDir = fs.realpathSync(
      fs.mkdtempSync(path.join(os.tmpdir(), "pacwich-npm-missing-")),
    );
    fs.writeFileSync(
      path.join(fixtureDir, "package.json"),
      JSON.stringify({ name: "missing-lock-root", workspaces: [] }),
    );
  });

  afterAll(() => {
    fs.rmSync(fixtureDir, { force: true, recursive: true });
  });

  test.each(["ls-scripts", "ls", "list-tags"] as const)(
    "%s exits 1 with the missing-package-lock message under --pm npm",
    async (command) => {
      const { run } = setupCliTest({ workingDirectory: fixtureDir });
      const result = await run("--pm", "npm", command);
      expect(result.stdout.raw).toBeEmpty();
      expect(result.exitCode).toBe(1);
      const expectedMessage =
        `No package-lock.json found at ${withWindowsPath(fixtureDir)}.` +
        " Check that this is the directory of your project and that you've run 'npm install'." +
        " If you have run 'npm install', you may simply have no workspaces or dependencies in your project.";
      assertOutputMatches(result.stderr.sanitizedCompactLines, expectedMessage);
    },
  );
});
