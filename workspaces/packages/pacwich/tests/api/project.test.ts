import type { ScriptDetails, Workspace } from "../../src";
import { logger } from "../../src/internal/logger";
import {
  createFileSystemProject,
  __resetDeprecatedMapWarnings,
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

const createDefaultProject = () =>
  createFileSystemProject({
    rootDirectory: getProjectRoot("fullProject"),
  });

const stripToName = (workspace: Workspace) => workspace.name;

const stripMetadataToWorkspaceNames = (
  metadata: Record<string, ScriptDetails>,
) =>
  Object.values(metadata).reduce(
    (acc, { name, workspaces }) => ({
      ...acc,
      [name]: {
        name,
        workspaces: workspaces.map(stripToName),
      },
    }),
    {},
  );

describe("Test Project utilities", () => {
  describe("properties", () => {
    test("exposes rootDirectory", () => {
      const project = createDefaultProject();
      expect(project.rootDirectory).toEqual(getProjectRoot("fullProject"));
    });

    test("exposes sourceType", () => {
      const project = createDefaultProject();
      expect(project.sourceType).toEqual("fileSystem");
    });

    test("exposes workspaces", () => {
      const project = createDefaultProject();
      expect(project.workspaces).toEqual([
        makeTestWorkspace({
          name: "application-a",
          path: "applications/applicationA",
          matchPattern: "applications/*",
          scripts: ["a-workspaces", "all-workspaces", "application-a"],
        }),
        makeTestWorkspace({
          name: "application-b",
          path: "applications/applicationB",
          matchPattern: "applications/*",
          scripts: ["all-workspaces", "application-b", "b-workspaces"],
        }),
        makeTestWorkspace({
          name: "library-a",
          path: "libraries/libraryA",
          matchPattern: "libraries/**/*",
          scripts: ["a-workspaces", "all-workspaces", "library-a"],
        }),
        makeTestWorkspace({
          name: "library-b",
          path: "libraries/libraryB",
          matchPattern: "libraries/**/*",
          scripts: ["all-workspaces", "b-workspaces", "library-b"],
        }),
        makeTestWorkspace({
          name: "library-c",
          path: "libraries/nested/libraryC",
          matchPattern: "libraries/**/*",
          scripts: ["all-workspaces", "c-workspaces", "library-c"],
        }),
      ]);
    });
  });

  describe("findWorkspaceByName", () => {
    test("returns null for unknown workspace", () => {
      const project = createDefaultProject();
      expect(project.findWorkspaceByName("not-a-workspace")).toBeNull();
    });

    test("finds application workspace by name", () => {
      const project = createDefaultProject();
      const workspace = project.findWorkspaceByName("application-a");
      expect(workspace?.name).toEqual("application-a");
      expect(workspace?.path).toEqual("applications/applicationA");
      expect(workspace?.scripts).toEqual([
        "a-workspaces",
        "all-workspaces",
        "application-a",
      ]);
      expect(workspace?.matchPattern).toEqual("applications/*");
    });

    test("finds nested library workspace by name", () => {
      const project = createDefaultProject();
      const workspace = project.findWorkspaceByName("library-c");
      expect(workspace?.name).toEqual("library-c");
      expect(workspace?.path).toEqual("libraries/nested/libraryC");
      expect(workspace?.scripts).toEqual([
        "all-workspaces",
        "c-workspaces",
        "library-c",
      ]);
      expect(workspace?.matchPattern).toEqual("libraries/**/*");
    });
  });

  describe("findWorkspacesByPattern", () => {
    test("returns empty for unknown workspace", () => {
      const project = createDefaultProject();
      expect(project.findWorkspacesByPattern("not-a-workspace")).toEqual([]);
    });

    test("returns empty for empty pattern", () => {
      const project = createDefaultProject();
      expect(project.findWorkspacesByPattern("").map(stripToName)).toEqual([]);
    });

    test("matches all with wildcard", () => {
      const project = createDefaultProject();
      expect(project.findWorkspacesByPattern("*").map(stripToName)).toEqual([
        "application-a",
        "application-b",
        "library-a",
        "library-b",
        "library-c",
      ]);
    });

    test("matches by name prefix", () => {
      const project = createDefaultProject();
      expect(
        project.findWorkspacesByPattern("application-*").map(stripToName),
      ).toEqual(["application-a", "application-b"]);

      expect(
        project.findWorkspacesByPattern("library-*").map(stripToName),
      ).toEqual(["library-a", "library-b", "library-c"]);
    });

    test("matches exact name", () => {
      const project = createDefaultProject();
      expect(
        project.findWorkspacesByPattern("library-c").map(stripToName),
      ).toEqual(["library-c"]);
    });

    test("matches exact name with trailing wildcard", () => {
      const project = createDefaultProject();
      expect(
        project.findWorkspacesByPattern("library-c*").map(stripToName),
      ).toEqual(["library-c"]);
    });

    test("matches by name suffix", () => {
      const project = createDefaultProject();
      expect(project.findWorkspacesByPattern("*-c").map(stripToName)).toEqual([
        "library-c",
      ]);

      expect(project.findWorkspacesByPattern("*-b").map(stripToName)).toEqual([
        "application-b",
        "library-b",
      ]);
    });

    test("matches complex infix pattern", () => {
      const project = createDefaultProject();
      expect(
        project.findWorkspacesByPattern("*a*-a*").map(stripToName),
      ).toEqual(["application-a", "library-a"]);
    });

    test("matches multi-wildcard pattern", () => {
      const project = createDefaultProject();
      expect(
        project.findWorkspacesByPattern("**b****-*b**").map(stripToName),
      ).toEqual(["library-b"]);
    });

    test("combines path and name specifiers", () => {
      const project = createDefaultProject();
      expect(
        project
          .findWorkspacesByPattern("path:libraries/*", "name:*-a")
          .map(stripToName),
      ).toEqual(["application-a", "library-a", "library-b"]);
    });

    test("combines path and alias specifiers", () => {
      const project = createDefaultProject();
      expect(
        project
          .findWorkspacesByPattern(
            "path:libraries/**/*",
            "alias:does-not-exist",
          )
          .map(stripToName),
      ).toEqual(["library-a", "library-b", "library-c"]);
    });

    test("combines alias, name, and path specifiers with aliases project", () => {
      const projectWithAliases = createFileSystemProject({
        rootDirectory: getProjectRoot("workspaceConfigFileOnly"),
      });

      expect(
        projectWithAliases
          .findWorkspacesByPattern(
            "alias:libA",
            "name:library-1b",
            "path:applications/*a",
          )
          .map(stripToName),
      ).toEqual(["application-1a", "library-1a", "library-1b"]);
    });

    test("returns empty when called with no patterns", () => {
      const project = createDefaultProject();
      expect(project.findWorkspacesByPattern()).toEqual([]);
    });

    test("returns empty when given only negation patterns (no positive set)", () => {
      const project = createDefaultProject();
      expect(
        project.findWorkspacesByPattern("not:library-*").map(stripToName),
      ).toEqual([]);
      expect(
        project
          .findWorkspacesByPattern("not:library-*", "not:application-*")
          .map(stripToName),
      ).toEqual([]);
    });

    test("subtracts negations from a positive set", () => {
      const project = createDefaultProject();
      expect(
        project.findWorkspacesByPattern("*", "not:library-*").map(stripToName),
      ).toEqual(["application-a", "application-b"]);
    });

    test("supports not:re: combined prefix", () => {
      const project = createDefaultProject();
      expect(
        project
          .findWorkspacesByPattern("*", "not:re:^library-")
          .map(stripToName),
      ).toEqual(["application-a", "application-b"]);
    });

    test("de-duplicates workspaces matched by overlapping patterns", () => {
      const project = createDefaultProject();
      expect(
        project
          .findWorkspacesByPattern("library-*", "library-*")
          .map(stripToName),
      ).toEqual(["library-a", "library-b", "library-c"]);
      expect(
        project
          .findWorkspacesByPattern("library-a", "name:library-a", "*-a")
          .map(stripToName),
      ).toEqual(["application-a", "library-a"]);
    });
  });

  describe("listWorkspacesWithScript", () => {
    test("lists all workspaces for shared script", () => {
      const project = createDefaultProject();
      expect(project.listWorkspacesWithScript("all-workspaces")).toEqual([
        makeTestWorkspace({
          name: "application-a",
          path: "applications/applicationA",
          matchPattern: "applications/*",
          scripts: ["a-workspaces", "all-workspaces", "application-a"],
        }),
        makeTestWorkspace({
          name: "application-b",
          path: "applications/applicationB",
          matchPattern: "applications/*",
          scripts: ["all-workspaces", "application-b", "b-workspaces"],
        }),
        makeTestWorkspace({
          name: "library-a",
          path: "libraries/libraryA",
          matchPattern: "libraries/**/*",
          scripts: ["a-workspaces", "all-workspaces", "library-a"],
        }),
        makeTestWorkspace({
          name: "library-b",
          path: "libraries/libraryB",
          matchPattern: "libraries/**/*",
          scripts: ["all-workspaces", "b-workspaces", "library-b"],
        }),
        makeTestWorkspace({
          name: "library-c",
          path: "libraries/nested/libraryC",
          matchPattern: "libraries/**/*",
          scripts: ["all-workspaces", "c-workspaces", "library-c"],
        }),
      ]);
    });

    test("lists workspaces for group scripts", () => {
      const project = createDefaultProject();
      expect(
        project.listWorkspacesWithScript("a-workspaces").map(stripToName),
      ).toEqual(["application-a", "library-a"]);

      expect(
        project.listWorkspacesWithScript("b-workspaces").map(stripToName),
      ).toEqual(["application-b", "library-b"]);

      expect(
        project.listWorkspacesWithScript("c-workspaces").map(stripToName),
      ).toEqual(["library-c"]);
    });

    test("returns empty for unknown script", () => {
      const project = createDefaultProject();
      expect(project.listWorkspacesWithScript("not-a-script")).toEqual([]);
    });

    test("lists single workspace for workspace-specific scripts", () => {
      const project = createDefaultProject();
      expect(
        project.listWorkspacesWithScript("application-a").map(stripToName),
      ).toEqual(["application-a"]);

      expect(
        project.listWorkspacesWithScript("application-b").map(stripToName),
      ).toEqual(["application-b"]);

      expect(
        project.listWorkspacesWithScript("library-a").map(stripToName),
      ).toEqual(["library-a"]);

      expect(
        project.listWorkspacesWithScript("library-b").map(stripToName),
      ).toEqual(["library-b"]);

      expect(
        project.listWorkspacesWithScript("library-c").map(stripToName),
      ).toEqual(["library-c"]);
    });
  });

  const EXPECTED_SCRIPT_MAP = {
    "all-workspaces": {
      name: "all-workspaces",
      workspaces: [
        "application-a",
        "application-b",
        "library-a",
        "library-b",
        "library-c",
      ],
    },
    "a-workspaces": {
      name: "a-workspaces",
      workspaces: ["application-a", "library-a"],
    },
    "b-workspaces": {
      name: "b-workspaces",
      workspaces: ["application-b", "library-b"],
    },
    "c-workspaces": {
      name: "c-workspaces",
      workspaces: ["library-c"],
    },
    "application-a": {
      name: "application-a",
      workspaces: ["application-a"],
    },
    "application-b": {
      name: "application-b",
      workspaces: ["application-b"],
    },
    "library-a": {
      name: "library-a",
      workspaces: ["library-a"],
    },
    "library-b": {
      name: "library-b",
      workspaces: ["library-b"],
    },
    "library-c": {
      name: "library-c",
      workspaces: ["library-c"],
    },
  };

  describe("scriptMap", () => {
    test("maps all scripts to their workspaces", () => {
      const project = createDefaultProject();
      expect(stripMetadataToWorkspaceNames(project.scriptMap)).toEqual(
        EXPECTED_SCRIPT_MAP,
      );
    });
  });

  describe("mapScriptsToWorkspaces (deprecated)", () => {
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

    test("returns the same data as scriptMap", () => {
      const project = createDefaultProject();
      expect(
        stripMetadataToWorkspaceNames(project.mapScriptsToWorkspaces()),
      ).toEqual(EXPECTED_SCRIPT_MAP);
    });

    test("warns once per process pointing at scriptMap", () => {
      const project = createDefaultProject();
      project.mapScriptsToWorkspaces();
      project.mapScriptsToWorkspaces();
      project.mapScriptsToWorkspaces();
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Project.scriptMap"),
      );
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("mapScriptsToWorkspaces"),
      );
    });
  });
});
