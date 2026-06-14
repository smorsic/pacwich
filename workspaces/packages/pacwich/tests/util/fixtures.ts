import fs from "fs";
import os from "os";
import path from "path";
import type { PackageManagerName } from "../../src";
import { getProjectRoot, type TestProjectName } from "../fixtures/testProjects";
import { DEFAULT_PM_ID } from "./pms";
import { withWindowsPath } from "./windows";

/**
 * Per-pm overlay directory name within a fixture. A fixture is
 * migrated to the overlay shape by moving its pm-specific files
 * (e.g. `bun.lock`) into `<fixture>/_pm/<pm>/...`. Fixtures without
 * an overlay are returned as-is — see {@link loadFixture}.
 */
export const PM_OVERLAY_DIR = "_pm";

export type LoadFixtureOptions = {
  /**
   * Active pm. Defaults to {@link DEFAULT_PM_ID}.
   * Accepts any registered {@link PackageManagerName} (matrix iterators
   * surface ids typed as the wider PackageManagerName, not the narrow
   * literal of currently-registered fixtures, so widen here to keep
   * those call sites assignable).
   */
  pm?: PackageManagerName;
};

/**
 * Resolve a fixture path for the given pm. If the fixture has an
 * `_pm/<pm>/` overlay, the skeleton is materialized into a tmpdir
 * with the overlay layered on top and the tmpdir path is returned.
 * Otherwise the fixture's source path is returned unchanged (lazy
 * migration — un-migrated fixtures keep working).
 *
 * Materialized fixtures are cached per process and per `(name, pm)`
 * tuple, so repeated calls within a test run reuse the same directory.
 * The cache lives under the OS tmpdir keyed by PID; cleanup happens via
 * normal tmpdir reaping.
 */
export const loadFixture = (
  name: TestProjectName,
  { pm = DEFAULT_PM_ID }: LoadFixtureOptions = {},
): string => {
  const cacheKey = `${name}::${pm}`;
  const cached = MATERIALIZED_CACHE.get(cacheKey);
  if (cached) return cached;

  const source = getProjectRoot(name);
  const overlayDir = path.join(source, PM_OVERLAY_DIR, pm);

  if (!fs.existsSync(overlayDir)) {
    MATERIALIZED_CACHE.set(cacheKey, source);
    return source;
  }

  const target = materializeFixture({ name, pm, source, overlayDir });
  MATERIALIZED_CACHE.set(cacheKey, target);
  return target;
};

const MATERIALIZED_CACHE = new Map<string, string>();

const TEMP_ROOT = path.join(
  os.tmpdir(),
  "pacwich-test-fixtures",
  `pid-${process.pid}`,
);

type MaterializeOptions = {
  name: TestProjectName;
  pm: PackageManagerName;
  source: string;
  overlayDir: string;
};

const materializeFixture = ({
  name,
  pm,
  source,
  overlayDir,
}: MaterializeOptions): string => {
  const safeName = name.replace(/[^a-zA-Z0-9_-]/g, "_");
  const target = path.join(TEMP_ROOT, `${safeName}__${pm}`);

  fs.rmSync(target, { recursive: true, force: true });
  fs.mkdirSync(target, { recursive: true });

  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    if (entry.name === PM_OVERLAY_DIR) continue;
    // Skip the source-root bun.lock — it's hydrated by setupTests
    // from the _pm/bun/ overlay for the benefit of source-path-using
    // tests, but is NOT the curated lockfile for any PM. Including
    // it here would leave both bun.lock and the npm overlay's
    // package-lock.json present after materialization, which trips
    // pacwich's auto-detect ambiguity warning. The _pm/<pm>/ overlay
    // is the single source of truth per backend.
    if (entry.name === "bun.lock") continue;
    fs.cpSync(path.join(source, entry.name), path.join(target, entry.name), {
      recursive: true,
      verbatimSymlinks: true,
    });
  }

  for (const entry of fs.readdirSync(overlayDir, { withFileTypes: true })) {
    fs.cpSync(
      path.join(overlayDir, entry.name),
      path.join(target, entry.name),
      {
        recursive: true,
        verbatimSymlinks: true,
        force: true,
      },
    );
  }

  return withWindowsPath(target);
};
