import { describe, expect, test } from "bun:test";
import { computeExternalDependencyChanges } from "../../../src/affected/externalDependencyChanges";
import {
  parseBunLockPackageVersions,
  type BunLockVersionMap,
} from "../../../src/internal/bun/bunLock";
import { makeTestWorkspace } from "../../util/testData";

describe("parseBunLockPackageVersions", () => {
  test("extracts name and version from each packages entry", () => {
    const lock = JSON.stringify({
      lockfileVersion: 1,
      workspaces: { "": { name: "test-root" } },
      packages: {
        lodash: ["lodash@4.17.21", {}, "<sha>"],
        react: ["react@18.0.0", {}, "<sha>"],
      },
    });
    const result = parseBunLockPackageVersions(lock) as BunLockVersionMap;
    expect(result.get("lodash")).toBe("4.17.21");
    expect(result.get("react")).toBe("18.0.0");
  });

  test("handles scoped names by splitting on the last @", () => {
    const lock = JSON.stringify({
      lockfileVersion: 1,
      packages: {
        "@scope/foo": ["@scope/foo@1.2.3", {}, "<sha>"],
        "@types/node": ["@types/node@20.10.0", {}, "<sha>"],
      },
    });
    const result = parseBunLockPackageVersions(lock) as BunLockVersionMap;
    expect(result.get("@scope/foo")).toBe("1.2.3");
    expect(result.get("@types/node")).toBe("20.10.0");
  });

  test("returns empty map when packages field is absent", () => {
    const lock = JSON.stringify({ lockfileVersion: 1 });
    const result = parseBunLockPackageVersions(lock) as BunLockVersionMap;
    expect(result.size).toBe(0);
  });

  test("skips entries that do not follow name@version", () => {
    const lock = JSON.stringify({
      lockfileVersion: 1,
      packages: {
        ok: ["ok@1.0.0", {}, "<sha>"],
        // missing version segment
        weird: ["weird", {}, "<sha>"],
        // empty version after @
        emptyVersion: ["emptyVersion@", {}, "<sha>"],
        // not an array
        notAnArray: "huh",
      },
    });
    const result = parseBunLockPackageVersions(lock) as BunLockVersionMap;
    expect(result.get("ok")).toBe("1.0.0");
    expect(result.has("weird")).toBe(false);
    expect(result.has("emptyVersion")).toBe(false);
    expect(result.has("notAnArray")).toBe(false);
  });

  test("returns an error for malformed JSON", () => {
    const result = parseBunLockPackageVersions("{ not valid }");
    expect(result).toBeInstanceOf(Error);
  });
});

describe("computeExternalDependencyChanges", () => {
  const workspaces = [
    makeTestWorkspace({
      name: "a",
      externalDependencies: [
        { name: "lodash", version: "^4.17.0", source: "dependencies" },
        { name: "typescript", version: "^5.0.0", source: "devDependencies" },
      ],
    }),
    makeTestWorkspace({
      name: "b",
      externalDependencies: [
        { name: "react", version: "^18.0.0", source: "dependencies" },
      ],
    }),
  ];

  test("emits no entries when versions are unchanged", () => {
    const lock = new Map([
      ["lodash", "4.17.21"],
      ["typescript", "5.0.0"],
      ["react", "18.0.0"],
    ]);
    const result = computeExternalDependencyChanges({
      workspaces,
      baseLock: lock,
      headLock: lock,
    });
    expect(result.size).toBe(0);
  });

  test("emits a change when a version moves", () => {
    const baseLock = new Map([
      ["lodash", "4.17.21"],
      ["typescript", "5.0.0"],
      ["react", "18.0.0"],
    ]);
    const headLock = new Map([
      ["lodash", "4.17.22"],
      ["typescript", "5.0.0"],
      ["react", "18.0.0"],
    ]);
    const result = computeExternalDependencyChanges({
      workspaces,
      baseLock,
      headLock,
    });
    expect(result.get("a")).toEqual([
      {
        name: "lodash",
        source: "dependencies",
        baseVersion: "4.17.21",
        headVersion: "4.17.22",
      },
    ]);
    expect(result.has("b")).toBe(false);
  });

  test("emits an added (baseVersion=null) entry for new deps", () => {
    const baseLock = new Map<string, string>();
    const headLock = new Map([["lodash", "4.17.21"]]);
    const result = computeExternalDependencyChanges({
      workspaces: [workspaces[0]],
      baseLock,
      headLock,
    });
    expect(result.get("a")).toContainEqual({
      name: "lodash",
      source: "dependencies",
      baseVersion: null,
      headVersion: "4.17.21",
    });
  });

  test("emits a removed (headVersion=null) entry for deleted deps", () => {
    const baseLock = new Map([
      ["lodash", "4.17.21"],
      ["typescript", "5.0.0"],
    ]);
    const headLock = new Map<string, string>();
    const result = computeExternalDependencyChanges({
      workspaces: [workspaces[0]],
      baseLock,
      headLock,
    });
    expect(result.get("a")).toContainEqual({
      name: "lodash",
      source: "dependencies",
      baseVersion: "4.17.21",
      headVersion: null,
    });
    expect(result.get("a")).toContainEqual({
      name: "typescript",
      source: "devDependencies",
      baseVersion: "5.0.0",
      headVersion: null,
    });
  });

  test("preserves the source from the workspace's externalDependencies entry", () => {
    const baseLock = new Map([["typescript", "5.0.0"]]);
    const headLock = new Map([["typescript", "5.1.0"]]);
    const result = computeExternalDependencyChanges({
      workspaces: [workspaces[0]],
      baseLock,
      headLock,
    });
    expect(result.get("a")).toEqual([
      {
        name: "typescript",
        source: "devDependencies",
        baseVersion: "5.0.0",
        headVersion: "5.1.0",
      },
    ]);
  });

  test("includes peer and optional sources when their versions move in the lockfile", () => {
    const peerOnly = makeTestWorkspace({
      name: "peer-only",
      externalDependencies: [
        { name: "react", version: "^18.0.0", source: "peerDependencies" },
      ],
    });
    const optionalOnly = makeTestWorkspace({
      name: "optional-only",
      externalDependencies: [
        { name: "fsevents", version: "^2.0.0", source: "optionalDependencies" },
      ],
    });
    const baseLock = new Map([
      ["react", "18.0.0"],
      ["fsevents", "2.3.0"],
    ]);
    const headLock = new Map([
      ["react", "18.2.0"],
      ["fsevents", "2.3.3"],
    ]);
    const result = computeExternalDependencyChanges({
      workspaces: [peerOnly, optionalOnly],
      baseLock,
      headLock,
    });
    expect(result.get("peer-only")).toEqual([
      {
        name: "react",
        source: "peerDependencies",
        baseVersion: "18.0.0",
        headVersion: "18.2.0",
      },
    ]);
    expect(result.get("optional-only")).toEqual([
      {
        name: "fsevents",
        source: "optionalDependencies",
        baseVersion: "2.3.0",
        headVersion: "2.3.3",
      },
    ]);
  });

  test("optional/peer deps with no lockfile resolution emit no change (lockfile presence is the gate)", () => {
    const workspace = makeTestWorkspace({
      name: "platform-conditional",
      externalDependencies: [
        { name: "fsevents", version: "^2.0.0", source: "optionalDependencies" },
      ],
    });
    // fsevents was skipped on this platform — never resolved at either ref.
    const result = computeExternalDependencyChanges({
      workspaces: [workspace],
      baseLock: new Map(),
      headLock: new Map(),
    });
    expect(result.size).toBe(0);
  });

  test("workspaces with no external deps produce no entries", () => {
    const empty = makeTestWorkspace({ name: "empty" });
    const result = computeExternalDependencyChanges({
      workspaces: [empty],
      baseLock: new Map(),
      headLock: new Map([["whatever", "1.0.0"]]),
    });
    expect(result.size).toBe(0);
  });

  describe("divergent per-workspace versions", () => {
    test("prefers `<workspaceName>/<dep>` key when present, falls back to bare key", () => {
      const a = makeTestWorkspace({
        name: "pkg-a",
        externalDependencies: [
          { name: "react", version: "^18.0.0", source: "dependencies" },
        ],
      });
      const b = makeTestWorkspace({
        name: "pkg-b",
        externalDependencies: [
          { name: "react", version: "^18.0.0", source: "dependencies" },
        ],
      });
      // Mirrors the actual bun.lock shape for divergent versions:
      // pkg-a uses the hoisted version; pkg-b has a workspace-scoped entry
      const baseLock = new Map([
        ["react", "17.0.2"],
        ["pkg-b/react", "18.2.0"],
      ]);
      const headLock = new Map([
        ["react", "17.0.2"],
        ["pkg-b/react", "18.3.1"],
      ]);
      const result = computeExternalDependencyChanges({
        workspaces: [a, b],
        baseLock,
        headLock,
      });
      // Only pkg-b should be flagged — its scoped entry moved
      expect(result.get("pkg-a")).toBeUndefined();
      expect(result.get("pkg-b")).toEqual([
        {
          name: "react",
          source: "dependencies",
          baseVersion: "18.2.0",
          headVersion: "18.3.1",
        },
      ]);
    });

    test("a hoisted bump only affects the workspace using the hoist", () => {
      const a = makeTestWorkspace({
        name: "pkg-a",
        externalDependencies: [
          { name: "react", version: "^18.0.0", source: "dependencies" },
        ],
      });
      const b = makeTestWorkspace({
        name: "pkg-b",
        externalDependencies: [
          { name: "react", version: "^18.0.0", source: "dependencies" },
        ],
      });
      // pkg-a uses the hoisted version; pkg-b is locally pinned. Only the
      // hoisted version moves.
      const baseLock = new Map([
        ["react", "17.0.1"],
        ["pkg-b/react", "18.2.0"],
      ]);
      const headLock = new Map([
        ["react", "17.0.2"],
        ["pkg-b/react", "18.2.0"],
      ]);
      const result = computeExternalDependencyChanges({
        workspaces: [a, b],
        baseLock,
        headLock,
      });
      expect(result.get("pkg-a")).toEqual([
        {
          name: "react",
          source: "dependencies",
          baseVersion: "17.0.1",
          headVersion: "17.0.2",
        },
      ]);
      expect(result.get("pkg-b")).toBeUndefined();
    });

    test("scoped dep names work in the namespaced key (e.g. `<workspace>/@scope/foo`)", () => {
      const b = makeTestWorkspace({
        name: "pkg-b",
        externalDependencies: [
          {
            name: "@types/node",
            version: "^20.0.0",
            source: "devDependencies",
          },
        ],
      });
      const baseLock = new Map([
        ["@types/node", "18.0.0"],
        ["pkg-b/@types/node", "20.0.0"],
      ]);
      const headLock = new Map([
        ["@types/node", "18.0.0"],
        ["pkg-b/@types/node", "20.1.0"],
      ]);
      const result = computeExternalDependencyChanges({
        workspaces: [b],
        baseLock,
        headLock,
      });
      expect(result.get("pkg-b")).toEqual([
        {
          name: "@types/node",
          source: "devDependencies",
          baseVersion: "20.0.0",
          headVersion: "20.1.0",
        },
      ]);
    });
  });
});
