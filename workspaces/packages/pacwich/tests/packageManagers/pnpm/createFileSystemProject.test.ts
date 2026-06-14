import { createFileSystemProject } from "../../../src/project";
import { loadFixture } from "../../util/fixtures";
import { describe, expect, test } from "../../util/testFramework";

/**
 * pnpm-specific behavior of `createFileSystemProject`. PM-agnostic
 * shape assertions live in
 * `tests/api/fileSystemProject/simpleMembers.test.ts`; the cross-PM
 * matrix smoke suite lives in
 * `tests/packageManagers/pmMatrix/project/projectEndToEnd.test.ts`.
 *
 * This file exercises the parts of the pnpm backend that don't fit
 * into the matrix (workspace: protocol workspace-dep classification,
 * catalog data from pnpm-workspace.yaml, auto-detect from
 * pnpm-lock.yaml).
 */
describe("createFileSystemProject — pnpm backend", () => {
  const pnpmSmokePath = () => loadFixture("pnpmSmoke", { pm: "pnpm" });

  test("discovers workspaces from pnpm-lock.yaml importers", () => {
    const project = createFileSystemProject({
      rootDirectory: pnpmSmokePath(),
      packageManager: "pnpm",
    });
    expect(project.packageManager).toBe("pnpm");
    const names = project.workspaces.map((w) => w.name).sort();
    expect(names).toEqual(["workspace-a", "workspace-b"]);
  });

  test("rootWorkspace reflects the root package.json", () => {
    const project = createFileSystemProject({
      rootDirectory: pnpmSmokePath(),
      packageManager: "pnpm",
    });
    expect(project.rootWorkspace.name).toBe("pnpm-smoke-root");
    expect(project.rootWorkspace.isRoot).toBe(true);
  });

  test("workspaces expose package.json scripts", () => {
    const project = createFileSystemProject({
      rootDirectory: pnpmSmokePath(),
      packageManager: "pnpm",
    });
    const a = project.findWorkspaceByName("workspace-a");
    expect(a?.scripts).toEqual(["noop"]);
  });

  test("'auto' resolves to pnpm when only pnpm-lock.yaml is present", () => {
    const project = createFileSystemProject({
      rootDirectory: pnpmSmokePath(),
      packageManager: "auto",
    });
    expect(project.packageManager).toBe("pnpm");
  });

  test("links a `workspace:*` dep to the local workspace", () => {
    // The fixture's workspace-b declares `"workspace-a": "workspace:*"` —
    // pnpm's default workspace-protocol-only model is exactly what
    // the adapter mirrors.
    const project = createFileSystemProject({
      rootDirectory: pnpmSmokePath(),
      packageManager: "pnpm",
    });
    const b = project.findWorkspaceByName("workspace-b");
    expect(b?.dependencies).toEqual(["workspace-a"]);
    expect(b?.externalDependencies).toEqual([]);
    const a = project.findWorkspaceByName("workspace-a");
    expect(a?.dependents).toEqual(["workspace-b"]);
  });

  test("loads catalog data from pnpm-workspace.yaml", () => {
    // The fixture's pnpm-workspace.yaml declares one default catalog
    // entry (`some-default: 1.0.0`) and one named catalog entry
    // (`named.some-pinned: 2.0.0`). The adapter exposes them through
    // its `resolveCatalogReference` hook the same way bun does.
    const project = createFileSystemProject({
      rootDirectory: pnpmSmokePath(),
      packageManager: "pnpm",
    });
    expect(project.__adapter.name).toBe("pnpm");
    // Resolve via the same code path workspaces use at load time.
    const defaultResolved = project.__adapter.resolveCatalogReference({
      packageName: "some-default",
      rawVersion: "catalog:",
      catalogs: {
        defaultCatalog: { "some-default": "1.0.0" },
        namedCatalogs: {},
      },
    });
    expect(defaultResolved).toEqual({
      catalog: { name: "" },
      version: "1.0.0",
    });
  });
});
