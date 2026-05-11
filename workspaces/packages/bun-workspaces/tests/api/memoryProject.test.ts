import path from "path";
import { expect, test, describe } from "bun:test";
import { InvalidJSTypeError } from "../../src/internal/core";
import { createMemoryProject } from "../../src/project";
import { WORKSPACE_ERRORS, type Workspace } from "../../src/workspaces";
import { makeTestWorkspace } from "../util/testData";
import { withWindowsPath } from "../util/windows";

describe("createMemoryProject - type validation", () => {
  test("throws for non-array workspaces", () => {
    expect(() =>
      createMemoryProject({ workspaces: "oops" as unknown as [] }),
    ).toThrow(InvalidJSTypeError);
  });

  test("throws for workspaces with non-object items", () => {
    expect(() =>
      createMemoryProject({ workspaces: ["oops"] as unknown as [] }),
    ).toThrow(InvalidJSTypeError);
  });

  test("throws for non-string name", () => {
    expect(() =>
      createMemoryProject({
        workspaces: [],
        name: 123 as unknown as string,
      }),
    ).toThrow(InvalidJSTypeError);
  });

  test("throws for non-string rootDirectory", () => {
    expect(() =>
      createMemoryProject({
        workspaces: [],
        rootDirectory: 123 as unknown as string,
      }),
    ).toThrow(InvalidJSTypeError);
  });

  test("throws for non-object rootWorkspace", () => {
    expect(() =>
      createMemoryProject({
        workspaces: [],
        rootWorkspace: "oops" as unknown as Workspace,
      }),
    ).toThrow(InvalidJSTypeError);
  });

  test("throws for workspaces item with invalid member", () => {
    expect(() =>
      createMemoryProject({
        workspaces: [makeTestWorkspace({ name: 123 as unknown as string })],
      }),
    ).toThrow(InvalidJSTypeError);
  });

  test("throws for rootWorkspace with invalid member", () => {
    expect(() =>
      createMemoryProject({
        workspaces: [],
        rootWorkspace: makeTestWorkspace({ name: 123 as unknown as string }),
      }),
    ).toThrow(InvalidJSTypeError);
  });

  test("throws for non-boolean includeRootWorkspace", () => {
    expect(() =>
      createMemoryProject({
        workspaces: [],
        includeRootWorkspace: "yes" as unknown as boolean,
      }),
    ).toThrow(InvalidJSTypeError);
  });

  test("does not throw for valid options", () => {
    expect(() => createMemoryProject({ workspaces: [] })).not.toThrow(
      InvalidJSTypeError,
    );
  });
});

describe("MemoryProject", () => {
  test("creates empty project with defaults", () => {
    const plainProject = createMemoryProject({
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
      name: "test-project",
      rootDirectory: "test-project-directory",
      workspaces: [testWs1, testWs2],
    });

  test("creates project with workspaces and properties", () => {
    const projectWithData = createTestProject();
    expect(projectWithData.sourceType).toEqual("memory");
    expect(projectWithData.rootDirectory).toEqual(
      withWindowsPath("test-project-directory"),
    );
    expect(projectWithData.workspaces).toEqual([testWs1, testWs2]);
    expect(projectWithData.name).toEqual("test-project");
  });

  test("createScriptCommand works", () => {
    const projectWithData = createTestProject();
    expect(
      projectWithData.createScriptCommand({
        args: "",
        method: "cd",
        scriptName: "test-script",
        workspaceNameOrAlias: "test-1",
      }),
    ).toEqual({
      commandDetails: {
        workingDirectory: path.resolve(
          projectWithData.rootDirectory,
          withWindowsPath("test/test-1"),
        ),
        command: `bun --silent run test-script`,
      },
      scriptName: "test-script",
      workspace: testWs1,
    });
  });

  test("mapScriptsToWorkspaces works", () => {
    const projectWithData = createTestProject();
    expect(projectWithData.mapScriptsToWorkspaces()).toEqual({
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
    // default target tests name and alias
    expect(projectWithData.findWorkspacesByPattern("re:^test-[12]$")).toEqual([
      testWs1,
      testWs2,
    ]);
    expect(projectWithData.findWorkspacesByPattern("re:2-alias$")).toEqual([
      testWs2,
    ]);
    // target:re: scopes the match
    expect(projectWithData.findWorkspacesByPattern("name:re:-1$")).toEqual([
      testWs1,
    ]);
    expect(projectWithData.findWorkspacesByPattern("alias:re:-1$")).toEqual([]);
  });

  test("throws for duplicate workspace name", () => {
    expect(() =>
      createMemoryProject({
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
});
