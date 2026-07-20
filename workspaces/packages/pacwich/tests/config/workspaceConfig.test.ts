import path from "path";
import { LOAD_CONFIG_ERRORS } from "../../src/config";
import {
  loadWorkspaceConfig,
  resolveWorkspaceConfig,
  validateWorkspaceConfig,
  WORKSPACE_CONFIG_ERRORS,
} from "../../src/config/workspaceConfig";
import { resolvePackageManagerAdapter } from "../../src/packageManager/adapter";
import { assembleProject } from "../../src/project/implementations/fileSystemProject/assembleProject";
import { getProjectRoot } from "../fixtures/testProjects";
import { makeTestWorkspace, makeWorkspaceMapEntry } from "../util/testData";
import { expect, test, describe } from "../util/testFramework";

const DEFAULT_VERIFY = {
  workspaceDependencies: {
    ignoreInputFiles: [],
    ignoreImportsFromWorkspacePatterns: [],
  },
};

const adapter = resolvePackageManagerAdapter("bun");

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
          "applications/application-a",
        ),
      );
      expect(config).toEqual({
        aliases: ["appA"],
        tags: [],
        rules: {},
        verify: DEFAULT_VERIFY,
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
          "applications/application-b",
        ),
      );
      expect(config).toEqual({
        aliases: ["appB_file"],
        tags: [],
        rules: {},
        verify: DEFAULT_VERIFY,
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
          "libraries/library-a",
        ),
      );
      expect(config).toEqual({
        aliases: ["libA_file"],
        tags: [],
        rules: {},
        verify: DEFAULT_VERIFY,
        scripts: {},
      });
    });

    test("returns config for library-b in packageFileMix project", () => {
      const config = loadWorkspaceConfig(
        path.join(
          getProjectRoot("workspaceConfigPackageFileMix"),
          "libraries/library-b",
        ),
      );
      expect(config).toEqual({
        aliases: ["libB", "libB2"],
        tags: [],
        rules: {},
        verify: DEFAULT_VERIFY,
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
          "libraries/library-c",
        ),
      );
      expect(config).toEqual({
        aliases: [],
        tags: [],
        rules: {},
        verify: DEFAULT_VERIFY,
        scripts: {},
      });
    });

    test("returns empty config for application-c in packageFileMix project", () => {
      const config = loadWorkspaceConfig(
        path.join(
          getProjectRoot("workspaceConfigPackageFileMix"),
          "applications/application-c",
        ),
      );
      expect(config).toEqual({
        aliases: [],
        tags: [],
        rules: {},
        verify: DEFAULT_VERIFY,
        scripts: {},
      });
    });

    test("returns config for application-a in fileOnly project", () => {
      const config = loadWorkspaceConfig(
        path.join(
          getProjectRoot("workspaceConfigFileOnly"),
          "applications/application-a",
        ),
      );
      expect(config).toEqual({
        aliases: ["appA"],
        tags: [],
        rules: {},
        verify: DEFAULT_VERIFY,
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
            "applications/application-a",
          ),
        ),
      ).toThrow(LOAD_CONFIG_ERRORS.InvalidJSON);
    });

    test("throws for application-b", () => {
      expect(() =>
        loadWorkspaceConfig(
          path.join(
            getProjectRoot("workspaceConfigInvalidJson"),
            "applications/application-b",
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

    test("reports all invalid fields in one message", () => {
      let caught: unknown;
      try {
        validateWorkspaceConfig({
          // @ts-expect-error - Invalid config
          alias: 123,
          // @ts-expect-error - Invalid config
          tags: "not-an-array",
        });
      } catch (error) {
        caught = error;
      }
      const message = (caught as Error)?.message ?? "";
      expect(message).toContain("config.alias must be string,array");
      expect(message).toContain("config.tags must be array");
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

      test("accepts defaultInputs.externalDependencies as a string array", () => {
        expect(() =>
          validateWorkspaceConfig({
            defaultInputs: { externalDependencies: ["lodash", "react"] },
          }),
        ).not.toThrow();
      });

      test("accepts defaultInputs.externalDependencies as an empty array (no externals participate)", () => {
        expect(() =>
          validateWorkspaceConfig({
            defaultInputs: { externalDependencies: [] },
          }),
        ).not.toThrow();
      });

      test("throws when defaultInputs.externalDependencies contains non-strings", () => {
        expect(() =>
          validateWorkspaceConfig({
            // @ts-expect-error - Invalid config
            defaultInputs: { externalDependencies: ["lodash", 123] },
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

    describe("verify", () => {
      test("accepts verify.workspaceDependencies with both fields", () => {
        expect(() =>
          validateWorkspaceConfig({
            verify: {
              workspaceDependencies: {
                ignoreInputFiles: ["generated/**/*.ts"],
                ignoreImportsFromWorkspacePatterns: ["tag:internal"],
              },
            },
          }),
        ).not.toThrow();
      });

      test("accepts empty verify object", () => {
        expect(() => validateWorkspaceConfig({ verify: {} })).not.toThrow();
      });

      test("throws when ignoreInputFiles contains non-strings", () => {
        expect(() =>
          validateWorkspaceConfig({
            verify: {
              workspaceDependencies: {
                // @ts-expect-error - Invalid config
                ignoreInputFiles: [123],
              },
            },
          }),
        ).toThrow(WORKSPACE_CONFIG_ERRORS.InvalidWorkspaceConfig);
      });

      test("throws when ignoreImportsFromWorkspacePatterns contains non-strings", () => {
        expect(() =>
          validateWorkspaceConfig({
            verify: {
              workspaceDependencies: {
                // @ts-expect-error - Invalid config
                ignoreImportsFromWorkspacePatterns: [123],
              },
            },
          }),
        ).toThrow(WORKSPACE_CONFIG_ERRORS.InvalidWorkspaceConfig);
      });

      test("throws when verify has unknown property", () => {
        expect(() =>
          validateWorkspaceConfig({
            // @ts-expect-error - Invalid config
            verify: { extra: ["a"] },
          }),
        ).toThrow(WORKSPACE_CONFIG_ERRORS.InvalidWorkspaceConfig);
      });
    });
  });

  describe("resolveWorkspaceConfig", () => {
    test("verify defaults to empty arrays when not provided", () => {
      expect(resolveWorkspaceConfig({}).verify).toEqual(DEFAULT_VERIFY);
    });

    test("passes through a configured verify field, defaulting unset fields", () => {
      const verify = {
        workspaceDependencies: {
          ignoreInputFiles: ["generated/**/*.ts"],
        },
      };
      expect(resolveWorkspaceConfig({ verify }).verify).toEqual({
        workspaceDependencies: {
          ignoreInputFiles: ["generated/**/*.ts"],
          ignoreImportsFromWorkspacePatterns: [],
        },
      });
    });
  });

  describe("loadWorkspaceConfig with invalid config", () => {
    // refactor below with test.each

    test.each([
      "application-a",
      "application-b",
      "application-c",
      "application-d",
      "application-e",
      "application-f",
      "application-g",
      "application-h",
    ])("throws for %s", (appName) => {
      expect(() =>
        loadWorkspaceConfig(
          path.join(
            getProjectRoot("workspaceConfigInvalidConfig"),
            `applications/${appName}`,
          ),
        ),
      ).toThrow(WORKSPACE_CONFIG_ERRORS.InvalidWorkspaceConfig);
    });

    test("error message names the package.json config location", () => {
      expect(() =>
        loadWorkspaceConfig(
          path.join(
            getProjectRoot("workspaceConfigInvalidConfig"),
            "applications/application-a",
          ),
        ),
      ).toThrow('applications/application-a/package.json["pacwich"]');
    });

    test("error message names the json config file", () => {
      expect(() =>
        loadWorkspaceConfig(
          path.join(
            getProjectRoot("workspaceConfigInvalidConfig"),
            "applications/application-b",
          ),
        ),
      ).toThrow("applications/application-b/pacwich.workspace.json");
    });
  });
  describe("findWorkspaces with workspace configs", () => {
    test("returns expected result for workspaceConfigFileOnly project", () => {
      expect(
        assembleProject({
          adapter,
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
            verify: DEFAULT_VERIFY,
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
        assembleProject({
          adapter,
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
        assembleProject({
          adapter,
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
            verify: DEFAULT_VERIFY,
            scripts: {
              "all-workspaces": {
                order: 1,
              },
            },
          }),
          "application-1b": makeWorkspaceMapEntry({
            alias: ["appB_file"],
            rules: {},
            verify: DEFAULT_VERIFY,
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
            verify: DEFAULT_VERIFY,
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
      const { workspaces, workspaceMap } = assembleProject({
        adapter,
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
          verify: DEFAULT_VERIFY,
          scripts: {
            "all-workspaces": {
              order: 1,
            },
          },
        }),
        "application-1b": makeWorkspaceMapEntry({
          alias: ["appB"],
          rules: {},
          verify: DEFAULT_VERIFY,
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
        assembleProject({
          adapter,
          rootDirectory: getProjectRoot("workspaceConfigTsEmpty"),
        }),
      ).toThrow(LOAD_CONFIG_ERRORS.NoExportError);
    });

    test("ts invalid configs throw expected error", () => {
      expect(() =>
        assembleProject({
          adapter,
          rootDirectory: getProjectRoot("workspaceConfigTsInvalid"),
        }),
      ).toThrow(WORKSPACE_CONFIG_ERRORS.InvalidWorkspaceConfig);
    });

    test("ts invalid config error message names the config file", () => {
      expect(() =>
        assembleProject({
          adapter,
          rootDirectory: getProjectRoot("workspaceConfigTsInvalid"),
        }),
      ).toThrow("applications/application-a/pacwich.workspace.ts");
    });

    test("ts config that throws InvalidWorkspaceConfig from defineWorkspaceConfig surfaces clean validation message", () => {
      // Regression: see the matching test in projectConfig.test.ts.
      let caught: unknown;
      try {
        assembleProject({
          adapter,
          rootDirectory: getProjectRoot("workspaceConfigTsInvalidViaDefine"),
        });
      } catch (err) {
        caught = err;
      }
      const message = (caught as Error)?.message ?? "";
      expect(message).not.toContain("Cannot assign to read only property");
      expect(message).not.toContain("Failed to load module");
      expect(message).toContain("Workspace config is invalid");
      expect(message).toContain("alias");
      expect(message).toContain(
        "applications/application-a/pacwich.workspace.ts",
      );
    });

    test("ts config is skipped when disableExecutableConfigs is true", () => {
      const { workspaceMap } = assembleProject({
        adapter,
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

    test("js config is also skipped when disableExecutableConfigs is true", () => {
      const { workspaceMap } = assembleProject({
        adapter,
        rootDirectory: getProjectRoot("workspaceConfigJsPrecedence"),
        loadConfigOptions: { disableExecutableConfigs: true },
      });
      // jsPrecedence has .js (appA-js / appB-js) + .jsonc (appA-jsonc /
      // appB-jsonc). With js skipped, the loader falls through to jsonc.
      const aliasesPerWorkspace = Object.entries(workspaceMap)
        .filter(([name]) => name !== "test-root")
        .map(([name, entry]) => ({ name, aliases: entry.config.aliases }));
      for (const { aliases } of aliasesPerWorkspace) {
        expect(aliases).not.toContain("appA-js");
        expect(aliases).not.toContain("appB-js");
      }
      expect(aliasesPerWorkspace.flatMap((entry) => entry.aliases)).toContain(
        "appA-jsonc",
      );
    });

    test("ts config loads with precedence", () => {
      const { workspaces, workspaceMap } = assembleProject({
        adapter,
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
          verify: DEFAULT_VERIFY,
          scripts: {
            "all-workspaces": {
              order: 1,
            },
          },
        }),
        "application-1b": makeWorkspaceMapEntry({
          alias: ["appB-ts"],
          rules: {},
          verify: DEFAULT_VERIFY,
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
      const { workspaces, workspaceMap } = assembleProject({
        adapter,
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
          verify: DEFAULT_VERIFY,
          scripts: {
            "all-workspaces": {
              order: 1,
            },
          },
        }),
        "application-1b": makeWorkspaceMapEntry({
          alias: ["appB"],
          rules: {},
          verify: DEFAULT_VERIFY,
          scripts: {
            "b-workspaces": {
              order: 0,
            },
          },
        }),
      });
    });

    test("js config loads with precedence", () => {
      const { workspaces, workspaceMap } = assembleProject({
        adapter,
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
          verify: DEFAULT_VERIFY,
          scripts: {
            "all-workspaces": {
              order: 1,
            },
          },
        }),
        "application-1b": makeWorkspaceMapEntry({
          alias: ["appB-js"],
          rules: {},
          verify: DEFAULT_VERIFY,
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
