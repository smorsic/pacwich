import { resolvePackageManagerAdapter } from "../../../../src/packageManager/adapter";
import { loadFixture } from "../../../util/fixtures";
import { createGitFixture } from "../../../util/gitFixtures";
import { describeEachPm } from "../../../util/pmMatrix";
import { describe, expect, test } from "../../../util/testFramework";

/**
 * Asserts the contract for `adapter.lockfile`:
 *  - `projectRelativePath` exposes a string filename
 *  - `loadCurrentVersions` returns a name→version map from the
 *    project's on-disk lockfile
 *  - `loadVersionsAtGitRef` returns the same shape from a git ref
 *  - `resolveWorkspaceDepVersion` resolves a dep version with
 *    namespaced-fallback semantics
 *
 * Per-backend lockfile FORMAT specifics (e.g. bun's `packages` map
 * shape) are tested in the per-backend bucket. Bun's parser tests
 * live in `tests/packageManagers/bun/parseBunLockPackageVersions.test
 * .ts` and `bunLock.test.ts`.
 */

describeEachPm("adapter conformance: lockfile sub-adapter", ({ pm }) => {
  const adapter = resolvePackageManagerAdapter(pm.id);
  const { lockfile } = adapter;

  describe("projectRelativePath", () => {
    test("is a non-empty string", () => {
      expect(typeof lockfile.projectRelativePath).toBe("string");
      expect(lockfile.projectRelativePath.length).toBeGreaterThan(0);
    });
  });

  describe("loadCurrentVersions", () => {
    test("returns a Map of dep name to resolved version", () => {
      const rootDirectory = loadFixture("withDependenciesWithExternal", {
        pm: pm.id,
      });
      const versions = lockfile.loadCurrentVersions({ rootDirectory });
      expect(versions).toBeInstanceOf(Map);
      // Fixture lockfile pins lodash to 4.18.1 and typescript to 5.9.3.
      expect(versions.get("lodash")).toBe("4.18.1");
      expect(versions.get("typescript")).toBe("5.9.3");
    });

    test("returns an empty Map when the project has no lockfile", () => {
      // Use a tmpdir with no lockfile via createGitFixture (which inits
      // a bare project we can point at).
      const rootDirectory = loadFixture("emptyWorkspaces", { pm: pm.id });
      const versions = lockfile.loadCurrentVersions({ rootDirectory });
      expect(versions).toBeInstanceOf(Map);
      expect(versions.size).toBe(0);
    });
  });

  describe("loadVersionsAtGitRef", () => {
    test("returns the version map encoded in the lockfile at the given ref", async () => {
      // Build a synthetic git fixture with a lockfile committed at HEAD.
      // The lockfile content shape is PM-specific, so we read what the
      // active adapter would write — we can't author a generic
      // lockfile here. The simplest cross-PM test is therefore to
      // assert that the Map shape is returned; the bun-specific test
      // for the parser-detail content is in
      // tests/packageManagers/bun/parseBunLockPackageVersions.test.ts.
      const sourceProject = loadFixture("withDependenciesWithExternal", {
        pm: pm.id,
      });
      const lockContents = await import("fs").then((fs) =>
        fs.promises.readFile(
          `${sourceProject}/${lockfile.projectRelativePath}`,
          "utf8",
        ),
      );

      await using fixture = await createGitFixture({
        commits: [
          {
            message: "init",
            files: [
              {
                path: "package.json",
                content: JSON.stringify({
                  name: "test-root",
                  workspaces: ["packages/*"],
                }),
              },
              {
                path: lockfile.projectRelativePath,
                content: lockContents,
              },
            ],
          },
        ],
      });

      const versions = await lockfile.loadVersionsAtGitRef({
        rootDirectory: fixture.projectPath,
        ref: "HEAD",
      });

      expect(versions).toBeInstanceOf(Map);
      expect(versions.get("lodash")).toBe("4.18.1");
    });

    test("returns an empty Map when the lockfile is absent at the given ref", async () => {
      await using fixture = await createGitFixture({
        commits: [
          {
            message: "init",
            files: [
              {
                path: "package.json",
                content: JSON.stringify({ name: "test-root" }),
              },
            ],
          },
        ],
      });

      const versions = await lockfile.loadVersionsAtGitRef({
        rootDirectory: fixture.projectPath,
        ref: "HEAD",
      });

      expect(versions).toBeInstanceOf(Map);
      expect(versions.size).toBe(0);
    });
  });

  describe("resolveWorkspaceDepVersion", () => {
    const lock = new Map<string, string>([
      ["lodash", "4.17.21"],
      ["my-workspace/lodash", "4.17.22"],
      ["react", "18.0.0"],
    ]);

    test("returns the version for a bare dep name when no namespaced entry exists", () => {
      expect(
        lockfile.resolveWorkspaceDepVersion({
          lock,
          workspaceName: "any-workspace",
          depName: "react",
        }),
      ).toBe("18.0.0");
    });

    test.if(pm.capabilities.namespacedLockVersions)(
      "returns the namespaced version when one exists for the workspace",
      () => {
        expect(
          lockfile.resolveWorkspaceDepVersion({
            lock,
            workspaceName: "my-workspace",
            depName: "lodash",
          }),
        ).toBe("4.17.22");
      },
    );

    test.if(!pm.capabilities.namespacedLockVersions)(
      "ignores namespaced keys and returns the bare-key version",
      () => {
        // PMs without per-workspace namespacing (npm) always read
        // the hoisted bare-key entry regardless of workspaceName.
        expect(
          lockfile.resolveWorkspaceDepVersion({
            lock,
            workspaceName: "my-workspace",
            depName: "lodash",
          }),
        ).toBe("4.17.21");
      },
    );

    test("falls back to the bare-key version when no namespaced entry exists for the workspace", () => {
      expect(
        lockfile.resolveWorkspaceDepVersion({
          lock,
          workspaceName: "other-workspace",
          depName: "lodash",
        }),
      ).toBe("4.17.21");
    });

    test("returns null when the dep is absent from the lock", () => {
      expect(
        lockfile.resolveWorkspaceDepVersion({
          lock,
          workspaceName: "any",
          depName: "missing",
        }),
      ).toBeNull();
    });
  });
});
