import fs from "fs";
import path from "path";
import { resolvePackageManagerAdapter } from "../../../../src/packageManager/adapter";
import { loadFixture } from "../../../util/fixtures";
import { describeEachPm } from "../../../util/pmMatrix";
import { describe, expect, test } from "../../../util/testFramework";

/**
 * Asserts the shape of `loadRootMetadata` and `discoverWorkspacePaths`
 * outputs across every registered backend. Error paths (e.g. bun's
 * `LockfileNotFound` from `discoverWorkspacePaths`) are
 * implementation-specific and live in the per-backend bucket. Bun's
 * version is in `tests/packageManagers/bun/createFileSystemProject.test
 * .ts`.
 */

const readPackageJson = (rootDirectory: string) =>
  JSON.parse(
    fs.readFileSync(path.join(rootDirectory, "package.json"), "utf8"),
  ) as Record<string, unknown>;

describeEachPm("adapter conformance: project discovery", ({ pm }) => {
  const adapter = resolvePackageManagerAdapter(pm.id);

  describe("loadRootMetadata", () => {
    test("returns workspace globs declared in the project", () => {
      const rootDirectory = loadFixture("withDependenciesSimple", {
        pm: pm.id,
      });
      const result = adapter.loadRootMetadata({
        rootDirectory,
        rootPackageJson: readPackageJson(rootDirectory),
      });
      expect(Array.isArray(result.workspaceGlobs)).toBe(true);
      expect(result.workspaceGlobs.length).toBeGreaterThan(0);
      for (const glob of result.workspaceGlobs) {
        expect(typeof glob).toBe("string");
      }
    });

    test("returns empty catalogs when project declares none", () => {
      const rootDirectory = loadFixture("withDependenciesSimple", {
        pm: pm.id,
      });
      const result = adapter.loadRootMetadata({
        rootDirectory,
        rootPackageJson: readPackageJson(rootDirectory),
      });
      expect(result.catalogs.defaultCatalog).toEqual({});
      expect(result.catalogs.namedCatalogs).toEqual({});
    });

    // Capability-gated: only runs for backends that support catalogs.
    test.if(pm.capabilities.catalogs)(
      "exposes a CatalogSet with defaultCatalog and namedCatalogs",
      () => {
        const rootDirectory = loadFixture("withCatalogSimple", { pm: pm.id });
        const result = adapter.loadRootMetadata({
          rootDirectory,
          rootPackageJson: readPackageJson(rootDirectory),
        });
        expect(result.catalogs).toMatchObject({
          defaultCatalog: expect.any(Object),
          namedCatalogs: expect.any(Object),
        });
      },
    );
  });

  describe("discoverWorkspacePaths", () => {
    test("returns absolute paths under the project root", () => {
      const rootDirectory = loadFixture("withDependenciesSimple", {
        pm: pm.id,
      });
      const result = adapter.discoverWorkspacePaths({
        rootDirectory,
        workspaceGlobs: ["packages/*"],
      });
      expect(result.absolutePaths.length).toBeGreaterThan(0);
      for (const absolutePath of result.absolutePaths) {
        expect(path.isAbsolute(absolutePath)).toBe(true);
        expect(absolutePath.startsWith(rootDirectory)).toBe(true);
      }
    });

    test("includes the project root itself", () => {
      const rootDirectory = loadFixture("withDependenciesSimple", {
        pm: pm.id,
      });
      const result = adapter.discoverWorkspacePaths({
        rootDirectory,
        workspaceGlobs: ["packages/*"],
      });
      expect(result.absolutePaths).toContain(rootDirectory);
    });
  });
});
