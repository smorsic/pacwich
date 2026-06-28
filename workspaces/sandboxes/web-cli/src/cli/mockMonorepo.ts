/**
 * Seeds the shared memfs volume with a small mock npm monorepo that the
 * pacwich CLI can read like a real project on disk.
 *
 * pacwich's npm adapter discovers workspaces from `package-lock.json`'s
 * `packages` map (every non-empty, non-`node_modules/` key), so the lockfile
 * is the source of truth for which directories are workspaces. Each workspace
 * still needs its own `package.json` for name/scripts/deps.
 */
import { vol } from "memfs";

export const PROJECT_ROOT = "/project";

const json = (value: unknown) => JSON.stringify(value, null, 2);

const rootPackageJson = {
  name: "demo-monorepo",
  private: true,
  version: "1.0.0",
  workspaces: ["packages/*", "apps/*"],
};

const workspaces = {
  "packages/utils": {
    name: "@demo/utils",
    version: "1.0.0",
    scripts: { build: "tsc", lint: "eslint .", test: "vitest" },
  },
  "packages/core": {
    name: "@demo/core",
    version: "1.0.0",
    scripts: { build: "tsc", lint: "eslint ." },
    dependencies: { "@demo/utils": "*" },
  },
  "apps/web": {
    name: "@demo/web",
    version: "1.0.0",
    scripts: { build: "rsbuild build", dev: "rsbuild dev", lint: "eslint ." },
    dependencies: { "@demo/core": "*", "@demo/utils": "*" },
  },
} satisfies Record<string, { name: string } & Record<string, unknown>>;

/**
 * A minimal v3 `package-lock.json`. The `packages` map lists the root (`""`),
 * each workspace directory, and the hoisted workspace symlinks under
 * `node_modules/` (`link: true`) so dependency edges resolve.
 */
const packageLock = {
  name: rootPackageJson.name,
  version: rootPackageJson.version,
  lockfileVersion: 3,
  requires: true,
  packages: {
    "": {
      name: rootPackageJson.name,
      version: rootPackageJson.version,
      workspaces: rootPackageJson.workspaces,
    },
    ...Object.fromEntries(
      Object.entries(workspaces).map(([path, pkg]) => [
        path,
        { name: pkg.name, version: pkg.version },
      ]),
    ),
    ...Object.fromEntries(
      Object.values(workspaces).map((pkg) => [
        `node_modules/${pkg.name}`,
        { resolved: pkg.name, link: true },
      ]),
    ),
  },
};

/** Build the flat file map seeded into memfs (paths relative to root). */
const buildFileMap = (): Record<string, string> => {
  const files: Record<string, string> = {
    [`${PROJECT_ROOT}/package.json`]: json(rootPackageJson),
    [`${PROJECT_ROOT}/package-lock.json`]: json(packageLock),
  };
  for (const [path, pkg] of Object.entries(workspaces)) {
    files[`${PROJECT_ROOT}/${path}/package.json`] = json(pkg);
  }
  return files;
};

let seeded = false;

/** Write the mock monorepo into the memfs volume (idempotent). */
export const seedMockMonorepo = () => {
  if (seeded) return;
  vol.fromJSON(buildFileMap());
  seeded = true;
};
