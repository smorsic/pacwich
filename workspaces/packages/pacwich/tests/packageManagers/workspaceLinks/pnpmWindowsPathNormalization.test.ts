import path from "path";
import { toPosixPath } from "../../../src/internal/core";
import { parsePnpmLockWorkspaceLinks } from "../../../src/packageManager/backends/pnpm/pnpmLock";
import { describe, expect, test } from "../../util/testFramework";

/**
 * Regression for the Windows lookup miss that hid a `link:` workspace
 * dep. pnpm-lock importer keys are POSIX (`packages/pkg-b`), but
 * `path.relative` on Windows returns OS-native (`packages\\pkg-b`), so
 * a raw `links.get(path.relative(...))` misses and the dep falls through
 * to the static heuristic, which rejects a plain semver range. We
 * normalize `workspace.path` to POSIX at assembly time; this test
 * exercises that contract using `path.win32` to synthesize the same
 * input shape the OS produces on Windows.
 */
describe("pnpm workspace links: workspace.path POSIX normalization (Windows simulation)", () => {
  const yaml = `lockfileVersion: '9.0'

importers:
  .: {}

  packages/pkg-a: {}

  packages/pkg-b:
    dependencies:
      pkg-a:
        specifier: ^1.0.0
        version: link:../pkg-a
`;

  const parsed = parsePnpmLockWorkspaceLinks(yaml);
  if (parsed instanceof Error) throw parsed;
  const links = parsed;

  const root = "D:\\proj\\semverWS";
  const pkgBAbs = path.win32.join(root, "packages", "pkg-b");
  const winRelative = path.win32.relative(root, pkgBAbs);

  test("path.win32.relative produces a backslashed path that would miss the lockfile lookup directly", () => {
    expect(winRelative).toBe("packages\\pkg-b");
    expect(links.get(winRelative)).toBeUndefined();
  });

  test("toPosixPath converts the backslashed path to the POSIX form the lockfile is keyed by", () => {
    const posix = toPosixPath(winRelative);
    expect(posix).toBe("packages/pkg-b");
    const deps = links.get(posix);
    expect(deps).toBeDefined();
    expect(deps?.get("pkg-a")).toBe(true);
  });
});
