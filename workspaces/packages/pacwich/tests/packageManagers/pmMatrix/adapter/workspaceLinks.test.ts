import fs from "fs";
import os from "os";
import path from "path";
import { resolvePackageManagerAdapter } from "../../../../src/packageManager/adapter";
import { loadFixture } from "../../../util/fixtures";
import { describeEachPm } from "../../../util/pmMatrix";
import { afterAll, describe, expect, test } from "../../../util/testFramework";

/**
 * Cross-pm contract for `adapter.parseLockfileWorkspaceLinks` — the
 * lockfile-derived workspace-link resolver. Every shipped backend
 * implements it. The resolver is `null` when no lockfile is on disk,
 * and `classify` reports `"link"` for a dep the lockfile resolved to a
 * local workspace.
 *
 * The `semverWorkspaceLink` fixture declares `pkg-b → pkg-a` with a
 * plain semver range and ships a committed lockfile per pm in which the
 * dep resolved to the local workspace, so `classify` must return
 * `"link"` regardless of the pm's static heuristic.
 */
describeEachPm("adapter conformance: workspace links", ({ pm }) => {
  const adapter = resolvePackageManagerAdapter(pm.id);

  test("defines parseLockfileWorkspaceLinks", () => {
    expect(typeof adapter.parseLockfileWorkspaceLinks).toBe("function");
  });

  describe("with no lockfile on disk", () => {
    const tmpDirs: string[] = [];
    afterAll(() => {
      for (const dir of tmpDirs) {
        fs.rmSync(dir, { force: true, recursive: true });
      }
    });

    test("returns null", () => {
      const tmpDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "pacwich-ws-links-"),
      );
      tmpDirs.push(tmpDir);
      expect(
        adapter.parseLockfileWorkspaceLinks?.({ rootDirectory: tmpDir }),
      ).toBe(null);
    });
  });

  describe("with the semverWorkspaceLink fixture", () => {
    const resolver = () =>
      adapter.parseLockfileWorkspaceLinks?.({
        rootDirectory: loadFixture("semverWorkspaceLink", { pm: pm.id }),
      }) ?? null;

    test("classifies the semver-ranged dep as a link", () => {
      expect(
        resolver()?.classify({
          workspacePath: "packages/pkg-b",
          depName: "pkg-a",
        }),
      ).toBe("link");
    });

    test("classifies an unknown dep as 'unknown'", () => {
      expect(
        resolver()?.classify({
          workspacePath: "packages/pkg-b",
          depName: "not-a-real-dep",
        }),
      ).toBe("unknown");
    });
  });
});
