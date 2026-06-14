import { getUserEnvVarName } from "@pacwich/common/config";
import { createFileSystemProject } from "../../src";
import { LOAD_CONFIG_ERRORS } from "../../src/config";
import {
  loadProjectConfig,
  resolveProjectConfig,
  PROJECT_CONFIG_ERRORS,
} from "../../src/config/projectConfig";
import { determineParallelMax, resolveScriptShell } from "../../src/runScript";
import { getProjectRoot } from "../fixtures/testProjects";
import { afterEach, describe, expect, test } from "../util/testFramework";

describe("Test project config", () => {
  describe("loadProjectConfig", () => {
    test("loads defaults when no config file exists", () => {
      expect(loadProjectConfig(getProjectRoot("default"))).toEqual({
        defaults: {
          parallelMax: determineParallelMax("default"),
          shell: resolveScriptShell("default"),
          includeRootWorkspace: false,
          affectedBaseRef: "main",
        },
        packageManager: "auto",
        workspacePatternConfigs: [],
        verify: { workspaceDependencies: { ignoreInputFiles: [] } },
      });
    });

    test("loads jsonc config file", () => {
      expect(
        loadProjectConfig(getProjectRoot("projectConfigJsoncFile")),
      ).toEqual({
        defaults: {
          parallelMax: 5,
          shell: "system",
          includeRootWorkspace: true,
          affectedBaseRef: "main",
        },
        packageManager: "auto",
        workspacePatternConfigs: [],
        verify: { workspaceDependencies: { ignoreInputFiles: [] } },
      });
    });

    test("loads package.json config", () => {
      expect(loadProjectConfig(getProjectRoot("projectConfigPackage"))).toEqual(
        {
          defaults: {
            parallelMax: 5,
            shell: "system",
            includeRootWorkspace: false,
            affectedBaseRef: "main",
          },
          packageManager: "auto",
          workspacePatternConfigs: [],
          verify: { workspaceDependencies: { ignoreInputFiles: [] } },
        },
      );
    });

    test("loads config with only parallelMax set", () => {
      expect(
        loadProjectConfig(getProjectRoot("projectConfigParallelMaxOnly")),
      ).toEqual({
        defaults: {
          parallelMax: 5,
          shell: resolveScriptShell("default"),
          includeRootWorkspace: false,
          affectedBaseRef: "main",
        },
        packageManager: "auto",
        workspacePatternConfigs: [],
        verify: { workspaceDependencies: { ignoreInputFiles: [] } },
      });
    });

    test("throws for invalid parallel max", () => {
      expect(() =>
        loadProjectConfig(getProjectRoot("projectConfigInvalidParallel")),
      ).toThrow(
        'Invalid parallel max value: "something wrong" (set by project config)',
      );
    });

    test("throws for invalid shell", () => {
      expect(() =>
        loadProjectConfig(getProjectRoot("projectConfigInvalidShell")),
      ).toThrow(
        "Invalid shell option: something wrong (accepted values: bun, system)",
      );
    });

    test("throws for invalid JSON", () => {
      expect(() =>
        loadProjectConfig(getProjectRoot("projectConfigInvalidJson")),
      ).toThrow("Invalid JSON");
    });

    test("throws for invalid type", () => {
      expect(() =>
        loadProjectConfig(getProjectRoot("projectConfigInvalidType")),
      ).toThrow("Project config is invalid: config.defaults must be object");
    });
  });

  describe("TypeScript config files", () => {
    test("ts config loads as expected", () => {
      expect(loadProjectConfig(getProjectRoot("projectConfigTsFile"))).toEqual({
        defaults: {
          parallelMax: 3,
          shell: "bun",
          includeRootWorkspace: false,
          affectedBaseRef: "main",
        },
        packageManager: "auto",
        workspacePatternConfigs: [],
        verify: { workspaceDependencies: { ignoreInputFiles: [] } },
      });
    });

    test("ts config resolves a relative import without explicit extension", () => {
      expect(
        loadProjectConfig(getProjectRoot("projectConfigTsRelativeImport")),
      ).toEqual({
        defaults: {
          parallelMax: 7,
          shell: "bun",
          includeRootWorkspace: false,
          affectedBaseRef: "main",
        },
        packageManager: "auto",
        workspacePatternConfigs: [],
        verify: { workspaceDependencies: { ignoreInputFiles: [] } },
      });
    });

    test("ts empty config throws expected error", () => {
      expect(() =>
        loadProjectConfig(getProjectRoot("projectConfigTsEmpty")),
      ).toThrow(LOAD_CONFIG_ERRORS.NoExportError);
    });

    test("ts invalid config throws expected error", () => {
      expect(() =>
        loadProjectConfig(getProjectRoot("projectConfigTsInvalid")),
      ).toThrow(PROJECT_CONFIG_ERRORS.InvalidProjectConfig);
    });

    test("ts config that throws InvalidProjectConfig from defineProjectConfig surfaces clean validation message", () => {
      // Regression: jiti+sucrase compiles user TS files in a separate
      // module realm. An `InvalidProjectConfig` thrown from inside
      // `defineProjectConfig` during config evaluation used to be:
      //   (a) crashed by a non-writable prototype `name` (before
      //       the defineErrors cleanup), and
      //   (b) wrapped in a "Failed to load module at ..." envelope
      //       that obscured the real validation message (cross-realm
      //       instanceof failed to match).
      // Both are now addressed via a cross-realm Symbol.for marker
      // on PacwichError instances and an unwrap in loadConfig's catch.
      let caught: unknown;
      try {
        loadProjectConfig(getProjectRoot("projectConfigTsInvalidViaDefine"));
      } catch (err) {
        caught = err;
      }
      const message = (caught as Error)?.message ?? "";
      // No mangling from the old non-writable .name assignment.
      expect(message).not.toContain("Cannot assign to read only property");
      // No "Failed to load module" envelope around a domain error.
      expect(message).not.toContain("Failed to load module");
      // The actual validation message reaches the caller.
      expect(message).toContain("Project config is invalid");
      expect(message).toContain("packageManager");
    });

    test("ts config loads with precedence over js, jsonc, json, and package.json", () => {
      expect(
        loadProjectConfig(getProjectRoot("projectConfigTsPrecedence")),
      ).toEqual({
        defaults: {
          parallelMax: 3,
          shell: resolveScriptShell("default"),
          includeRootWorkspace: false,
          affectedBaseRef: "main",
        },
        packageManager: "auto",
        workspacePatternConfigs: [],
        verify: { workspaceDependencies: { ignoreInputFiles: [] } },
      });
    });
  });

  describe("disableExecutableConfigs", () => {
    test("loadProjectConfig skips pacwich.project.ts when disabled, falling through to jsonc", () => {
      expect(
        loadProjectConfig(getProjectRoot("projectConfigTsPrecedence"), {
          disableExecutableConfigs: true,
        }),
      ).toEqual({
        defaults: {
          parallelMax: 5,
          shell: resolveScriptShell("default"),
          includeRootWorkspace: false,
          affectedBaseRef: "main",
        },
        packageManager: "auto",
        workspacePatternConfigs: [],
        verify: { workspaceDependencies: { ignoreInputFiles: [] } },
      });
    });

    test("loadProjectConfig still loads jsonc-only fixtures when disabled", () => {
      expect(
        loadProjectConfig(getProjectRoot("projectConfigJsoncFile"), {
          disableExecutableConfigs: true,
        }),
      ).toEqual({
        defaults: {
          parallelMax: 5,
          shell: "system",
          includeRootWorkspace: true,
          affectedBaseRef: "main",
        },
        packageManager: "auto",
        workspacePatternConfigs: [],
        verify: { workspaceDependencies: { ignoreInputFiles: [] } },
      });
    });

    test("createFileSystemProject with disableExecutableConfigs ignores pacwich.project.ts", () => {
      const project = createFileSystemProject({
        rootDirectory: getProjectRoot("projectConfigTsPrecedence"),
        disableExecutableConfigs: true,
      });
      expect(project.config.project.defaults.parallelMax).toBe(5);
    });

    test("createFileSystemProject with disableExecutableConfigs also skips pacwich.project.js", () => {
      // jsPrecedence has js (4), jsonc (5), json (6). With JS skipped,
      // the loader falls through to jsonc.
      const project = createFileSystemProject({
        rootDirectory: getProjectRoot("projectConfigJsPrecedence"),
        disableExecutableConfigs: true,
      });
      expect(project.config.project.defaults.parallelMax).toBe(5);
    });

    test("createFileSystemProject without disableExecutableConfigs honors pacwich.project.js", () => {
      const project = createFileSystemProject({
        rootDirectory: getProjectRoot("projectConfigJsPrecedence"),
      });
      expect(project.config.project.defaults.parallelMax).toBe(4);
    });

    test("createFileSystemProject without disableExecutableConfigs honors pacwich.project.ts", () => {
      const project = createFileSystemProject({
        rootDirectory: getProjectRoot("projectConfigTsPrecedence"),
      });
      expect(project.config.project.defaults.parallelMax).toBe(3);
    });

    describe("PACWICH_DISABLE_EXECUTABLE_CONFIGS_DEFAULT env var fallback", () => {
      const envName = getUserEnvVarName("disableExecutableConfigsDefault");
      const original = process.env[envName];

      afterEach(() => {
        if (original === undefined) delete process.env[envName];
        else process.env[envName] = original;
      });

      test("env=true skips pacwich.project.ts when option is unset", () => {
        process.env[envName] = "true";
        const project = createFileSystemProject({
          rootDirectory: getProjectRoot("projectConfigTsPrecedence"),
        });
        expect(project.config.project.defaults.parallelMax).toBe(5);
      });

      test("env=false honors pacwich.project.ts when option is unset", () => {
        process.env[envName] = "false";
        const project = createFileSystemProject({
          rootDirectory: getProjectRoot("projectConfigTsPrecedence"),
        });
        expect(project.config.project.defaults.parallelMax).toBe(3);
      });

      test("option explicitly set overrides env=true", () => {
        process.env[envName] = "true";
        const project = createFileSystemProject({
          rootDirectory: getProjectRoot("projectConfigTsPrecedence"),
          disableExecutableConfigs: false,
        });
        expect(project.config.project.defaults.parallelMax).toBe(3);
      });

      test("option explicitly set overrides env=false", () => {
        process.env[envName] = "false";
        const project = createFileSystemProject({
          rootDirectory: getProjectRoot("projectConfigTsPrecedence"),
          disableExecutableConfigs: true,
        });
        expect(project.config.project.defaults.parallelMax).toBe(5);
      });

      test("env=garbage is ignored and falls through to default false", () => {
        process.env[envName] = "yes";
        const project = createFileSystemProject({
          rootDirectory: getProjectRoot("projectConfigTsPrecedence"),
        });
        expect(project.config.project.defaults.parallelMax).toBe(3);
      });
    });
  });

  describe("JavaScript config files", () => {
    test("js config loads as expected", () => {
      expect(loadProjectConfig(getProjectRoot("projectConfigJsFile"))).toEqual({
        defaults: {
          parallelMax: 4,
          shell: "bun",
          includeRootWorkspace: false,
          affectedBaseRef: "main",
        },
        packageManager: "auto",
        workspacePatternConfigs: [],
        verify: { workspaceDependencies: { ignoreInputFiles: [] } },
      });
    });

    test("js config loads with precedence over jsonc, json, and package.json", () => {
      expect(
        loadProjectConfig(getProjectRoot("projectConfigJsPrecedence")),
      ).toEqual({
        defaults: {
          parallelMax: 4,
          shell: resolveScriptShell("default"),
          includeRootWorkspace: false,
          affectedBaseRef: "main",
        },
        packageManager: "auto",
        workspacePatternConfigs: [],
        verify: { workspaceDependencies: { ignoreInputFiles: [] } },
      });
    });
  });

  describe("FileSystemProject integration", () => {
    test("loads root config for default project", () => {
      expect(
        createFileSystemProject({
          rootDirectory: getProjectRoot("default"),
        }).config.project,
      ).toEqual({
        defaults: {
          parallelMax: determineParallelMax("default"),
          shell: resolveScriptShell("default"),
          includeRootWorkspace: false,
          affectedBaseRef: "main",
        },
        packageManager: "auto",
        workspacePatternConfigs: [],
        verify: { workspaceDependencies: { ignoreInputFiles: [] } },
      });
    });

    test("loads root config for jsonc file project", () => {
      expect(
        createFileSystemProject({
          rootDirectory: getProjectRoot("projectConfigJsoncFile"),
        }).config.project,
      ).toEqual({
        defaults: {
          parallelMax: 5,
          shell: "system",
          includeRootWorkspace: true,
          affectedBaseRef: "main",
        },
        packageManager: "auto",
        workspacePatternConfigs: [],
        verify: { workspaceDependencies: { ignoreInputFiles: [] } },
      });
    });

    test("uses parallel max from config", async () => {
      const project = createFileSystemProject({
        rootDirectory: getProjectRoot("projectConfigJsoncFile"),
      });

      let outputText = "";
      const { output, summary } = project.runScriptAcrossWorkspaces({
        workspacePatterns: ["workspace-a"],
        script: "debug-parallel-max",
        parallel: true,
      });

      for await (const { chunk } of output.text()) {
        outputText += chunk;
      }

      await summary;

      expect(outputText.trim()).toBe("5");
    });

    test("uses shell option from config", async () => {
      const project = createFileSystemProject({
        rootDirectory: getProjectRoot("projectConfigJsoncFile"),
      });

      let outputText = "";
      const { output, summary } = project.runScriptAcrossWorkspaces({
        workspacePatterns: ["workspace-a"],
        script: "debug-shell",
        parallel: true,
      });

      for await (const { chunk } of output.text()) {
        outputText += chunk;
      }

      await summary;

      expect(outputText.trim()).toBe("system");
    });
  });

  describe("affectedBaseRef default", () => {
    const ENV_VAR = getUserEnvVarName("affectedBaseRefDefault");

    afterEach(() => {
      delete process.env[ENV_VAR];
    });

    test("resolves to 'main' when not provided in config or env", () => {
      expect(resolveProjectConfig({}).defaults.affectedBaseRef).toBe("main");
    });

    test("uses explicit value from config", () => {
      expect(
        resolveProjectConfig({ defaults: { affectedBaseRef: "develop" } })
          .defaults.affectedBaseRef,
      ).toBe("develop");
    });

    test("falls back to env var when config does not set it", () => {
      process.env[ENV_VAR] = "release";
      expect(resolveProjectConfig({}).defaults.affectedBaseRef).toBe("release");
    });

    test("config value takes precedence over env var", () => {
      process.env[ENV_VAR] = "release";
      expect(
        resolveProjectConfig({ defaults: { affectedBaseRef: "develop" } })
          .defaults.affectedBaseRef,
      ).toBe("develop");
    });

    test("throws when affectedBaseRef is not a string", () => {
      expect(() =>
        resolveProjectConfig({
          defaults: { affectedBaseRef: 5 as unknown as string },
        }),
      ).toThrow("Project config is invalid");
    });
  });

  describe("packageManager (top-level)", () => {
    const ENV_VAR = getUserEnvVarName("packageManager");

    afterEach(() => {
      delete process.env[ENV_VAR];
    });

    test("resolves to 'auto' when not provided in config or env", () => {
      expect(resolveProjectConfig({}).packageManager).toBe("auto");
    });

    test.each(["auto", "bun", "npm"] as const)(
      "uses explicit config value %s",
      (value) => {
        expect(
          resolveProjectConfig({ packageManager: value }).packageManager,
        ).toBe(value);
      },
    );

    test.each(["bun", "npm", "auto"] as const)(
      "falls back to env var %s when config does not set it",
      (value) => {
        process.env[ENV_VAR] = value;
        expect(resolveProjectConfig({}).packageManager).toBe(value);
      },
    );

    test("config value takes precedence over env var", () => {
      process.env[ENV_VAR] = "npm";
      expect(
        resolveProjectConfig({ packageManager: "bun" }).packageManager,
      ).toBe("bun");
    });

    test("ignores invalid env var value and falls back to 'auto'", () => {
      process.env[ENV_VAR] = "yarn";
      expect(resolveProjectConfig({}).packageManager).toBe("auto");
    });

    test("throws when config value is not a known PackageManagerValue", () => {
      expect(() =>
        resolveProjectConfig({
          // Bypass the type so AJV gets the chance to reject it.
          packageManager: "yarn" as unknown as "auto",
        }),
      ).toThrow("Project config is invalid");
    });

    test("throws when config value is not a string", () => {
      expect(() =>
        resolveProjectConfig({
          packageManager: 5 as unknown as "auto",
        }),
      ).toThrow("Project config is invalid");
    });

    test("rejects packageManager nested under defaults (no longer accepted there)", () => {
      expect(() =>
        resolveProjectConfig({
          defaults: {
            packageManager: "bun" as unknown,
          } as never,
        }),
      ).toThrow("Project config is invalid");
    });
  });

  describe("cliScriptOutputStyle default", () => {
    const ENV_VAR = getUserEnvVarName("cliScriptOutputStyleDefault");

    afterEach(() => {
      delete process.env[ENV_VAR];
    });

    test("resolves to undefined when not provided in config or env", () => {
      expect(
        resolveProjectConfig({}).defaults.cliScriptOutputStyle,
      ).toBeUndefined();
    });

    test.each(["grouped", "prefixed", "plain", "none"] as const)(
      "uses explicit config value %s",
      (value) => {
        expect(
          resolveProjectConfig({ defaults: { cliScriptOutputStyle: value } })
            .defaults.cliScriptOutputStyle,
        ).toBe(value);
      },
    );

    test.each(["grouped", "prefixed", "plain", "none"] as const)(
      "falls back to env var %s when config does not set it",
      (value) => {
        process.env[ENV_VAR] = value;
        expect(resolveProjectConfig({}).defaults.cliScriptOutputStyle).toBe(
          value,
        );
      },
    );

    test("config value takes precedence over env var", () => {
      process.env[ENV_VAR] = "plain";
      expect(
        resolveProjectConfig({ defaults: { cliScriptOutputStyle: "prefixed" } })
          .defaults.cliScriptOutputStyle,
      ).toBe("prefixed");
    });

    test("ignores invalid env var value and falls back to undefined", () => {
      process.env[ENV_VAR] = "tabular";
      expect(
        resolveProjectConfig({}).defaults.cliScriptOutputStyle,
      ).toBeUndefined();
    });

    test("throws when config value is not a known OutputStyleName", () => {
      expect(() =>
        resolveProjectConfig({
          defaults: {
            cliScriptOutputStyle: "tabular" as unknown as "grouped",
          },
        }),
      ).toThrow("Project config is invalid");
    });

    test("throws when config value is not a string", () => {
      expect(() =>
        resolveProjectConfig({
          defaults: {
            cliScriptOutputStyle: 5 as unknown as "grouped",
          },
        }),
      ).toThrow("Project config is invalid");
    });
  });

  describe("verify.workspaceDependencies.ignoreInputFiles", () => {
    test("defaults to [] when not provided in config", () => {
      expect(resolveProjectConfig({}).verify).toEqual({
        workspaceDependencies: { ignoreInputFiles: [] },
      });
    });

    test("defaults to [] when verify object is empty", () => {
      expect(resolveProjectConfig({ verify: {} }).verify).toEqual({
        workspaceDependencies: { ignoreInputFiles: [] },
      });
    });

    test("defaults to [] when workspaceDependencies is empty", () => {
      expect(
        resolveProjectConfig({ verify: { workspaceDependencies: {} } }).verify,
      ).toEqual({ workspaceDependencies: { ignoreInputFiles: [] } });
    });

    test("passes through a non-empty patterns list", () => {
      expect(
        resolveProjectConfig({
          verify: {
            workspaceDependencies: {
              ignoreInputFiles: ["scripts/codegen/**/*", "/legacy/**/*.ts"],
            },
          },
        }).verify,
      ).toEqual({
        workspaceDependencies: {
          ignoreInputFiles: ["scripts/codegen/**/*", "/legacy/**/*.ts"],
        },
      });
    });

    test("throws when ignoreInputFiles is not an array", () => {
      expect(() =>
        resolveProjectConfig({
          verify: {
            workspaceDependencies: {
              ignoreInputFiles: "scripts/**/*" as unknown as string[],
            },
          },
        }),
      ).toThrow("Project config is invalid");
    });

    test("throws when ignoreInputFiles entries are not strings", () => {
      expect(() =>
        resolveProjectConfig({
          verify: {
            workspaceDependencies: {
              ignoreInputFiles: [5 as unknown as string],
            },
          },
        }),
      ).toThrow("Project config is invalid");
    });

    test("throws when verify contains unknown properties", () => {
      expect(() =>
        resolveProjectConfig({
          verify: {
            // @ts-expect-error intentional unknown key
            scripts: { ignoreInputFiles: ["x"] },
          },
        }),
      ).toThrow("Project config is invalid");
    });

    test("throws when workspaceDependencies contains unknown properties", () => {
      expect(() =>
        resolveProjectConfig({
          verify: {
            workspaceDependencies: {
              // @ts-expect-error intentional unknown key
              ignoreDependencies: ["x"],
            },
          },
        }),
      ).toThrow("Project config is invalid");
    });
  });
});
