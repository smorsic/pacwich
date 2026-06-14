import { getProjectRoot } from "../../../fixtures/testProjects";
import { assertOutputMatches, setupCliTest } from "../../../util/cliTestUtils";
import { describe, expect, test } from "../../../util/testFramework";
import { withWindowsPath } from "../../../util/windows";

/**
 * Bun-specific CLI error rendering for the missing-lockfile path.
 *
 * When a user runs pacwich against a project with no lockfile and no
 * explicit --pm pin, auto-detection has nothing to latch onto and
 * fails with a PM-agnostic "Could not auto-detect" message — this is
 * the first-contact error users will see, so it gets a dedicated
 * assertion.
 *
 * When the user pins --pm bun explicitly, the bun adapter's own
 * NpmLockNotFound-equivalent (BunLockNotFound) surfaces instead. That
 * path is covered in a separate test so a regression in either layer
 * is caught.
 *
 * PM-agnostic command success paths live under tests/cli/commands/.
 */

const FIXTURE_ROOT = withWindowsPath(getProjectRoot("emptyWorkspaces"));

describe("CLI commands — missing-lockfile error rendering (bun-side)", () => {
  describe("auto-detect failure (no --pm pin, no lockfile)", () => {
    const AUTO_DETECT_FAILED_FRAGMENT = `Could not auto-detect a package manager at ${FIXTURE_ROOT}`;

    test.each(["ls-scripts", "ls", "list-tags"] as const)(
      "%s exits 1 with the auto-detect-failure message",
      async (command) => {
        const { run } = setupCliTest({ testProject: "emptyWorkspaces" });
        const result = await run(command);
        expect(result.stdout.raw).toBeEmpty();
        expect(result.exitCode).toBe(1);
        expect(result.stderr.sanitizedCompactLines).toInclude(
          AUTO_DETECT_FAILED_FRAGMENT,
        );
        // Message must also guide users to fix it.
        expect(result.stderr.sanitizedCompactLines).toInclude("bun install");
        expect(result.stderr.sanitizedCompactLines).toInclude("npm install");
        expect(result.stderr.sanitizedCompactLines).toInclude("--pm");
      },
    );
  });

  describe("--pm bun on a lockfile-less project surfaces BunLockNotFound", () => {
    const MISSING_BUN_LOCK_MESSAGE =
      `No bun.lock found at ${FIXTURE_ROOT}. Check that this is the directory of your project and that you've ran 'bun install'. ` +
      "If you have ran 'bun install', you may simply have no workspaces or dependencies in your project.";

    test.each(["ls-scripts", "ls", "list-tags"] as const)(
      "%s exits 1 with the missing-bun.lock message",
      async (command) => {
        const { run } = setupCliTest({ testProject: "emptyWorkspaces" });
        const result = await run("--pm", "bun", command);
        expect(result.stdout.raw).toBeEmpty();
        expect(result.exitCode).toBe(1);
        assertOutputMatches(
          result.stderr.sanitizedCompactLines,
          MISSING_BUN_LOCK_MESSAGE,
        );
      },
    );
  });
});
