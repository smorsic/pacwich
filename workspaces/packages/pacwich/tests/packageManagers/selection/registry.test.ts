import {
  PACKAGE_MANAGER_NAMES,
  PACKAGE_MANAGER_VALUES,
  resolvePackageManagerAdapter,
  type PackageManagerName,
} from "../../../src/packageManager/adapter";
import { NPM_ERRORS } from "../../../src/packageManager/backends/npm";
import { PNPM_ERRORS } from "../../../src/packageManager/backends/pnpm";
import { describe, expect, test } from "../../util/testFramework";

/**
 * Verifies the adapter registry surfaces every shipped backend with
 * the right adapter shape. Per-backend behavior (lockfile parsing,
 * script command construction, etc.) is tested under
 * tests/packageManagers/<pm>/.
 */
describe("resolvePackageManagerAdapter", () => {
  test("PACKAGE_MANAGER_NAMES enumerates bun, pnpm, and npm", () => {
    expect([...PACKAGE_MANAGER_NAMES].sort()).toEqual(["bun", "npm", "pnpm"]);
  });

  test("PACKAGE_MANAGER_VALUES extends names with 'auto'", () => {
    expect([...PACKAGE_MANAGER_VALUES].sort()).toEqual([
      "auto",
      "bun",
      "npm",
      "pnpm",
    ]);
  });

  test("PACKAGE_MANAGER_NAMES preserves auto-detect precedence order (bun before pnpm before npm)", () => {
    expect([...PACKAGE_MANAGER_NAMES]).toEqual(["bun", "pnpm", "npm"]);
  });

  test("resolves bun by name", () => {
    expect(resolvePackageManagerAdapter("bun").name).toBe("bun");
  });

  test.each(PACKAGE_MANAGER_NAMES.map((name) => [name] as const))(
    "resolves an adapter named %s",
    (name: PackageManagerName) => {
      const adapter = resolvePackageManagerAdapter(name);
      expect(adapter.name).toBe(name);
    },
  );

  test("each adapter call returns a fresh instance", () => {
    const first = resolvePackageManagerAdapter("npm");
    const second = resolvePackageManagerAdapter("npm");
    expect(first).not.toBe(second);
  });

  describe("npm adapter shape", () => {
    const npm = resolvePackageManagerAdapter("npm");

    test("exposes the abstract error names mapped to npm-prefixed classes", () => {
      expect(npm.errors.LockfileNotFound).toBe(NPM_ERRORS.NpmLockNotFound);
      expect(npm.errors.MalformedLockfile).toBe(NPM_ERRORS.MalformedNpmLock);
      expect(npm.errors.UnsupportedLockfileVersion).toBe(
        NPM_ERRORS.UnsupportedNpmLockVersion,
      );
    });

    test("declares a lockfile sub-adapter with package-lock.json", () => {
      expect(npm.lockfile.projectRelativePath).toBe("package-lock.json");
    });

    test("resolveCatalogReference always returns null (no catalog support)", () => {
      expect(
        npm.resolveCatalogReference({
          packageName: "anything",
          rawVersion: "catalog:",
          catalogs: { defaultCatalog: {}, namedCatalogs: {} },
        }),
      ).toBeNull();
    });

    test("isDependencyVersionWorkspaceFallback rejects the workspace: protocol (npm install would error)", () => {
      const candidate = { name: "wsa", version: "1.0.0" };
      // npm 11.x surfaces EUNSUPPORTEDPROTOCOL at install time for
      // any `workspace:`-prefixed range, so pacwich's static analysis
      // matches: not a workspace dep.
      expect(
        npm.isDependencyVersionWorkspaceFallback({
          depName: "wsa",
          rawVersion: "workspace:*",
          candidateWorkspace: candidate,
        }),
      ).toBe(false);
      expect(
        npm.isDependencyVersionWorkspaceFallback({
          depName: "wsa",
          rawVersion: "workspace:^1.0.0",
          candidateWorkspace: candidate,
        }),
      ).toBe(false);
    });

    test("isDependencyVersionWorkspaceFallback accepts vanilla semver matches", () => {
      const candidate = { name: "wsa", version: "1.2.3" };
      expect(
        npm.isDependencyVersionWorkspaceFallback({
          depName: "wsa",
          rawVersion: "*",
          candidateWorkspace: candidate,
        }),
      ).toBe(true);
      expect(
        npm.isDependencyVersionWorkspaceFallback({
          depName: "wsa",
          rawVersion: "^1.0.0",
          candidateWorkspace: candidate,
        }),
      ).toBe(true);
    });
  });

  describe("pnpm adapter shape", () => {
    const pnpm = resolvePackageManagerAdapter("pnpm");

    test("exposes the abstract error names mapped to pnpm-prefixed classes", () => {
      expect(pnpm.errors.LockfileNotFound).toBe(PNPM_ERRORS.PnpmLockNotFound);
      expect(pnpm.errors.MalformedLockfile).toBe(PNPM_ERRORS.MalformedPnpmLock);
      expect(pnpm.errors.UnsupportedLockfileVersion).toBe(
        PNPM_ERRORS.UnsupportedPnpmLockVersion,
      );
    });

    test("declares a lockfile sub-adapter with pnpm-lock.yaml", () => {
      expect(pnpm.lockfile.projectRelativePath).toBe("pnpm-lock.yaml");
    });

    test("resolveCatalogReference resolves default and named catalogs", () => {
      const catalogs = {
        defaultCatalog: { lodash: "4.17.0" },
        namedCatalogs: { test: { chalk: "5.0.0" } },
      };
      expect(
        pnpm.resolveCatalogReference({
          packageName: "lodash",
          rawVersion: "catalog:",
          catalogs,
        }),
      ).toEqual({ catalog: { name: "" }, version: "4.17.0" });
      expect(
        pnpm.resolveCatalogReference({
          packageName: "chalk",
          rawVersion: "catalog:test",
          catalogs,
        }),
      ).toEqual({ catalog: { name: "test" }, version: "5.0.0" });
      expect(
        pnpm.resolveCatalogReference({
          packageName: "missing",
          rawVersion: "catalog:",
          catalogs,
        }),
      ).toEqual({ catalog: { name: "" }, version: "" });
      expect(
        pnpm.resolveCatalogReference({
          packageName: "lodash",
          rawVersion: "^4.0.0",
          catalogs,
        }),
      ).toBeNull();
    });

    test("isDependencyVersionWorkspaceFallback accepts the workspace: protocol only", () => {
      const candidate = { name: "wsa", version: "1.0.0" };
      // pnpm's static fallback heuristic (used when no lockfile is
      // present) matches only the workspace: protocol prefix; a
      // lockfile is what catches semver-linked workspace deps.
      expect(
        pnpm.isDependencyVersionWorkspaceFallback({
          depName: "wsa",
          rawVersion: "workspace:*",
          candidateWorkspace: candidate,
        }),
      ).toBe(true);
      expect(
        pnpm.isDependencyVersionWorkspaceFallback({
          depName: "wsa",
          rawVersion: "workspace:^1.0.0",
          candidateWorkspace: candidate,
        }),
      ).toBe(true);
      // Vanilla semver ranges go to the registry under pnpm defaults.
      expect(
        pnpm.isDependencyVersionWorkspaceFallback({
          depName: "wsa",
          rawVersion: "*",
          candidateWorkspace: candidate,
        }),
      ).toBe(false);
      expect(
        pnpm.isDependencyVersionWorkspaceFallback({
          depName: "wsa",
          rawVersion: "^1.0.0",
          candidateWorkspace: candidate,
        }),
      ).toBe(false);
    });

    test("isDependencyVersionWorkspaceFallback returns false when no workspace candidate", () => {
      expect(
        pnpm.isDependencyVersionWorkspaceFallback({
          depName: "wsa",
          rawVersion: "workspace:*",
          candidateWorkspace: null,
        }),
      ).toBe(false);
    });
  });
});
