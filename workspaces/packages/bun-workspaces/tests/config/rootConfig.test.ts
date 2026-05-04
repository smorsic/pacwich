import { afterEach, describe, expect, test } from "bun:test";
import { getUserEnvVarName } from "bw-common/config";
import { createFileSystemProject } from "../../src";
import { LOAD_CONFIG_ERRORS } from "../../src/config";
import {
  loadRootConfig,
  resolveRootConfig,
  ROOT_CONFIG_ERRORS,
} from "../../src/config/rootConfig";
import { determineParallelMax, resolveScriptShell } from "../../src/runScript";
import { getProjectRoot } from "../fixtures/testProjects";

describe("Test project root config", () => {
  describe("loadRootConfig", () => {
    test("loads defaults when no config file exists", () => {
      expect(loadRootConfig(getProjectRoot("default"))).toEqual({
        defaults: {
          parallelMax: determineParallelMax("default"),
          shell: resolveScriptShell("default"),
          includeRootWorkspace: false,
          affectedBaseRef: "main",
        },
        workspacePatternConfigs: [],
      });
    });

    test("loads jsonc config file", () => {
      expect(loadRootConfig(getProjectRoot("rootConfigJsoncFile"))).toEqual({
        defaults: {
          parallelMax: 5,
          shell: "system",
          includeRootWorkspace: true,
          affectedBaseRef: "main",
        },
        workspacePatternConfigs: [],
      });
    });

    test("loads package.json config", () => {
      expect(loadRootConfig(getProjectRoot("rootConfigPackage"))).toEqual({
        defaults: {
          parallelMax: 5,
          shell: "system",
          includeRootWorkspace: false,
          affectedBaseRef: "main",
        },
        workspacePatternConfigs: [],
      });
    });

    test("loads config with only parallelMax set", () => {
      expect(
        loadRootConfig(getProjectRoot("rootConfigParallelMaxOnly")),
      ).toEqual({
        defaults: {
          parallelMax: 5,
          shell: resolveScriptShell("default"),
          includeRootWorkspace: false,
          affectedBaseRef: "main",
        },
        workspacePatternConfigs: [],
      });
    });

    test("throws for invalid parallel max", () => {
      expect(() =>
        loadRootConfig(getProjectRoot("rootConfigInvalidParallel")),
      ).toThrow(
        'Invalid parallel max value: "something wrong" (set by root config)',
      );
    });

    test("throws for invalid shell", () => {
      expect(() =>
        loadRootConfig(getProjectRoot("rootConfigInvalidShell")),
      ).toThrow(
        "Invalid shell option: something wrong (accepted values: bun, system)",
      );
    });

    test("throws for invalid JSON", () => {
      expect(() =>
        loadRootConfig(getProjectRoot("rootConfigInvalidJson")),
      ).toThrow("Invalid JSON");
    });

    test("throws for invalid type", () => {
      expect(() =>
        loadRootConfig(getProjectRoot("rootConfigInvalidType")),
      ).toThrow("Root config is invalid: config.defaults must be object");
    });
  });

  describe("TypeScript config files", () => {
    test("ts config loads as expected", () => {
      expect(loadRootConfig(getProjectRoot("rootConfigTsFile"))).toEqual({
        defaults: {
          parallelMax: 3,
          shell: "bun",
          includeRootWorkspace: false,
          affectedBaseRef: "main",
        },
        workspacePatternConfigs: [],
      });
    });

    test("ts empty config throws expected error", () => {
      expect(() => loadRootConfig(getProjectRoot("rootConfigTsEmpty"))).toThrow(
        LOAD_CONFIG_ERRORS.NoExportError,
      );
    });

    test("ts invalid config throws expected error", () => {
      expect(() =>
        loadRootConfig(getProjectRoot("rootConfigTsInvalid")),
      ).toThrow(ROOT_CONFIG_ERRORS.InvalidRootConfig);
    });

    test("ts config loads with precedence over js, jsonc, json, and package.json", () => {
      expect(loadRootConfig(getProjectRoot("rootConfigTsPrecedence"))).toEqual({
        defaults: {
          parallelMax: 3,
          shell: resolveScriptShell("default"),
          includeRootWorkspace: false,
          affectedBaseRef: "main",
        },
        workspacePatternConfigs: [],
      });
    });
  });

  describe("JavaScript config files", () => {
    test("js config loads as expected", () => {
      expect(loadRootConfig(getProjectRoot("rootConfigJsFile"))).toEqual({
        defaults: {
          parallelMax: 4,
          shell: "bun",
          includeRootWorkspace: false,
          affectedBaseRef: "main",
        },
        workspacePatternConfigs: [],
      });
    });

    test("js config loads with precedence over jsonc, json, and package.json", () => {
      expect(loadRootConfig(getProjectRoot("rootConfigJsPrecedence"))).toEqual({
        defaults: {
          parallelMax: 4,
          shell: resolveScriptShell("default"),
          includeRootWorkspace: false,
          affectedBaseRef: "main",
        },
        workspacePatternConfigs: [],
      });
    });
  });

  describe("FileSystemProject integration", () => {
    test("loads root config for default project", () => {
      expect(
        createFileSystemProject({
          rootDirectory: getProjectRoot("default"),
        }).config.root,
      ).toEqual({
        defaults: {
          parallelMax: determineParallelMax("default"),
          shell: resolveScriptShell("default"),
          includeRootWorkspace: false,
          affectedBaseRef: "main",
        },
        workspacePatternConfigs: [],
      });
    });

    test("loads root config for jsonc file project", () => {
      expect(
        createFileSystemProject({
          rootDirectory: getProjectRoot("rootConfigJsoncFile"),
        }).config.root,
      ).toEqual({
        defaults: {
          parallelMax: 5,
          shell: "system",
          includeRootWorkspace: true,
          affectedBaseRef: "main",
        },
        workspacePatternConfigs: [],
      });
    });

    test("uses parallel max from config", async () => {
      const project = createFileSystemProject({
        rootDirectory: getProjectRoot("rootConfigJsoncFile"),
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

      await expect(outputText.trim()).toBe("5");
    });

    test("uses shell option from config", async () => {
      const project = createFileSystemProject({
        rootDirectory: getProjectRoot("rootConfigJsoncFile"),
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

      await expect(outputText.trim()).toBe("system");
    });
  });

  describe("affectedBaseRef default", () => {
    const ENV_VAR = getUserEnvVarName("affectedBaseRefDefault");

    afterEach(() => {
      delete process.env[ENV_VAR];
    });

    test("resolves to 'main' when not provided in config or env", () => {
      expect(resolveRootConfig({}).defaults.affectedBaseRef).toBe("main");
    });

    test("uses explicit value from config", () => {
      expect(
        resolveRootConfig({ defaults: { affectedBaseRef: "develop" } }).defaults
          .affectedBaseRef,
      ).toBe("develop");
    });

    test("falls back to env var when config does not set it", () => {
      process.env[ENV_VAR] = "release";
      expect(resolveRootConfig({}).defaults.affectedBaseRef).toBe("release");
    });

    test("config value takes precedence over env var", () => {
      process.env[ENV_VAR] = "release";
      expect(
        resolveRootConfig({ defaults: { affectedBaseRef: "develop" } }).defaults
          .affectedBaseRef,
      ).toBe("develop");
    });

    test("throws when affectedBaseRef is not a string", () => {
      expect(() =>
        resolveRootConfig({
          defaults: { affectedBaseRef: 5 as unknown as string },
        }),
      ).toThrow("Root config is invalid");
    });
  });
});
