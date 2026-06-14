/* eslint-disable no-console */
import fs from "fs";
import path from "path";
import { setLogLevel } from "./src";
import { runScript } from "./src/runScript";

const TEST_PROJECTS_DIR = path.join(
  __dirname,
  "tests",
  "fixtures",
  "testProjects",
);

/**
 * Conditions under which a fixture's deps are considered already
 * provided and `bun install` should NOT be run during global setup. Any
 * one match skips install.
 *
 * - `bun.lock`: legacy pre-pinned fixture layout (lockfile at the root).
 * - `_pm/`: backend-overlay fixture layout — PM-specific state lives
 *   under `_pm/<backend>/` and is loaded via `tests/util/fixtures.ts`,
 *   so global setup would otherwise overwrite the curated overlay.
 * - `.expect-bun-install-fail`: fixtures that intentionally exercise
 *   install-failure paths.
 */
const SKIP_INSTALL_MARKERS = [
  "bun.lock",
  "_pm",
  ".expect-bun-install-fail",
] as const;

const shouldSkipInstall = (fixtureDir: string): boolean =>
  SKIP_INSTALL_MARKERS.some((marker) =>
    fs.existsSync(path.join(fixtureDir, marker)),
  );

const readPackageJson = (packageJsonPath: string): object | null => {
  try {
    return JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
  } catch {
    return null;
  }
};

const hasWorkspacesField = (packageJson: object): boolean =>
  Boolean((packageJson as { workspaces?: unknown }).workspaces);

const installFixtureDependencies = async (
  packageJsonPath: string,
): Promise<void> => {
  try {
    const { exit, output } = runScript({
      env: {},
      metadata: {},
      scriptCommand: {
        command: "bun install",
        workingDirectory: path.dirname(packageJsonPath),
      },
    });
    let stderr = "";
    for await (const { metadata, chunk } of output.text()) {
      if (metadata.streamName === "stderr") {
        stderr += chunk;
      }
    }
    if (!(await exit).success) {
      console.error(
        `setupTests: Failed to run bun-install for ${packageJsonPath}: ${stderr}`,
      );
    }
  } catch (error) {
    console.error(
      `setupTests: Error installing dependencies for ${packageJsonPath}:`,
      error,
    );
  }
};

const findFixturesNeedingInstall = async (): Promise<string[]> => {
  const packageJsonPaths: string[] = [];

  for await (const relativePath of fs.promises.glob("**/*/package.json", {
    cwd: TEST_PROJECTS_DIR,
  })) {
    const absolute = path.join(TEST_PROJECTS_DIR, relativePath);
    if (shouldSkipInstall(path.dirname(absolute))) continue;

    const packageJson = readPackageJson(absolute);
    if (!packageJson || !hasWorkspacesField(packageJson)) continue;

    packageJsonPaths.push(absolute);
  }

  return packageJsonPaths;
};

/**
 * Hydrate the source-tree `bun.lock` for every fixture that ships a
 * `_pm/bun/bun.lock` overlay, and ensure an empty `node_modules/`
 * exists at the fixture root.
 *
 * Source-path-based tests (those calling `getProjectRoot(name)` and
 * pointing pacwich at the source directly) need a lockfile at the
 * root for auto-detect to find. They also occasionally cd into
 * `<fixture>/node_modules/` to exercise the default walk-up project
 * root search — the dir just needs to exist. Both are artifacts that
 * `bun install` used to produce; with the overlay layout, install
 * is skipped, so we recreate them here from the curated overlay
 * source of truth (lockfile) plus a stub node_modules.
 */
const hydrateBunLockOverlays = async (): Promise<void> => {
  for await (const overlayRel of fs.promises.glob("**/_pm/bun/bun.lock", {
    cwd: TEST_PROJECTS_DIR,
  })) {
    const overlayAbs = path.join(TEST_PROJECTS_DIR, overlayRel);
    // `<fixture>/_pm/bun/bun.lock` → fixture root is three dirs up.
    const fixtureRoot = path.dirname(path.dirname(path.dirname(overlayAbs)));
    fs.copyFileSync(overlayAbs, path.join(fixtureRoot, "bun.lock"));
    fs.mkdirSync(path.join(fixtureRoot, "node_modules"), { recursive: true });
  }
};

export default async () => {
  setLogLevel("silent");

  await hydrateBunLockOverlays();

  const packageJsonPaths = await findFixturesNeedingInstall();
  if (packageJsonPaths.length === 0) return;

  await Promise.all(packageJsonPaths.map(installFixtureDependencies));
};
