import {
  createFileSystemProject,
  type ImplicitWorkspaceDependencyMetadata,
  type VerifyIssue,
  type VerifyResult,
} from "../../../../src/project";
import { loadFixture } from "../../../util/fixtures";
import { describeEachPm } from "../../../util/pmMatrix";
import { describe, expect, test } from "../../../util/testFramework";

/**
 * Matrix coverage for `project.verify()`. Verify is most valuable on
 * package managers that don't enforce explicit workspace-dep
 * declarations at install time (npm), but the behavior should be
 * identical across all shipped backends. This suite exercises the
 * same fixture under each registered pm to catch any adapter-specific
 * divergence in:
 *   - which workspaces the project sees
 *   - which deps end up in `workspace.dependencies` vs
 *     `workspace.externalDependencies` (the union is what verify
 *     treats as "declared")
 *   - per-pm `formatImplicitWorkspaceDepVersion` (surfaces in
 *     fixHints: bun/pnpm use `"workspace:*"`, npm uses `"*"`)
 */

const EXPECTED_FIX_HINT_VERSIONS = {
  bun: "workspace:*",
  npm: "*",
  pnpm: "workspace:*",
} as const;

const allImplicitDepMetadata = (
  result: VerifyResult,
): ImplicitWorkspaceDependencyMetadata[] =>
  [...result.errors, ...result.warnings]
    .filter(
      (issue): issue is VerifyIssue<"implicitWorkspaceDependency"> =>
        issue.name === "implicitWorkspaceDependency",
    )
    .map((issue) => issue.metadata);

describeEachPm("project.verify() — pm matrix", ({ pm }) => {
  const makeProject = () =>
    createFileSystemProject({
      rootDirectory: loadFixture("verifySimple", { pm: pm.id }),
    });

  describe("findings consistency across pms", () => {
    test("detects app-c → lib-b as an implicit workspace dep", async () => {
      const project = makeProject();
      const result = await project.verify();
      const metadata = allImplicitDepMetadata(result).find(
        (entry) => entry.workspace === "app-c" && entry.dependency === "lib-b",
      );
      expect(metadata).toBeDefined();
    });

    test("does NOT flag declared workspace deps (lib-b → lib-a, app-c → lib-a)", async () => {
      const project = makeProject();
      const result = await project.verify();
      const declared = allImplicitDepMetadata(result).filter(
        (entry) =>
          (entry.workspace === "lib-b" && entry.dependency === "lib-a") ||
          (entry.workspace === "app-c" && entry.dependency === "lib-a"),
      );
      expect(declared).toEqual([]);
    });

    test("does NOT flag self-imports, even in a workspace that has real findings (app-c → app-c/sub)", async () => {
      const project = makeProject();
      const result = await project.verify();
      const all = allImplicitDepMetadata(result);
      // Positive guard: app-c really does produce an implicit finding,
      // so the empty self-filter below is real signal that the analyzer
      // ran and classified the self-import — not a vacuous pass on a
      // workspace that happens to have no findings at all.
      expect(
        all.some(
          (entry) =>
            entry.workspace === "app-c" && entry.dependency === "lib-b",
        ),
      ).toBe(true);
      const self = all.filter(
        (entry) => entry.workspace === "app-c" && entry.dependency === "app-c",
      );
      expect(self).toEqual([]);
    });

    test("does NOT flag non-workspace package imports (node:path, fs)", async () => {
      const project = makeProject();
      const result = await project.verify();
      const appEMeta = allImplicitDepMetadata(result).filter(
        (entry) => entry.workspace === "app-e",
      );
      expect(appEMeta).toEqual([]);
    });

    test("does NOT flag commented-out imports (app-d)", async () => {
      const project = makeProject();
      const result = await project.verify();
      const appDMeta = allImplicitDepMetadata(result).filter(
        (entry) => entry.workspace === "app-d",
      );
      expect(appDMeta).toEqual([]);
    });

    test("strict mode exits with ok=false when findings exist", async () => {
      const project = makeProject();
      const result = await project.verify({ strict: true });
      expect(result.ok).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe("per-pm fix hints", () => {
    test(`fixHint version string matches ${pm.id}'s adapter formatting`, async () => {
      const project = makeProject();
      const result = await project.verify();
      const metadata = allImplicitDepMetadata(result).find(
        (entry) => entry.workspace === "app-c" && entry.dependency === "lib-b",
      );
      expect(metadata).toBeDefined();
      expect(metadata!.fixHint).toContain(
        `"${EXPECTED_FIX_HINT_VERSIONS[pm.id]}"`,
      );
    });
  });
});
