import { InvalidJSTypeError } from "../../src/internal/core";
import { createMemoryProject } from "../../src/project";
import { WORKSPACE_ERRORS, type Workspace } from "../../src/workspaces";
import { makeTestWorkspace } from "../util/testData";
import { expect, test, describe } from "../util/testFramework";

describe("createMemoryProject - type validation", () => {
  test("throws for non-array workspaces", () => {
    expect(() =>
      createMemoryProject({
        packageManager: "bun",
        workspaces: "oops" as unknown as [],
      }),
    ).toThrow(InvalidJSTypeError);
  });

  test("throws for workspaces with non-object items", () => {
    expect(() =>
      createMemoryProject({
        packageManager: "bun",
        workspaces: ["oops"] as unknown as [],
      }),
    ).toThrow(InvalidJSTypeError);
  });

  test("throws for non-string name", () => {
    expect(() =>
      createMemoryProject({
        packageManager: "bun",
        workspaces: [],
        name: 123 as unknown as string,
      }),
    ).toThrow(InvalidJSTypeError);
  });

  test("throws for non-string rootDirectory", () => {
    expect(() =>
      createMemoryProject({
        packageManager: "bun",
        workspaces: [],
        rootDirectory: 123 as unknown as string,
      }),
    ).toThrow(InvalidJSTypeError);
  });

  test("throws for non-object rootWorkspace", () => {
    expect(() =>
      createMemoryProject({
        packageManager: "bun",
        workspaces: [],
        rootWorkspace: "oops" as unknown as Workspace,
      }),
    ).toThrow(InvalidJSTypeError);
  });

  test("throws for workspaces item with invalid member", () => {
    expect(() =>
      createMemoryProject({
        packageManager: "bun",
        workspaces: [makeTestWorkspace({ name: 123 as unknown as string })],
      }),
    ).toThrow(InvalidJSTypeError);
  });

  test("throws for rootWorkspace with invalid member", () => {
    expect(() =>
      createMemoryProject({
        packageManager: "bun",
        workspaces: [],
        rootWorkspace: makeTestWorkspace({ name: 123 as unknown as string }),
      }),
    ).toThrow(InvalidJSTypeError);
  });

  test("throws for non-boolean includeRootWorkspace", () => {
    expect(() =>
      createMemoryProject({
        packageManager: "bun",
        workspaces: [],
        includeRootWorkspace: "yes" as unknown as boolean,
      }),
    ).toThrow(InvalidJSTypeError);
  });

  test("does not throw for valid options", () => {
    expect(() =>
      createMemoryProject({ packageManager: "bun", workspaces: [] }),
    ).not.toThrow(InvalidJSTypeError);
  });
});

describe("MemoryProject", () => {
  test("creates empty project with defaults", () => {
    const plainProject = createMemoryProject({
      packageManager: "bun",
      workspaces: [],
    });

    expect(plainProject.sourceType).toEqual("memory");
    expect(plainProject.rootDirectory).toEqual("");
    expect(plainProject.workspaces).toEqual([]);
    expect(plainProject.name).toEqual("");
  });

  const testWs1 = makeTestWorkspace({
    name: "test-1",
    path: "test/test-1",
    matchPattern: "test/*",
    scripts: ["test-script"],
  });
  const testWs2 = makeTestWorkspace({
    name: "test-2",
    path: "test/test-2",
    matchPattern: "test/*",
    scripts: ["test-script"],
    aliases: ["test-2-alias"],
  });

  const createTestProject = () =>
    createMemoryProject({
      packageManager: "bun",
      name: "test-project",
      rootDirectory: "test-project-directory",
      workspaces: [testWs1, testWs2],
    });

  test("creates project with workspaces and properties", () => {
    const projectWithData = createTestProject();
    expect(projectWithData.sourceType).toEqual("memory");
    expect(projectWithData.rootDirectory).toEqual("test-project-directory");
    expect(projectWithData.workspaces).toEqual([testWs1, testWs2]);
    expect(projectWithData.name).toEqual("test-project");
  });

  test("scriptMap works", () => {
    const projectWithData = createTestProject();
    expect(projectWithData.scriptMap).toEqual({
      "test-script": {
        name: "test-script",
        workspaces: [testWs1, testWs2],
      },
    });
  });

  test("findWorkspaceByName finds or returns null", () => {
    const projectWithData = createTestProject();
    expect(projectWithData.findWorkspaceByName("test-1")).toEqual(testWs1);
    expect(projectWithData.findWorkspaceByName("test-2")).toEqual(testWs2);
    expect(projectWithData.findWorkspaceByName("not-a-workspace")).toBeNull();
  });

  test("findWorkspaceByAlias finds or returns null", () => {
    const projectWithData = createTestProject();
    expect(projectWithData.findWorkspaceByAlias("test-1-alias")).toBeNull();
    expect(projectWithData.findWorkspaceByAlias("test-2-alias")).toEqual(
      testWs2,
    );
    expect(projectWithData.findWorkspaceByAlias("not-a-alias")).toBeNull();
  });

  test("findWorkspaceByNameOrAlias finds by name or alias", () => {
    const projectWithData = createTestProject();
    expect(projectWithData.findWorkspaceByNameOrAlias("test-1")).toEqual(
      testWs1,
    );
    expect(projectWithData.findWorkspaceByNameOrAlias("test-2")).toEqual(
      testWs2,
    );
    expect(
      projectWithData.findWorkspaceByNameOrAlias("not-a-workspace"),
    ).toBeNull();

    expect(
      projectWithData.findWorkspaceByNameOrAlias("test-1-alias"),
    ).toBeNull();
    expect(projectWithData.findWorkspaceByNameOrAlias("test-2-alias")).toEqual(
      testWs2,
    );
    expect(
      projectWithData.findWorkspaceByNameOrAlias("not-a-alias"),
    ).toBeNull();
  });

  test("findWorkspacesByPattern matches patterns", () => {
    const projectWithData = createTestProject();
    expect(projectWithData.findWorkspacesByPattern("test-*")).toEqual([
      testWs1,
      testWs2,
    ]);

    expect(projectWithData.findWorkspacesByPattern("*-2")).toEqual([testWs2]);
    expect(projectWithData.findWorkspacesByPattern("not-a-pattern")).toEqual(
      [],
    );
  });

  test("findWorkspacesByPattern supports re: regex patterns", () => {
    const projectWithData = createTestProject();
    // default target regex matches name only — matches both workspaces here
    expect(projectWithData.findWorkspacesByPattern("re:^test-[12]$")).toEqual([
      testWs1,
      testWs2,
    ]);
    // default-target regex does not match against aliases — "test-2-alias" is alias-only
    expect(projectWithData.findWorkspacesByPattern("re:2-alias$")).toEqual([]);
    expect(
      projectWithData.findWorkspacesByPattern("alias:re:2-alias$"),
    ).toEqual([testWs2]);
    // target:re: scopes the match
    expect(projectWithData.findWorkspacesByPattern("name:re:-1$")).toEqual([
      testWs1,
    ]);
    expect(projectWithData.findWorkspacesByPattern("alias:re:-1$")).toEqual([]);
  });

  test("findWorkspacesByPattern with no arguments returns empty", () => {
    const projectWithData = createTestProject();
    expect(projectWithData.findWorkspacesByPattern()).toEqual([]);
  });

  test("findWorkspacesByPattern with only negations returns empty", () => {
    const projectWithData = createTestProject();
    expect(projectWithData.findWorkspacesByPattern("not:test-*")).toEqual([]);
    expect(projectWithData.findWorkspacesByPattern("not:test-1")).toEqual([]);
  });

  test("findWorkspacesByPattern subtracts negations from a positive set", () => {
    const projectWithData = createTestProject();
    expect(
      projectWithData.findWorkspacesByPattern("test-*", "not:test-1"),
    ).toEqual([testWs2]);
    expect(
      projectWithData.findWorkspacesByPattern("test-*", "not:re:-1$"),
    ).toEqual([testWs2]);
  });

  test("findWorkspacesByPattern de-duplicates overlapping matches", () => {
    const projectWithData = createTestProject();
    expect(projectWithData.findWorkspacesByPattern("test-*", "test-*")).toEqual(
      [testWs1, testWs2],
    );
    expect(
      projectWithData.findWorkspacesByPattern("test-1", "name:test-1", "*-1"),
    ).toEqual([testWs1]);
  });

  test("throws for duplicate workspace name", () => {
    expect(() =>
      createMemoryProject({
        packageManager: "bun",
        workspaces: [
          makeTestWorkspace({
            name: "test-1",
            path: "test/test-1",
            matchPattern: "test/*",
            scripts: ["test-script"],
          }),
          makeTestWorkspace({
            name: "test-1",
            path: "test/test-1",
            matchPattern: "test/*",
            scripts: ["test-script"],
          }),
        ],
      }),
    ).toThrow(WORKSPACE_ERRORS.DuplicateWorkspaceName);
  });

  test("throws for duplicate alias", () => {
    expect(() =>
      createMemoryProject({
        packageManager: "bun",
        workspaces: [
          makeTestWorkspace({
            name: "test-1",
            path: "test/test-1",
            matchPattern: "test/*",
            scripts: ["test-script"],
            aliases: ["test-1-alias"],
          }),
          makeTestWorkspace({
            name: "test-2",
            path: "test/test-2",
            matchPattern: "test/*",
            scripts: ["test-script"],
            aliases: ["test-1-alias"],
          }),
        ],
      }),
    ).toThrow(WORKSPACE_ERRORS.AliasConflict);
  });

  test("throws when an alias collides with another workspace's name", () => {
    expect(() =>
      createMemoryProject({
        packageManager: "bun",
        workspaces: [
          makeTestWorkspace({
            name: "test-1",
            path: "test/test-1",
            matchPattern: "test/*",
            scripts: ["test-script"],
            // Alias intentionally matches the other workspace's name
            aliases: ["test-2"],
          }),
          makeTestWorkspace({
            name: "test-2",
            path: "test/test-2",
            matchPattern: "test/*",
            scripts: ["test-script"],
          }),
        ],
      }),
    ).toThrow(WORKSPACE_ERRORS.AliasConflict);
  });
});

describe("createMemoryProject - packageManager option", () => {
  test("throws when packageManager is omitted (required option, no default)", () => {
    expect(() =>
      // @ts-expect-error — packageManager is required; the test
      // intentionally omits it to verify the runtime guard.
      createMemoryProject({ workspaces: [] }),
    ).toThrow(/requires a `packageManager` option/);
  });

  test("explicit 'bun' is reflected on the project", () => {
    const project = createMemoryProject({
      packageManager: "bun",
      workspaces: [],
    });
    expect(project.packageManager).toBe("bun");
  });

  test("explicit 'npm' is reflected on the project", () => {
    const project = createMemoryProject({
      packageManager: "npm",
      workspaces: [],
    });
    expect(project.packageManager).toBe("npm");
  });

  test("rejects a non-enum string with the accepted-values message", () => {
    expect(() =>
      createMemoryProject({
        // Bypass the type to verify the runtime guard.
        packageManager: "yarn" as unknown as "bun",
        workspaces: [],
      }),
    ).toThrow(/Invalid packageManager option/);
  });

  test("rejects 'auto' (memory project has no filesystem to probe)", () => {
    expect(() =>
      createMemoryProject({
        packageManager: "auto" as unknown as "bun",
        workspaces: [],
      }),
    ).toThrow(/Invalid packageManager option/);
  });

  test("rejects a non-string type", () => {
    expect(() =>
      createMemoryProject({
        packageManager: 5 as unknown as "bun",
        workspaces: [],
      }),
    ).toThrow();
  });
});
