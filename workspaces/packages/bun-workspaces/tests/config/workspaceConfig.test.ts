import path from "path";
import { expect, test, describe } from "bun:test";
import { LOAD_CONFIG_ERRORS } from "../../src/config";
import {
  loadWorkspaceConfig,
  validateWorkspaceConfig,
  WORKSPACE_CONFIG_ERRORS,
} from "../../src/config/workspaceConfig";
import { findWorkspaces } from "../../src/workspaces";
import { getProjectRoot } from "../fixtures/testProjects";
import { makeTestWorkspace, makeWorkspaceMapEntry } from "../util/testData";
import { withWindowsPath } from "../util/windows";

/**
 * ########
 * # NOTE #
 * ########
 *
 * The workspace config was the first config to use the current
 * utils for config loading, so these tests are more thorough/verbose
 * than for other config types, which helps cover the shared code used
 * for config loading.
 */

describe("workspace config", () => {
  describe("loadWorkspaceConfig", () => {
    test("returns config for application-a in packageFileMix project", () => {
      const config = loadWorkspaceConfig(
        path.join(
          getProjectRoot("workspaceConfigPackageFileMix"),
          withWindowsPath("applications/application-a"),
        ),
      );
      expect(config).toEqual({
        aliases: ["appA"],
        tags: [],
        rules: {},
        scripts: {
          "all-workspaces": {
            order: 1,
          },
        },
      });
    });

    test("returns config for application-b in packageFileMix project", () => {
      const config = loadWorkspaceConfig(
        path.join(
          getProjectRoot("workspaceConfigPackageFileMix"),
          withWindowsPath("applications/application-b"),
        ),
      );
      expect(config).toEqual({
        aliases: ["appB_file"],
        tags: [],
        rules: {},
        scripts: {
          "all-workspaces": {
            order: 0,
          },
          "b-workspaces": {
            order: 2,
          },
        },
      });
    });

    test("returns config for library-a in packageFileMix project", () => {
      const config = loadWorkspaceConfig(
        path.join(
          getProjectRoot("workspaceConfigPackageFileMix"),
          withWindowsPath("libraries/library-a"),
        ),
      );
      expect(config).toEqual({
        aliases: ["libA_file"],
        tags: [],
        rules: {},
        scripts: {},
      });
    });

    test("returns config for library-b in packageFileMix project", () => {
      const config = loadWorkspaceConfig(
        path.join(
          getProjectRoot("workspaceConfigPackageFileMix"),
          withWindowsPath("libraries/library-b"),
        ),
      );
      expect(config).toEqual({
        aliases: ["libB", "libB2"],
        tags: [],
        rules: {},
        scripts: {
          "all-workspaces": {
            order: 100,
          },
          "b-workspaces": {
            order: 2,
          },
        },
      });
    });

    test("returns empty config for library-c in packageFileMix project", () => {
      const config = loadWorkspaceConfig(
        path.join(
          getProjectRoot("workspaceConfigPackageFileMix"),
          withWindowsPath("libraries/library-c"),
        ),
      );
      expect(config).toEqual({
        aliases: [],
        tags: [],
        rules: {},
        scripts: {},
      });
    });

    test("returns empty config for application-c in packageFileMix project", () => {
      const config = loadWorkspaceConfig(
        path.join(
          getProjectRoot("workspaceConfigPackageFileMix"),
          withWindowsPath("applications/application-c"),
        ),
      );
      expect(config).toEqual({
        aliases: [],
        tags: [],
        rules: {},
        scripts: {},
      });
    });

    test("returns config for application-a in fileOnly project", () => {
      const config = loadWorkspaceConfig(
        path.join(
          getProjectRoot("workspaceConfigFileOnly"),
          withWindowsPath("applications/application-a"),
        ),
      );
      expect(config).toEqual({
        aliases: ["appA"],
        tags: [],
        rules: {},
        scripts: {
          "all-workspaces": {
            order: 1,
          },
        },
      });
    });
  });

  describe("loadWorkspaceConfig with invalid JSON", () => {
    test("throws for application-a", () => {
      expect(() =>
        loadWorkspaceConfig(
          path.join(
            getProjectRoot("workspaceConfigInvalidJson"),
            withWindowsPath("applications/application-a"),
          ),
        ),
      ).toThrow(LOAD_CONFIG_ERRORS.InvalidJSON);
    });

    test("throws for application-b", () => {
      expect(() =>
        loadWorkspaceConfig(
          path.join(
            getProjectRoot("workspaceConfigInvalidJson"),
            withWindowsPath("applications/application-b"),
          ),
        ),
      ).toThrow(LOAD_CONFIG_ERRORS.InvalidJSON);
    });
  });

  describe("validateWorkspaceConfig", () => {
    test("throws when alias is nested array", () => {
      expect(() =>
        validateWorkspaceConfig({
          // @ts-expect-error - Invalid config
          alias: [["invalid"]],
        }),
      ).toThrow(WORKSPACE_CONFIG_ERRORS.InvalidWorkspaceConfig);
    });

    test("throws when alias is object", () => {
      expect(() =>
        validateWorkspaceConfig({
          // @ts-expect-error - Invalid config
          alias: {},
        }),
      ).toThrow(WORKSPACE_CONFIG_ERRORS.InvalidWorkspaceConfig);
    });

    test("throws when alias is number", () => {
      expect(() =>
        validateWorkspaceConfig({
          // @ts-expect-error - Invalid config
          alias: 123,
        }),
      ).toThrow(WORKSPACE_CONFIG_ERRORS.InvalidWorkspaceConfig);
    });

    test("throws when alias array contains non-strings", () => {
      expect(() =>
        validateWorkspaceConfig({
          // @ts-expect-error - Invalid config
          alias: [123, null],
        }),
      ).toThrow(WORKSPACE_CONFIG_ERRORS.InvalidWorkspaceConfig);
    });

    test("does not throw when both allowPatterns and denyPatterns are set in workspaceDependencies rule", () => {
      expect(() =>
        validateWorkspaceConfig({
          rules: {
            workspaceDependencies: {
              allowPatterns: ["my-workspace"],
              denyPatterns: ["other-workspace"],
            },
          },
        }),
      ).not.toThrow();
    });

    describe("inputs / defaultInputs", () => {
      test("accepts defaultInputs with files and workspacePatterns", () => {
        expect(() =>
          validateWorkspaceConfig({
            defaultInputs: {
              files: ["src/**/*.ts", "!src/**/*.test.ts"],
              workspacePatterns: ["tag:lib"],
            },
          }),
        ).not.toThrow();
      });

      test("accepts empty defaultInputs object", () => {
        expect(() =>
          validateWorkspaceConfig({ defaultInputs: {} }),
        ).not.toThrow();
      });

      test("accepts script-level inputs", () => {
        expect(() =>
          validateWorkspaceConfig({
            scripts: {
              build: { inputs: { files: ["src/**/*.ts"] } },
            },
          }),
        ).not.toThrow();
      });

      test("throws when defaultInputs.files contains non-strings", () => {
        expect(() =>
          validateWorkspaceConfig({
            // @ts-expect-error - Invalid config
            defaultInputs: { files: [123] },
          }),
        ).toThrow(WORKSPACE_CONFIG_ERRORS.InvalidWorkspaceConfig);
      });

      test("throws when defaultInputs has unknown property", () => {
        expect(() =>
          validateWorkspaceConfig({
            // @ts-expect-error - Invalid config
            defaultInputs: { extra: ["a"] },
          }),
        ).toThrow(WORKSPACE_CONFIG_ERRORS.InvalidWorkspaceConfig);
      });

      test("throws when script inputs has unknown property", () => {
        expect(() =>
          validateWorkspaceConfig({
            scripts: {
              // @ts-expect-error - Invalid config
              build: { inputs: { extra: ["a"] } },
            },
          }),
        ).toThrow(WORKSPACE_CONFIG_ERRORS.InvalidWorkspaceConfig);
      });
    });
  });

  describe("loadWorkspaceConfig with invalid config", () => {
    test("throws for application-a", () => {
      expect(() =>
        loadWorkspaceConfig(
          path.join(
            getProjectRoot("workspaceConfigInvalidConfig"),
            withWindowsPath("applications/application-a"),
          ),
        ),
      ).toThrow(WORKSPACE_CONFIG_ERRORS.InvalidWorkspaceConfig);
    });

    test("throws for application-b", () => {
      expect(() =>
        loadWorkspaceConfig(
          path.join(
            getProjectRoot("workspaceConfigInvalidConfig"),
            withWindowsPath("applications/application-b"),
          ),
        ),
      ).toThrow(WORKSPACE_CONFIG_ERRORS.InvalidWorkspaceConfig);
    });

    test("throws for application-c", () => {
      expect(() =>
        loadWorkspaceConfig(
          path.join(
            getProjectRoot("workspaceConfigInvalidConfig"),
            withWindowsPath("applications/application-c"),
          ),
        ),
      ).toThrow(WORKSPACE_CONFIG_ERRORS.InvalidWorkspaceConfig);
    });

    test("throws for application-d", () => {
      expect(() =>
        loadWorkspaceConfig(
          path.join(
            getProjectRoot("workspaceConfigInvalidConfig"),
            withWindowsPath("applications/application-d"),
          ),
        ),
      ).toThrow(WORKSPACE_CONFIG_ERRORS.InvalidWorkspaceConfig);
    });

    test("throws for application-e", () => {
      expect(() =>
        loadWorkspaceConfig(
          path.join(
            getProjectRoot("workspaceConfigInvalidConfig"),
            withWindowsPath("applications/application-e"),
          ),
        ),
      ).toThrow(WORKSPACE_CONFIG_ERRORS.InvalidWorkspaceConfig);
    });

    test("throws for application-f", () => {
      expect(() =>
        loadWorkspaceConfig(
          path.join(
            getProjectRoot("workspaceConfigInvalidConfig"),
            withWindowsPath("applications/application-f"),
          ),
        ),
      ).toThrow(WORKSPACE_CONFIG_ERRORS.InvalidWorkspaceConfig);
    });

    test("throws for application-g", () => {
      expect(() =>
        loadWorkspaceConfig(
          path.join(
            getProjectRoot("workspaceConfigInvalidConfig"),
            withWindowsPath("applications/application-g"),
          ),
        ),
      ).toThrow(WORKSPACE_CONFIG_ERRORS.InvalidWorkspaceConfig);
    });

    test("throws for application-h", () => {
      expect(() =>
        loadWorkspaceConfig(
          path.join(
            getProjectRoot("workspaceConfigInvalidConfig"),
            withWindowsPath("applications/application-h"),
          ),
        ),
      ).toThrow(WORKSPACE_CONFIG_ERRORS.InvalidWorkspaceConfig);
    });
  });

  describe("findWorkspaces with workspace configs", () => {
    test("returns expected result for workspaceConfigFileOnly project", () => {
      expect(
        findWorkspaces({
          rootDirectory: getProjectRoot("workspaceConfigFileOnly"),
        }),
      ).toEqual({
        rootWorkspace: expect.any(Object),
        workspaces: [
          makeTestWorkspace({
            name: "application-1a",
            path: "applications/application-a",
            matchPattern: "applications/*",
            scripts: ["a-workspaces", "all-workspaces", "application-a"],
            aliases: ["appA"],
            tags: [],
          }),
          makeTestWorkspace({
            name: "application-1b",
            path: "applications/application-b",
            matchPattern: "applications/*",
            scripts: ["all-workspaces", "application-b", "b-workspaces"],
            aliases: ["appB"],
            tags: [],
          }),
          makeTestWorkspace({
            name: "library-1a",
            path: "libraries/library-a",
            matchPattern: "libraries/*",
            scripts: ["a-workspaces", "all-workspaces", "library-a"],
            aliases: ["libA", "libA2"],
            tags: [],
          }),
          makeTestWorkspace({
            name: "library-1b",
            path: "libraries/library-b",
            matchPattern: "libraries/*",
            scripts: ["all-workspaces", "b-workspaces", "library-b"],
            aliases: ["libB"],
            tags: [],
          }),
        ],
        workspaceMap: {
          "test-root": makeWorkspaceMapEntry({ alias: [] }),
          "application-1a": makeWorkspaceMapEntry({
            alias: ["appA"],
            rules: {},
            scripts: {
              "all-workspaces": {
                order: 1,
              },
            },
          }),
          "application-1b": makeWorkspaceMapEntry({ alias: ["appB"] }),
          "library-1a": makeWorkspaceMapEntry({ alias: ["libA", "libA2"] }),
          "library-1b": makeWorkspaceMapEntry({ alias: ["libB"] }),
        },
      });
    });

    test("returns expected result for workspaceConfigPackageOnly project", () => {
      expect(
        findWorkspaces({
          rootDirectory: getProjectRoot("workspaceConfigPackageOnly"),
        }),
      ).toEqual({
        rootWorkspace: expect.any(Object),
        workspaces: [
          makeTestWorkspace({
            name: "application-1a",
            path: "applications/application-a",
            matchPattern: "applications/*",
            scripts: ["a-workspaces", "all-workspaces", "application-a"],
            aliases: ["appA"],
            tags: [],
          }),
          makeTestWorkspace({
            name: "application-1b",
            path: "applications/application-b",
            matchPattern: "applications/*",
            scripts: ["all-workspaces", "application-b", "b-workspaces"],
            aliases: ["appB", "appB2"],
            tags: [],
          }),
          makeTestWorkspace({
            name: "library-1a",
            path: "libraries/library-a",
            matchPattern: "libraries/*",
            scripts: ["a-workspaces", "all-workspaces", "library-a"],
            aliases: ["libA", "libA2"],
            tags: [],
          }),
          makeTestWorkspace({
            name: "library-1b",
            path: "libraries/library-b",
            matchPattern: "libraries/*",
            scripts: ["all-workspaces", "b-workspaces", "library-b"],
            aliases: ["libB"],
            tags: [],
          }),
        ],
        workspaceMap: {
          "test-root": makeWorkspaceMapEntry({ alias: [] }),
          "application-1a": makeWorkspaceMapEntry({ alias: ["appA"] }),
          "application-1b": makeWorkspaceMapEntry({
            alias: ["appB", "appB2"],
          }),
          "library-1a": makeWorkspaceMapEntry({ alias: ["libA", "libA2"] }),
          "library-1b": makeWorkspaceMapEntry({ alias: ["libB"] }),
        },
      });
    });

    test("returns expected result for workspaceConfigPackageFileMix project", () => {
      expect(
        findWorkspaces({
          rootDirectory: getProjectRoot("workspaceConfigPackageFileMix"),
        }),
      ).toEqual({
        workspaces: [
          makeTestWorkspace({
            name: "application-1a",
            path: "applications/application-a",
            matchPattern: "applications/*",
            scripts: ["a-workspaces", "all-workspaces", "application-a"],
            aliases: ["appA"],
            tags: [],
          }),
          makeTestWorkspace({
            name: "application-1b",
            path: "applications/application-b",
            matchPattern: "applications/*",
            scripts: ["all-workspaces", "application-b", "b-workspaces"],
            aliases: ["appB_file"],
            tags: [],
          }),
          makeTestWorkspace({
            name: "application-1c",
            path: "applications/application-c",
            matchPattern: "applications/*",
            scripts: ["all-workspaces", "application-c", "c-workspaces"],
          }),
          makeTestWorkspace({
            name: "library-1a",
            path: "libraries/library-a",
            matchPattern: "libraries/*",
            scripts: ["a-workspaces", "all-workspaces", "library-a"],
            aliases: ["libA_file"],
            tags: [],
          }),
          makeTestWorkspace({
            name: "library-1b",
            path: "libraries/library-b",
            matchPattern: "libraries/*",
            scripts: ["all-workspaces", "b-workspaces", "library-b"],
            aliases: ["libB", "libB2"],
            tags: [],
          }),
          makeTestWorkspace({
            name: "library-1c",
            path: "libraries/library-c",
            matchPattern: "libraries/*",
            scripts: ["all-workspaces", "c-workspaces", "library-c"],
          }),
        ],
        rootWorkspace: expect.any(Object),
        workspaceMap: {
          "test-root": makeWorkspaceMapEntry({ alias: [] }),
          "application-1a": makeWorkspaceMapEntry({
            alias: ["appA"],
            rules: {},
            scripts: {
              "all-workspaces": {
                order: 1,
              },
            },
          }),
          "application-1b": makeWorkspaceMapEntry({
            alias: ["appB_file"],
            rules: {},
            scripts: {
              "all-workspaces": {
                order: 0,
              },
              "b-workspaces": {
                order: 2,
              },
            },
          }),
          "application-1c": makeWorkspaceMapEntry({ alias: [] }),
          "library-1a": makeWorkspaceMapEntry({
            alias: ["libA_file"],
          }),
          "library-1b": makeWorkspaceMapEntry({
            alias: ["libB", "libB2"],
            rules: {},
            scripts: {
              "all-workspaces": {
                order: 100,
              },
              "b-workspaces": {
                order: 2,
              },
            },
          }),
          "library-1c": makeWorkspaceMapEntry({ alias: [] }),
        },
      });
    });
  });

  describe("TypeScript config files", () => {
    test("ts configs load as expected", () => {
      const { workspaces, workspaceMap } = findWorkspaces({
        rootDirectory: getProjectRoot("workspaceConfigTsConfig"),
      });
      expect(workspaces).toEqual([
        makeTestWorkspace({
          name: "application-1a",
          path: "applications/application-a",
          matchPattern: "applications/*",
          scripts: ["a-workspaces", "all-workspaces", "application-a"],
          aliases: ["appA"],
          tags: [],
        }),
        makeTestWorkspace({
          name: "application-1b",
          path: "applications/application-b",
          matchPattern: "applications/*",
          scripts: ["all-workspaces", "application-b", "b-workspaces"],
          aliases: ["appB"],
          tags: [],
        }),
      ]);
      expect(workspaceMap).toEqual({
        "test-root": makeWorkspaceMapEntry({ alias: [] }),
        "application-1a": makeWorkspaceMapEntry({
          alias: ["appA"],
          rules: {},
          scripts: {
            "all-workspaces": {
              order: 1,
            },
          },
        }),
        "application-1b": makeWorkspaceMapEntry({
          alias: ["appB"],
          rules: {},
          scripts: {
            "b-workspaces": {
              order: 0,
            },
          },
        }),
      });
    });

    test("ts empty configs load as expected", () => {
      expect(() =>
        findWorkspaces({
          rootDirectory: getProjectRoot("workspaceConfigTsEmpty"),
        }),
      ).toThrow(LOAD_CONFIG_ERRORS.NoExportError);
    });

    test("ts invalid configs throw expected error", () => {
      expect(() =>
        findWorkspaces({
          rootDirectory: getProjectRoot("workspaceConfigTsInvalid"),
        }),
      ).toThrow(WORKSPACE_CONFIG_ERRORS.InvalidWorkspaceConfig);
    });

    test("ts config is skipped when disableExecutableConfigs is true", () => {
      const { workspaceMap } = findWorkspaces({
        rootDirectory: getProjectRoot("workspaceConfigTsPrecedence"),
        loadConfigOptions: { disableExecutableConfigs: true },
      });
      // tsPrecedence fixtures define different aliases per file type;
      // when ts is skipped the loader falls through to the next location
      // (js in this fixture), so neither ts nor jsonc aliases should appear.
      const aliasesPerWorkspace = Object.entries(workspaceMap)
        .filter(([name]) => name !== "test-root")
        .map(([name, entry]) => ({ name, aliases: entry.config.aliases }));
      for (const { aliases } of aliasesPerWorkspace) {
        expect(aliases).not.toContain("appA-ts");
        expect(aliases).not.toContain("appB-ts");
      }
    });

    test("ts config loads with precedence", () => {
      const { workspaces, workspaceMap } = findWorkspaces({
        rootDirectory: getProjectRoot("workspaceConfigTsPrecedence"),
      });
      expect(workspaces).toEqual([
        makeTestWorkspace({
          name: "application-1a",
          path: "applications/application-a",
          matchPattern: "applications/*",
          scripts: ["a-workspaces", "all-workspaces", "application-a"],
          aliases: ["appA-ts"],
          tags: [],
        }),
        makeTestWorkspace({
          name: "application-1b",
          path: "applications/application-b",
          matchPattern: "applications/*",
          scripts: ["all-workspaces", "application-b", "b-workspaces"],
          aliases: ["appB-ts"],
          tags: [],
        }),
      ]);
      expect(workspaceMap).toEqual({
        "test-root": makeWorkspaceMapEntry({ alias: [] }),
        "application-1a": makeWorkspaceMapEntry({
          alias: ["appA-ts"],
          rules: {},
          scripts: {
            "all-workspaces": {
              order: 1,
            },
          },
        }),
        "application-1b": makeWorkspaceMapEntry({
          alias: ["appB-ts"],
          rules: {},
          scripts: {
            "all-workspaces": {
              order: 1,
            },
          },
        }),
      });
    });
  });

  describe("JavaScript config files", () => {
    test("js configs load as expected", () => {
      const { workspaces, workspaceMap } = findWorkspaces({
        rootDirectory: getProjectRoot("workspaceConfigJsConfig"),
      });
      expect(workspaces).toEqual([
        makeTestWorkspace({
          name: "application-1a",
          path: "applications/application-a",
          matchPattern: "applications/*",
          scripts: ["a-workspaces", "all-workspaces", "application-a"],
          aliases: ["appA"],
          tags: [],
        }),
        makeTestWorkspace({
          name: "application-1b",
          path: "applications/application-b",
          matchPattern: "applications/*",
          scripts: ["all-workspaces", "application-b", "b-workspaces"],
          aliases: ["appB"],
          tags: [],
        }),
      ]);
      expect(workspaceMap).toEqual({
        "test-root": makeWorkspaceMapEntry({ alias: [] }),
        "application-1a": makeWorkspaceMapEntry({
          alias: ["appA"],
          rules: {},
          scripts: {
            "all-workspaces": {
              order: 1,
            },
          },
        }),
        "application-1b": makeWorkspaceMapEntry({
          alias: ["appB"],
          rules: {},
          scripts: {
            "b-workspaces": {
              order: 0,
            },
          },
        }),
      });
    });

    test("js config loads with precedence", () => {
      const { workspaces, workspaceMap } = findWorkspaces({
        rootDirectory: getProjectRoot("workspaceConfigJsPrecedence"),
      });
      expect(workspaces).toEqual([
        makeTestWorkspace({
          name: "application-1a",
          path: "applications/application-a",
          matchPattern: "applications/*",
          scripts: ["a-workspaces", "all-workspaces", "application-a"],
          aliases: ["appA-js"],
          tags: [],
        }),
        makeTestWorkspace({
          name: "application-1b",
          path: "applications/application-b",
          matchPattern: "applications/*",
          scripts: ["all-workspaces", "application-b", "b-workspaces"],
          aliases: ["appB-js"],
          tags: [],
        }),
      ]);
      expect(workspaceMap).toEqual({
        "test-root": makeWorkspaceMapEntry({ alias: [] }),
        "application-1a": makeWorkspaceMapEntry({
          alias: ["appA-js"],
          rules: {},
          scripts: {
            "all-workspaces": {
              order: 1,
            },
          },
        }),
        "application-1b": makeWorkspaceMapEntry({
          alias: ["appB-js"],
          rules: {},
          scripts: {
            "all-workspaces": {
              order: 1,
            },
          },
        }),
      });
    });
  });
});
