import { createFileSystemProject } from "../../../src/project";
import { loadFixture } from "../../util/fixtures";
import { describe, expect, test } from "../../util/testFramework";

/**
 * npm-specific behavior of `createFileSystemProject`. PM-agnostic
 * shape assertions live in
 * `tests/api/fileSystemProject/simpleMembers.test.ts`; the
 * cross-PM matrix smoke suite lives in
 * `tests/packageManagers/pmMatrix/project/projectEndToEnd.test.ts`.
 *
 * The npm matrix entry isn't registered yet (commit 7 of Stage 5
 * does the full migration); this file exercises the npm backend
 * end-to-end via an explicit fixture in the meantime.
 */
describe("createFileSystemProject — npm backend", () => {
  const npmSmokePath = () => loadFixture("npmSmoke", { pm: "npm" });

  test("discovers workspaces from package-lock.json", () => {
    const project = createFileSystemProject({
      rootDirectory: npmSmokePath(),
      packageManager: "npm",
    });
    expect(project.packageManager).toBe("npm");
    const names = project.workspaces.map((w) => w.name).sort();
    expect(names).toEqual(["workspace-a", "workspace-b"]);
  });

  test("rootWorkspace reflects the root package.json", () => {
    const project = createFileSystemProject({
      rootDirectory: npmSmokePath(),
      packageManager: "npm",
    });
    expect(project.rootWorkspace.name).toBe("npm-smoke-root");
    expect(project.rootWorkspace.isRoot).toBe(true);
  });

  test("workspaces expose package.json scripts", () => {
    const project = createFileSystemProject({
      rootDirectory: npmSmokePath(),
      packageManager: "npm",
    });
    const a = project.findWorkspaceByName("workspace-a");
    expect(a?.scripts).toEqual(["noop"]);
  });

  test("'auto' resolves to npm when only package-lock.json is present", () => {
    const project = createFileSystemProject({
      rootDirectory: npmSmokePath(),
      packageManager: "auto",
    });
    expect(project.packageManager).toBe("npm");
  });

  test("recognizes a vanilla `*` workspace dep (workspace-b depends on workspace-a)", () => {
    // The fixture's workspace-b declares `"workspace-a": "*"` — npm
    // links it. Without the isDependencyVersionWorkspaceFallback hook, pacwich
    // would have classified this as an external dep.
    const project = createFileSystemProject({
      rootDirectory: npmSmokePath(),
      packageManager: "npm",
    });
    const b = project.findWorkspaceByName("workspace-b");
    expect(b?.dependencies).toEqual(["workspace-a"]);
    expect(b?.externalDependencies).toEqual([]);
    const a = project.findWorkspaceByName("workspace-a");
    expect(a?.dependents).toEqual(["workspace-b"]);
  });
});
