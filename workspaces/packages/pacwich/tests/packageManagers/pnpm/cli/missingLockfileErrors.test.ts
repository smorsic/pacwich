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
 * pnpm-specific CLI error rendering for the missing-lockfile path.
 * The pnpm adapter's `discoverWorkspacePaths` throws `PnpmLockNotFound`
 * when no `pnpm-lock.yaml` exists in the project root; this asserts
 * the human-facing rendering of that error.
 *
 * Uses a tmpdir-built fixture with an empty `pnpm-workspace.yaml`
 * (so `loadRootMetadata` succeeds) and no lockfile, instead of
 * materializing an existing testProjects fixture that ships its own
 * lockfile overlay.
 */
describe("CLI commands — missing pnpm-lock.yaml error rendering", () => {
  let fixtureDir: string;

  beforeAll(() => {
    // Realpath the tmpdir so the fixture path matches what the spawned
    // CLI sees via process.cwd(). On macOS, /var/folders/... resolves
    // through /private/var/folders/... when the child inherits cwd
    // through getcwd(3), and the regex below would otherwise miss.
    fixtureDir = fs.realpathSync(
      fs.mkdtempSync(path.join(os.tmpdir(), "pacwich-pnpm-missing-")),
    );
    fs.writeFileSync(
      path.join(fixtureDir, "package.json"),
      JSON.stringify({ name: "missing-lock-root" }),
    );
    fs.writeFileSync(
      path.join(fixtureDir, "pnpm-workspace.yaml"),
      "packages: []\n",
    );
  });

  afterAll(() => {
    fs.rmSync(fixtureDir, { force: true, recursive: true });
  });

  test.each(["ls-scripts", "ls", "list-tags"] as const)(
    "%s exits 1 with the missing-pnpm-lock message under --pm pnpm",
    async (command) => {
      const { run } = setupCliTest({ workingDirectory: fixtureDir });
      const result = await run("--pm", "pnpm", command);
      expect(result.stdout.raw).toBeEmpty();
      expect(result.exitCode).toBe(1);
      const expectedMessage =
        `No pnpm-lock.yaml found at ${withWindowsPath(fixtureDir)}.` +
        " Check that this is the directory of your project and that you've run 'pnpm install'." +
        " If you have run 'pnpm install', you may simply have no workspaces or dependencies in your project.";
      assertOutputMatches(result.stderr.sanitizedCompactLines, expectedMessage);
    },
  );
});
