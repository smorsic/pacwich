import { resolvePackageManagerAdapter } from "../../../src/packageManager/adapter";
import { createFileSystemProject } from "../../../src/project";
import { loadFixture } from "../../util/fixtures";
import { describe, expect, test } from "../../util/testFramework";

/**
 * End-to-end coverage for lockfile-driven workspace-dependency
 * resolution. The `semverWorkspaceLink` fixture declares
 * `pkg-b → pkg-a` with a PLAIN SEMVER range (`"^1.0.0"`), not the
 * `workspace:` protocol.
 *
 *   - Under pnpm, the committed lockfile was produced with
 *     `linkWorkspacePackages: true`, so pnpm resolved that semver range
 *     to the local workspace. The pnpm static heuristic only matches the
 *     `workspace:` prefix, so without the lockfile pkg-a would be
 *     misclassified as an external dep — this is the regression the
 *     lockfile resolver fixes.
 *   - Under npm, name+semver matching links the workspace at install
 *     time, recorded as `"link": true` in package-lock.json.
 */
describe("workspace links: semver range resolved via the lockfile", () => {
  for (const pm of ["pnpm", "npm", "bun"] as const) {
    describe(pm, () => {
      const makeProject = () =>
        createFileSystemProject({
          rootDirectory: loadFixture("semverWorkspaceLink", { pm }),
          packageManager: pm,
        });

      test("links the semver-ranged dep to the local workspace", () => {
        const project = makeProject();
        const b = project.findWorkspaceByName("pkg-b");
        expect(b?.dependencies).toEqual(["pkg-a"]);
        expect(b?.externalDependencies).toEqual([]);
      });

      test("records the reverse dependent edge", () => {
        const project = makeProject();
        const a = project.findWorkspaceByName("pkg-a");
        expect(a?.dependents).toEqual(["pkg-b"]);
      });
    });
  }

  test("static heuristic alone would NOT link the pnpm semver dep (control)", () => {
    // Guards the premise of the lockfile path: pnpm's static
    // isDependencyVersionWorkspaceFallback rejects a vanilla semver range, so the
    // dependency edge above is owed to the lockfile resolver, not the
    // heuristic.
    const adapter = resolvePackageManagerAdapter("pnpm");
    expect(
      adapter.isDependencyVersionWorkspaceFallback({
        depName: "pkg-a",
        rawVersion: "^1.0.0",
        candidateWorkspace: { name: "pkg-a", version: "1.2.3" },
      }),
    ).toBe(false);
  });
});
