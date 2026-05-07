import { describe, test, expect } from "bun:test";
import { findWorkspaces } from "../../../src/workspaces";
import { preventDependencyCycles } from "../../../src/workspaces/dependencyGraph";
import { getProjectRoot } from "../../fixtures/testProjects";
import { makeTestWorkspace } from "../../util/testData";

describe("findWorkspaces with dependencies", () => {
  const expectedSimpleGraph = [
    makeTestWorkspace({
      name: "a-depends-e",
      path: "packages/a-depends-e",
      matchPattern: "packages/*",
      scripts: ["test-script"],
      dependencies: ["e"],
    }),
    makeTestWorkspace({
      name: "b-depends-cd",
      path: "packages/b-depends-cd",
      matchPattern: "packages/*",
      scripts: ["test-script"],
      dependencies: ["c-depends-e", "d-depends-e"],
    }),
    makeTestWorkspace({
      name: "c-depends-e",
      path: "packages/c-depends-e",
      matchPattern: "packages/*",
      scripts: ["test-script"],
      dependencies: ["e"],
      dependents: ["b-depends-cd"],
    }),
    makeTestWorkspace({
      name: "d-depends-e",
      path: "packages/d-depends-e",
      matchPattern: "packages/*",
      scripts: ["test-script"],
      dependencies: ["e"],
      dependents: ["b-depends-cd"],
    }),
    makeTestWorkspace({
      name: "e",
      path: "packages/e",
      matchPattern: "packages/*",
      scripts: ["test-script"],
      dependents: ["a-depends-e", "c-depends-e", "d-depends-e"],
    }),
  ];

  test("findWorkspaces has expected dependencies and dependents", () => {
    const { workspaces } = findWorkspaces({
      rootDirectory: getProjectRoot("withDependenciesSimple"),
    });

    expect(workspaces).toEqual(expectedSimpleGraph);
  });

  test("findWorkspaces resolves catalog: and catalog:name dependencies to the same graph as direct workspace: references", () => {
    const { workspaces } = findWorkspaces({
      rootDirectory: getProjectRoot("withDependenciesCatalogDependencies"),
    });

    expect(workspaces).toEqual(expectedSimpleGraph);
  });
});

describe("Workspace.externalDependencies", () => {
  test("captures dependencies and devDependencies tagged with their source", () => {
    const { workspaces } = findWorkspaces({
      rootDirectory: getProjectRoot("withDependenciesWithExternal"),
    });
    const a = workspaces.find((w) => w.name === "a")!;
    expect(a.externalDependencies).toEqual([
      { name: "lodash", version: "^4.17.0", source: "dependencies" },
      { name: "typescript", version: "^5.0.0", source: "devDependencies" },
    ]);
  });

  test("captures peerDependencies and optionalDependencies tagged with their source", () => {
    const { workspaces } = findWorkspaces({
      rootDirectory: getProjectRoot("withDependenciesWithExternal"),
    });
    const c = workspaces.find((w) => w.name === "c")!;
    expect(c.externalDependencies).toEqual([
      { name: "fsevents", version: "^2.0.0", source: "optionalDependencies" },
      { name: "react", version: "^18.0.0", source: "peerDependencies" },
    ]);
  });

  test("excludes workspace:* dependencies from externalDependencies", () => {
    const { workspaces } = findWorkspaces({
      rootDirectory: getProjectRoot("withDependenciesSimple"),
    });
    for (const workspace of workspaces) {
      expect(workspace.externalDependencies).toEqual([]);
    }
  });

  test("workspaces with no external deps have an empty array", () => {
    const { workspaces } = findWorkspaces({
      rootDirectory: getProjectRoot("withDependenciesWithExternal"),
    });
    const d = workspaces.find((w) => w.name === "d")!;
    expect(d.externalDependencies).toEqual([]);
  });

  describe("catalog references", () => {
    test("default `catalog:` resolves to the catalog version with `catalog: { name: '' }`", () => {
      const { workspaces } = findWorkspaces({
        rootDirectory: getProjectRoot("withDependenciesWithExternalCatalog"),
      });
      const a = workspaces.find((w) => w.name === "a")!;
      expect(a.externalDependencies).toEqual([
        {
          name: "lodash",
          version: "^4.17.0",
          source: "dependencies",
          catalog: { name: "" },
        },
      ]);
    });

    test("named `catalog:<name>` resolves to the named catalog version with the catalog name", () => {
      const { workspaces } = findWorkspaces({
        rootDirectory: getProjectRoot("withDependenciesWithExternalCatalog"),
      });
      const b = workspaces.find((w) => w.name === "b")!;
      expect(b.externalDependencies).toEqual([
        {
          name: "react",
          version: "^17.0.0",
          source: "dependencies",
          catalog: { name: "react17" },
        },
      ]);
    });

    test("unresolvable catalog refs preserve the literal `catalog:<name>` as version while still tagging the catalog name", () => {
      const { workspaces } = findWorkspaces({
        rootDirectory: getProjectRoot("withDependenciesWithExternalCatalog"),
      });
      const c = workspaces.find((w) => w.name === "c")!;
      expect(c.externalDependencies).toEqual([
        {
          name: "typescript",
          version: "catalog:nope",
          source: "devDependencies",
          catalog: { name: "nope" },
        },
      ]);
    });

    test("non-catalog deps in the same workspace do not get a catalog field", () => {
      const { workspaces } = findWorkspaces({
        rootDirectory: getProjectRoot("withDependenciesWithExternalCatalog"),
      });
      const d = workspaces.find((w) => w.name === "d")!;
      expect(d.externalDependencies).toEqual([
        {
          name: "left-pad",
          version: "^1.3.0",
          source: "dependencies",
        },
        {
          name: "lodash",
          version: "^4.17.0",
          source: "dependencies",
          catalog: { name: "" },
        },
      ]);
    });
  });
});

describe("preventDependencyCycles", () => {
  test("returns workspaces and empty cycles when no cycles exist", () => {
    const workspaces = [
      makeTestWorkspace({ name: "a", dependencies: ["b"] }),
      makeTestWorkspace({ name: "b", dependents: ["a"] }),
      makeTestWorkspace({ name: "c" }),
    ];
    const { workspaces: result, cycles } = preventDependencyCycles(workspaces);
    expect(cycles).toEqual([]);
    expect(result).toEqual(workspaces);
  });

  test("detects and removes a mutual two-workspace cycle", () => {
    const workspaces = [
      makeTestWorkspace({ name: "a", dependencies: ["b"], dependents: ["b"] }),
      makeTestWorkspace({ name: "b", dependencies: ["a"], dependents: ["a"] }),
    ];
    const { workspaces: result, cycles } = preventDependencyCycles(workspaces);
    expect(cycles).toEqual([{ dependency: "a", dependent: "b" }]);
    // All edges between cycle nodes {a, b} are removed
    expect(result).toEqual([
      makeTestWorkspace({ name: "a" }),
      makeTestWorkspace({ name: "b" }),
    ]);
  });

  test("detects and removes a three-workspace chain cycle", () => {
    const workspaces = [
      makeTestWorkspace({ name: "a", dependencies: ["b"], dependents: ["c"] }),
      makeTestWorkspace({ name: "b", dependencies: ["c"], dependents: ["a"] }),
      makeTestWorkspace({ name: "c", dependencies: ["a"], dependents: ["b"] }),
    ];
    const { workspaces: result, cycles } = preventDependencyCycles(workspaces);
    expect(cycles).toEqual([{ dependency: "a", dependent: "c" }]);
    // All edges between cycle nodes {a, b, c} are removed
    expect(result).toEqual([
      makeTestWorkspace({ name: "a" }),
      makeTestWorkspace({ name: "b" }),
      makeTestWorkspace({ name: "c" }),
    ]);
  });

  test("detects and removes a four-workspace chain cycle", () => {
    const workspaces = [
      makeTestWorkspace({ name: "a", dependencies: ["b"], dependents: ["d"] }),
      makeTestWorkspace({ name: "b", dependencies: ["c"], dependents: ["a"] }),
      makeTestWorkspace({ name: "c", dependencies: ["d"], dependents: ["b"] }),
      makeTestWorkspace({ name: "d", dependencies: ["a"], dependents: ["c"] }),
    ];
    const { workspaces: result, cycles } = preventDependencyCycles(workspaces);
    expect(cycles).toEqual([{ dependency: "a", dependent: "d" }]);
    // All edges between cycle nodes {a, b, c, d} are removed
    expect(result).toEqual([
      makeTestWorkspace({ name: "a" }),
      makeTestWorkspace({ name: "b" }),
      makeTestWorkspace({ name: "c" }),
      makeTestWorkspace({ name: "d" }),
    ]);
  });

  test("detects and removes a self-referencing cycle", () => {
    const workspaces = [makeTestWorkspace({ name: "a", dependencies: ["a"] })];
    const { workspaces: result, cycles } = preventDependencyCycles(workspaces);
    expect(cycles).toEqual([{ dependency: "a", dependent: "a" }]);
    expect(result).toEqual([makeTestWorkspace({ name: "a" })]);
  });

  test("detects and removes multiple independent cycles", () => {
    const workspaces = [
      makeTestWorkspace({ name: "a", dependencies: ["b"], dependents: ["b"] }),
      makeTestWorkspace({ name: "b", dependencies: ["a"], dependents: ["a"] }),
      makeTestWorkspace({ name: "c", dependencies: ["d"], dependents: ["d"] }),
      makeTestWorkspace({ name: "d", dependencies: ["c"], dependents: ["c"] }),
    ];
    const { workspaces: result, cycles } = preventDependencyCycles(workspaces);
    expect(cycles).toEqual([
      { dependency: "a", dependent: "b" },
      { dependency: "c", dependent: "d" },
    ]);
    // All edges within each cycle group ({a,b} and {c,d}) are removed
    expect(result).toEqual([
      makeTestWorkspace({ name: "a" }),
      makeTestWorkspace({ name: "b" }),
      makeTestWorkspace({ name: "c" }),
      makeTestWorkspace({ name: "d" }),
    ]);
  });

  test("preserves edges to non-cycle workspaces when cycle nodes have outside connections", () => {
    // e depends on a; a and b form a cycle; e is not part of the cycle
    const workspaces = [
      makeTestWorkspace({
        name: "a",
        dependencies: ["b"],
        dependents: ["b", "e"],
      }),
      makeTestWorkspace({ name: "b", dependencies: ["a"], dependents: ["a"] }),
      makeTestWorkspace({ name: "e", dependencies: ["a"] }),
    ];
    const { workspaces: result, cycles } = preventDependencyCycles(workspaces);
    expect(cycles).toEqual([{ dependency: "a", dependent: "b" }]);
    // Edges between cycle nodes {a,b} are removed; e→a is preserved
    expect(result).toEqual([
      makeTestWorkspace({ name: "a", dependents: ["e"] }),
      makeTestWorkspace({ name: "b" }),
      makeTestWorkspace({ name: "e", dependencies: ["a"] }),
    ]);
  });
});
