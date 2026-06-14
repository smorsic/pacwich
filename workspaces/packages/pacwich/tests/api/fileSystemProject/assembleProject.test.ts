import { resolvePackageManagerAdapter } from "../../../src/packageManager/adapter";
import { assembleProject } from "../../../src/project/implementations/fileSystemProject/assembleProject";
import { WORKSPACE_ERRORS } from "../../../src/workspaces/errors";
import { getProjectRoot } from "../../fixtures/testProjects";
import { loadFixture } from "../../util/fixtures";
import { makeTestWorkspace, makeWorkspaceMapEntry } from "../../util/testData";
import { expect, test, describe } from "../../util/testFramework";

const adapter = resolvePackageManagerAdapter("bun");

const defaultRootWorkspace = makeTestWorkspace({
  name: "test-root",
  isRoot: true,
  path: "",
  matchPattern: "",
});

describe("Test finding workspaces", () => {
  describe("basic behavior", () => {
    test("finds all workspaces in default project", () => {
      const defaultProject = assembleProject({
        adapter,
        rootDirectory: getProjectRoot("default"),
      });

      expect(defaultProject).toEqual({
        rootWorkspace: defaultRootWorkspace,
        workspaces: [
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
        ],
        workspaceMap: {
          "test-root": makeWorkspaceMapEntry({ alias: [] }),
          "application-a": makeWorkspaceMapEntry({}),
          "application-b": makeWorkspaceMapEntry({}),
          "library-a": makeWorkspaceMapEntry({}),
          "library-b": makeWorkspaceMapEntry({}),
          "library-c": makeWorkspaceMapEntry({}),
        },
      });
    });

    test("non-recursive glob excludes nested workspace from match pattern", () => {
      expect(
        assembleProject({
          adapter,
          rootDirectory: getProjectRoot("default"),
          workspaceGlobs: ["applications/*", "libraries/*"],
        }),
      ).toEqual({
        rootWorkspace: defaultRootWorkspace,
        workspaces: [
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
            matchPattern: "libraries/*",
            scripts: ["a-workspaces", "all-workspaces", "library-a"],
          }),
          makeTestWorkspace({
            name: "library-b",
            path: "libraries/libraryB",
            matchPattern: "libraries/*",
            scripts: ["all-workspaces", "b-workspaces", "library-b"],
          }),
          makeTestWorkspace({
            name: "library-c",
            path: "libraries/nested/libraryC",
            matchPattern: "",
            scripts: ["all-workspaces", "c-workspaces", "library-c"],
          }),
        ],
        workspaceMap: {
          "test-root": makeWorkspaceMapEntry({ alias: [] }),
          "application-a": makeWorkspaceMapEntry({}),
          "application-b": makeWorkspaceMapEntry({}),
          "library-a": makeWorkspaceMapEntry({}),
          "library-b": makeWorkspaceMapEntry({}),
          "library-c": makeWorkspaceMapEntry({}),
        },
      });
    });

    test("subset glob shows unmatched workspaces with empty match pattern", () => {
      expect(
        assembleProject({
          adapter,
          rootDirectory: getProjectRoot("default"),
          workspaceGlobs: ["applications/*"],
        }),
      ).toEqual({
        rootWorkspace: defaultRootWorkspace,
        workspaces: [
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
            matchPattern: "",
            scripts: ["a-workspaces", "all-workspaces", "library-a"],
          }),
          makeTestWorkspace({
            name: "library-b",
            path: "libraries/libraryB",
            matchPattern: "",
            scripts: ["all-workspaces", "b-workspaces", "library-b"],
          }),
          makeTestWorkspace({
            name: "library-c",
            path: "libraries/nested/libraryC",
            matchPattern: "",
            scripts: ["all-workspaces", "c-workspaces", "library-c"],
          }),
        ],
        workspaceMap: {
          "test-root": makeWorkspaceMapEntry({ alias: [] }),
          "application-a": makeWorkspaceMapEntry({}),
          "application-b": makeWorkspaceMapEntry({}),
          "library-a": makeWorkspaceMapEntry({}),
          "library-b": makeWorkspaceMapEntry({}),
          "library-c": makeWorkspaceMapEntry({}),
        },
      });
    });
  });

  test("ignores node_modules workspace", () => {
    const defaultProject = assembleProject({
      adapter,
      rootDirectory: getProjectRoot("withNodeModuleWorkspace"),
    });

    expect(defaultProject).toEqual({
      rootWorkspace: defaultRootWorkspace,
      workspaces: [
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
      ],
      workspaceMap: {
        "test-root": makeWorkspaceMapEntry({ alias: [] }),
        "application-a": makeWorkspaceMapEntry({}),
        "application-b": makeWorkspaceMapEntry({}),
        "library-a": makeWorkspaceMapEntry({}),
        "library-b": makeWorkspaceMapEntry({}),
        "library-c": makeWorkspaceMapEntry({}),
      },
    });
  });

  describe("invalid projects", () => {
    test("throws for bad JSON", () => {
      expect(() =>
        assembleProject({
          adapter,
          rootDirectory: getProjectRoot("invalidBadJson"),
        }),
      ).toThrow(WORKSPACE_ERRORS.InvalidPackageJson);
    });

    test("throws for missing name", () => {
      expect(() =>
        assembleProject({
          adapter,
          rootDirectory: loadFixture("invalidNoName"),
        }),
      ).toThrow(WORKSPACE_ERRORS.NoWorkspaceName);
    });

    test("throws for duplicate name", () => {
      expect(() =>
        assembleProject({
          adapter,
          rootDirectory: loadFixture("invalidDuplicateName"),
        }),
      ).toThrow(WORKSPACE_ERRORS.DuplicateWorkspaceName);
    });

    test("throws for duplicate alias", () => {
      expect(() =>
        assembleProject({
          adapter,
          rootDirectory: getProjectRoot("invalidDuplicateAlias"),
        }),
      ).toThrow(WORKSPACE_ERRORS.AliasConflict);
    });

    test("throws for invalid workspace name", () => {
      expect(() =>
        assembleProject({
          adapter,
          rootDirectory: getProjectRoot("badWorkspaceInvalidName"),
        }),
      ).toThrow(WORKSPACE_ERRORS.InvalidWorkspaceName);
    });

    test("throws for bad type workspaces", () => {
      expect(() =>
        assembleProject({
          adapter,
          rootDirectory: getProjectRoot("invalidBadTypeWorkspaces"),
        }),
      ).toThrow(WORKSPACE_ERRORS.InvalidWorkspaces);
    });

    test("throws for invalid scripts type", () => {
      expect(() =>
        assembleProject({
          adapter,
          rootDirectory: getProjectRoot("invalidBadTypeScripts"),
        }),
      ).toThrow(WORKSPACE_ERRORS.InvalidScripts);
    });

    test("throws for missing package.json", () => {
      expect(() =>
        assembleProject({
          adapter,
          rootDirectory: getProjectRoot("invalidNoPackageJson"),
        }),
      ).toThrow(WORKSPACE_ERRORS.PackageNotFound);
    });

    test("throws for bad workspace glob type", () => {
      expect(() =>
        assembleProject({
          adapter,
          rootDirectory: getProjectRoot("invalidBadWorkspaceGlobType"),
        }),
      ).toThrow(WORKSPACE_ERRORS.InvalidWorkspacePattern);
    });

    test("throws for workspace glob outside root", () => {
      expect(() =>
        assembleProject({
          adapter,
          rootDirectory: getProjectRoot("invalidBadWorkspaceGlobOutsideRoot"),
        }),
      ).toThrow(WORKSPACE_ERRORS.InvalidWorkspacePattern);
    });

    test("throws for alias conflicting with workspace name", () => {
      expect(() =>
        assembleProject({
          adapter,
          rootDirectory: getProjectRoot("invalidAliasConflict"),
        }),
      ).toThrow(WORKSPACE_ERRORS.AliasConflict);
    });
  });

  test("finds workspaces with catalog form", () => {
    const defaultProject = assembleProject({
      adapter,
      rootDirectory: getProjectRoot("withCatalogSimple"),
    });
    expect(defaultProject).toEqual({
      rootWorkspace: defaultRootWorkspace,
      workspaces: [
        makeTestWorkspace({
          name: "application-1a",
          path: "applications/applicationA",
          matchPattern: "applications/*",
          scripts: ["a-workspaces", "all-workspaces", "application-a"],
        }),
        makeTestWorkspace({
          name: "application-1b",
          path: "applications/applicationB",
          matchPattern: "applications/*",
          scripts: ["all-workspaces", "application-b", "b-workspaces"],
        }),
        makeTestWorkspace({
          name: "library-1a",
          path: "libraries/libraryA",
          matchPattern: "libraries/*",
          scripts: ["a-workspaces", "all-workspaces", "library-a"],
        }),
        makeTestWorkspace({
          name: "library-1b",
          path: "libraries/libraryB",
          matchPattern: "libraries/*",
          scripts: ["all-workspaces", "b-workspaces", "library-b"],
        }),
      ],
      workspaceMap: {
        "test-root": makeWorkspaceMapEntry({ alias: [] }),
        "application-1a": makeWorkspaceMapEntry({}),
        "application-1b": makeWorkspaceMapEntry({}),
        "library-1a": makeWorkspaceMapEntry({}),
        "library-1b": makeWorkspaceMapEntry({}),
      },
    });
  });

  test("includes root workspace when configured", () => {
    const defaultProject = assembleProject({
      adapter,
      rootDirectory: getProjectRoot("withRootWorkspace"),
      includeRootWorkspace: true,
    });
    const rootWorkspaceWithConfig = makeTestWorkspace({
      name: "test-root",
      isRoot: true,
      path: "",
      matchPattern: "",
      scripts: ["all-workspaces", "root-workspace"],
      aliases: ["my-root-alias"],
    });
    expect(defaultProject).toEqual({
      rootWorkspace: rootWorkspaceWithConfig,
      workspaces: [
        rootWorkspaceWithConfig,
        makeTestWorkspace({
          name: "application-1a",
          path: "applications/applicationA",
          matchPattern: "applications/*",
          scripts: ["a-workspaces", "all-workspaces", "application-a"],
        }),
        makeTestWorkspace({
          name: "application-1b",
          path: "applications/applicationB",
          matchPattern: "applications/*",
          scripts: ["all-workspaces", "application-b", "b-workspaces"],
        }),
        makeTestWorkspace({
          name: "library-1a",
          path: "libraries/libraryA",
          matchPattern: "libraries/*",
          scripts: ["a-workspaces", "all-workspaces", "library-a"],
        }),
        makeTestWorkspace({
          name: "library-1b",
          path: "libraries/libraryB",
          matchPattern: "libraries/*",
          scripts: ["all-workspaces", "b-workspaces", "library-b"],
        }),
      ],
      workspaceMap: {
        "test-root": makeWorkspaceMapEntry({ alias: ["my-root-alias"] }),
        "application-1a": makeWorkspaceMapEntry({}),
        "application-1b": makeWorkspaceMapEntry({}),
        "library-1a": makeWorkspaceMapEntry({}),
        "library-1b": makeWorkspaceMapEntry({}),
      },
    });
  });

  test("matchPattern matched for variety of workspace globs", () => {
    const { workspaces } = assembleProject({
      adapter,
      rootDirectory: getProjectRoot("simpleWorkspaceGlobs"),
    });
    expect(workspaces).toEqual([
      makeTestWorkspace({
        name: "application-1a",
        aliases: ["appA"],
        path: "applications/applicationA",
        matchPattern: "applications/*",
        scripts: ["a-workspaces", "all-workspaces", "application-a"],
      }),
      makeTestWorkspace({
        name: "application-1b",
        aliases: ["appB"],
        path: "applications/applicationB",
        matchPattern: "applications/*",
        scripts: ["all-workspaces", "application-b", "b-workspaces"],
      }),
      makeTestWorkspace({
        name: "library-1a",
        aliases: ["libA"],
        path: "libraries/libraryA",
        matchPattern: "libraries/libraryA",
        scripts: ["a-workspaces", "all-workspaces", "library-a"],
      }),
      makeTestWorkspace({
        name: "library-1b",
        aliases: ["libB"],
        path: "libraries/libraryB",
        matchPattern: "libraries/libraryB/",
        scripts: ["all-workspaces", "b-workspaces", "library-b"],
      }),
      makeTestWorkspace({
        name: "package-a",
        aliases: ["pa"],
        path: "packageA",
        matchPattern: "packageA/",
        scripts: ["a-workspaces", "all-workspaces", "package-a"],
      }),
      makeTestWorkspace({
        name: "package-b",
        aliases: ["pb"],
        path: "packageB",
        matchPattern: "packageB",
        scripts: ["all-workspaces", "b-workspaces", "package-b"],
      }),
      makeTestWorkspace({
        name: "package-c",
        aliases: ["pc"],
        path: "packageC",
        matchPattern: "packageC//",
        scripts: ["all-workspaces", "c-workspaces", "package-c"],
      }),
    ]);
  });
});
