#!/usr/bin/env bun
/**
 * One-off helper: generate `_pm/pnpm/` overlays for each test
 * project that already has an `_pm/` directory.
 *
 * For each fixture:
 *  1. Copy the base (non-_pm) contents to a temp dir.
 *  2. Synthesize a `pnpm-workspace.yaml` from `package.json.workspaces`.
 *  3. Run `pnpm install --lockfile-only --ignore-scripts` (uses the
 *     network for external deps; the fixtures with no externals only
 *     need workspace linking).
 *  4. Copy `pnpm-workspace.yaml` and `pnpm-lock.yaml` to
 *     `<fixture>/_pm/pnpm/`.
 *
 * Idempotent: skips fixtures that already have an `_pm/pnpm/` overlay
 * (delete it manually to regenerate). Stops on the first failure with
 * a clear log.
 */
import { execSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import {
  formatPnpmWorkspaceYaml,
  readWorkspacePackages,
} from "@pacwich/meta/util";

const FIXTURES_ROOT = path.resolve(
  __dirname,
  "..",
  "tests",
  "fixtures",
  "testProjects",
);

const findFixturesWithPmOverlay = (root: string): string[] => {
  const found: string[] = [];
  const walk = (dir: string) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    if (entries.some((entry) => entry.isDirectory() && entry.name === "_pm")) {
      found.push(dir);
      return;
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name === "node_modules") continue;
      walk(path.join(dir, entry.name));
    }
  };
  walk(root);
  return found;
};

const copyDir = (from: string, to: string) => {
  fs.cpSync(from, to, { recursive: true, force: true });
};

const generateForFixture = (fixtureDir: string) => {
  const overlayDir = path.join(fixtureDir, "_pm", "pnpm");
  if (fs.existsSync(overlayDir)) {
    console.log(
      `[skip] ${path.relative(FIXTURES_ROOT, fixtureDir)} (already has _pm/pnpm/)`,
    );
    return;
  }

  const pkgPath = path.join(fixtureDir, "package.json");
  if (!fs.existsSync(pkgPath)) {
    console.log(
      `[skip] ${path.relative(FIXTURES_ROOT, fixtureDir)} (no package.json)`,
    );
    return;
  }

  const pkgJson = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  const globs = readWorkspacePackages(pkgJson);

  // Build a temp working copy of the fixture without `_pm/` and `node_modules/`.
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pacwich-pnpm-fixture-"));
  try {
    for (const entry of fs.readdirSync(fixtureDir, { withFileTypes: true })) {
      if (entry.name === "_pm") continue;
      if (entry.name === "node_modules") continue;
      if (entry.name === "bun.lock") continue;
      copyDir(path.join(fixtureDir, entry.name), path.join(tmp, entry.name));
    }

    const workspaceYaml = formatPnpmWorkspaceYaml({ packages: globs });
    fs.writeFileSync(path.join(tmp, "pnpm-workspace.yaml"), workspaceYaml);

    // Run pnpm install to produce the lockfile. Use --lockfile-only and
    // --ignore-scripts to avoid running any postinstall code from fixtures.
    try {
      execSync(
        "pnpm install --lockfile-only --ignore-scripts --no-frozen-lockfile",
        {
          cwd: tmp,
          stdio: ["ignore", "pipe", "pipe"],
        },
      );
    } catch (e) {
      console.error(
        `[FAIL] ${path.relative(FIXTURES_ROOT, fixtureDir)} pnpm install failed:`,
      );
      console.error((e as any).stderr?.toString() ?? (e as Error).message);
      throw e;
    }

    fs.mkdirSync(overlayDir, { recursive: true });
    fs.copyFileSync(
      path.join(tmp, "pnpm-workspace.yaml"),
      path.join(overlayDir, "pnpm-workspace.yaml"),
    );
    const lockSrc = path.join(tmp, "pnpm-lock.yaml");
    if (fs.existsSync(lockSrc)) {
      fs.copyFileSync(lockSrc, path.join(overlayDir, "pnpm-lock.yaml"));
    } else {
      console.warn(`[warn] no pnpm-lock.yaml produced for ${fixtureDir}`);
    }
    console.log(`[done] ${path.relative(FIXTURES_ROOT, fixtureDir)}`);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
};

const main = () => {
  const fixtures = findFixturesWithPmOverlay(FIXTURES_ROOT);
  for (const fixture of fixtures) {
    generateForFixture(fixture);
  }
};

main();
