import path from "path";
import { resolvePackageManagerAdapter } from "../../../src/packageManager/adapter";
import { describe, expect, test } from "../../util/testFramework";

/**
 * npm-specific `workspaces` parsing. npm documents only the flat-array
 * form, but it also reads the `packages` globs out of bun's
 * catalog-object form at install time — so pacwich accepts both rather
 * than rejecting a bun-shaped repo run under `--pm npm`. Catalogs are
 * never resolved (npm has no catalog concept). The PM-agnostic shape
 * contract lives in
 * tests/packageManagers/pmMatrix/adapter/projectDiscovery.test.ts.
 */

describe("npm adapter: loadRootMetadata", () => {
  const adapter = resolvePackageManagerAdapter("npm");
  const rootDirectory = path.resolve("/abs/project");

  const load = (workspaces: unknown) =>
    adapter.loadRootMetadata({
      rootDirectory,
      rootPackageJson: { name: "root", workspaces },
    });

  test("reads globs from the flat-array form", () => {
    const result = load(["packages/*", "apps/*"]);
    expect(result.workspaceGlobs).toEqual(["packages/*", "apps/*"]);
    expect(result.catalogs).toEqual({ defaultCatalog: {}, namedCatalogs: {} });
  });

  test("reads globs from the catalog-object form's `packages`", () => {
    const result = load({
      packages: ["packages/*"],
      catalog: { react: "^18.0.0" },
      catalogs: { ui: { lodash: "^4.0.0" } },
    });
    expect(result.workspaceGlobs).toEqual(["packages/*"]);
  });

  test("never resolves catalogs from the object form (npm has none)", () => {
    const result = load({
      packages: ["packages/*"],
      catalog: { react: "^18.0.0" },
      catalogs: { ui: { lodash: "^4.0.0" } },
    });
    expect(result.catalogs).toEqual({ defaultCatalog: {}, namedCatalogs: {} });
  });

  test("does not over-enforce: non-array values yield empty globs, not errors", () => {
    expect(load(undefined).workspaceGlobs).toEqual([]);
    expect(load(null).workspaceGlobs).toEqual([]);
    expect(load({}).workspaceGlobs).toEqual([]);
    expect(load({ packages: "packages/*" }).workspaceGlobs).toEqual([]);
    expect(load("packages/*").workspaceGlobs).toEqual([]);
  });
});
