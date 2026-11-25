import { logger } from "../../src/internal/logger";
import {
  __resetDeprecatedMapWarnings,
  createFileSystemProject,
} from "../../src/project";
import { getProjectRoot } from "../fixtures/testProjects";
import { makeTestWorkspace } from "../util/testData";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  spyOn,
  test,
} from "../util/testFramework";

const makeProject = () =>
  createFileSystemProject({ rootDirectory: getProjectRoot("workspaceTags") });

const appA = makeTestWorkspace({
  name: "application-1a",
  aliases: ["appA"],
  path: "applications/applicationA",
  matchPattern: "applications/*",
  scripts: ["a-workspaces", "all-workspaces", "application-a"],
  tags: ["app", "workspace"],
});

const appB = makeTestWorkspace({
  name: "application-1b",
  aliases: ["appB"],
  path: "applications/applicationB",
  matchPattern: "applications/*",
  scripts: ["all-workspaces", "application-b", "b-workspaces"],
  tags: ["workspace", "app"],
});

const libA = makeTestWorkspace({
  name: "library-1a",
  aliases: ["libA"],
  path: "libraries/libraryA",
  matchPattern: "libraries/*",
  scripts: ["a-workspaces", "all-workspaces", "library-a"],
  tags: ["lib", "workspace"],
});

const libB = makeTestWorkspace({
  name: "library-1b",
  aliases: ["libB"],
  path: "libraries/libraryB",
  matchPattern: "libraries/*",
  scripts: ["all-workspaces", "b-workspaces", "library-b"],
  tags: ["workspace", "lib"],
});

describe("Workspace tags - API", () => {
  describe("listWorkspacesWithTag", () => {
    test("returns all workspaces with the given tag", () => {
      const project = makeProject();
      expect(project.listWorkspacesWithTag("workspace")).toEqual([
        appA,
        appB,
        libA,
        libB,
      ]);
    });

    test("returns subset of workspaces sharing a tag", () => {
      const project = makeProject();
      expect(project.listWorkspacesWithTag("app")).toEqual([appA, appB]);
      expect(project.listWorkspacesWithTag("lib")).toEqual([libA, libB]);
    });

    test("returns empty array for unknown tag", () => {
      const project = makeProject();
      expect(project.listWorkspacesWithTag("nonexistent")).toEqual([]);
    });
  });

  describe("tagMap", () => {
    test("returns a map of all tags to their workspaces", () => {
      const project = makeProject();
      expect(project.tagMap).toEqual({
        app: { workspaces: [appA, appB] },
        lib: { workspaces: [libA, libB] },
        workspace: { workspaces: [appA, appB, libA, libB] },
      });
    });

    test("tags are sorted alphabetically in the map", () => {
      const project = makeProject();
      expect(Object.keys(project.tagMap)).toEqual(["app", "lib", "workspace"]);
    });
  });

  describe("mapTagsToWorkspaces (deprecated)", () => {
    let warnSpy: ReturnType<typeof spyOn>;

    beforeEach(() => {
      __resetDeprecatedMapWarnings();
      warnSpy = spyOn(logger, "warn").mockImplementation(
        (() => undefined) as unknown as typeof logger.warn,
      );
    });

    afterEach(() => {
      warnSpy.mockRestore();
      __resetDeprecatedMapWarnings();
    });

    test("returns the same data as tagMap", () => {
      const project = makeProject();
      expect(project.mapTagsToWorkspaces()).toEqual({
        app: { workspaces: [appA, appB] },
        lib: { workspaces: [libA, libB] },
        workspace: { workspaces: [appA, appB, libA, libB] },
      });
    });

    test("warns once per process pointing at tagMap", () => {
      const project = makeProject();
      project.mapTagsToWorkspaces();
      project.mapTagsToWorkspaces();
      project.mapTagsToWorkspaces();
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy).toHaveBeenCalledWith("DeprecatedProjectMapMethod", {
        oldName: "mapTagsToWorkspaces",
        newName: "tagMap",
      });
    });
  });

  describe("tags on workspace objects", () => {
    test("workspace tags are present on workspace objects", () => {
      const project = makeProject();
      expect(project.workspaces.map((w) => w.tags)).toEqual([
        ["app", "workspace"],
        ["workspace", "app"],
        ["lib", "workspace"],
        ["workspace", "lib"],
      ]);
    });
  });
});
