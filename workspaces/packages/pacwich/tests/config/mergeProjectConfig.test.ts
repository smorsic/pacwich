import type { ProjectConfig } from "@pacwich/common";
import { mergeProjectConfig } from "../../src/config/projectConfig";
import { describe, expect, test } from "../util/testFramework";

describe("mergeProjectConfig", () => {
  test("returns empty config when called with no arguments", () => {
    expect(mergeProjectConfig()).toEqual({});
  });

  test("returns the config unchanged when called with a single config", () => {
    expect(mergeProjectConfig({ defaults: { parallelMax: 4 } })).toEqual({
      defaults: { parallelMax: 4 },
    });
  });

  test("second config takes precedence over first for shared fields", () => {
    expect(
      mergeProjectConfig(
        { defaults: { parallelMax: 4 } },
        { defaults: { parallelMax: 8 } },
      ),
    ).toEqual({ defaults: { parallelMax: 8 } });
  });

  test("fields not present in later configs are kept from earlier configs", () => {
    expect(
      mergeProjectConfig(
        { defaults: { parallelMax: 4, shell: "system" } },
        { defaults: { parallelMax: 8 } },
      ),
    ).toEqual({ defaults: { parallelMax: 8, shell: "system" } });
  });

  test("merges all three defaults fields across two configs", () => {
    expect(
      mergeProjectConfig(
        { defaults: { parallelMax: 4, shell: "system" } },
        { defaults: { includeRootWorkspace: true } },
      ),
    ).toEqual({
      defaults: { parallelMax: 4, shell: "system", includeRootWorkspace: true },
    });
  });

  test("merges more than two configs left to right", () => {
    expect(
      mergeProjectConfig(
        { defaults: { parallelMax: 2 } },
        { defaults: { parallelMax: 4, shell: "bun" } },
        { defaults: { shell: "system", includeRootWorkspace: true } },
      ),
    ).toEqual({
      defaults: {
        parallelMax: 4,
        shell: "system",
        includeRootWorkspace: true,
      },
    });
  });

  test("empty config in chain does not overwrite existing fields", () => {
    expect(mergeProjectConfig({ defaults: { parallelMax: 4 } }, {})).toEqual({
      defaults: { parallelMax: 4 },
    });
  });

  test("explicit undefined in later config overrides earlier value", () => {
    expect(
      mergeProjectConfig(
        { defaults: { parallelMax: 4 } },
        { defaults: { parallelMax: undefined } },
      ),
    ).toEqual({ defaults: { parallelMax: undefined } });
  });

  describe("factory function", () => {
    test("factory receives the accumulated config and its return value is merged", () => {
      expect(
        mergeProjectConfig(
          { defaults: { parallelMax: 4, shell: "system" } },
          (prev) => ({ defaults: { ...prev.defaults, parallelMax: 8 } }),
        ),
      ).toEqual({ defaults: { parallelMax: 8, shell: "system" } });
    });

    test("factory can be used in place of any argument", () => {
      expect(
        mergeProjectConfig((prev) => ({
          defaults: { ...prev.defaults, parallelMax: 4 },
        })),
      ).toEqual({ defaults: { parallelMax: 4 } });
    });

    test("factory receives intermediate accumulated state in a multi-config chain", () => {
      const seenPrev: ProjectConfig[] = [];
      mergeProjectConfig(
        { defaults: { parallelMax: 2 } },
        { defaults: { shell: "system" } },
        (prev) => {
          seenPrev.push(prev);
          return {};
        },
      );
      expect(seenPrev[0]).toEqual({
        defaults: { parallelMax: 2, shell: "system" },
      });
    });

    test("factory sees accumulated workspacePatternConfigs from earlier entries", () => {
      const entry1 = { patterns: ["app-*"], config: { tags: ["app"] } };
      const entry2 = { patterns: ["lib-*"], config: { tags: ["lib"] } };
      const seenPrev: ProjectConfig[] = [];
      const result = mergeProjectConfig(
        { workspacePatternConfigs: [entry1] },
        { workspacePatternConfigs: [entry2] },
        (prev) => {
          seenPrev.push(prev);
          return { defaults: { parallelMax: 4 } };
        },
      );
      expect(seenPrev[0].workspacePatternConfigs).toEqual([entry1, entry2]);
      expect(result).toMatchObject({
        workspacePatternConfigs: [entry1, entry2],
        defaults: { parallelMax: 4 },
      });
    });
  });

  describe("workspacePatternConfigs", () => {
    test("entries from two configs are concatenated in order", () => {
      const entry1 = { patterns: ["a"], config: { tags: ["x"] } };
      const entry2 = { patterns: ["b"], config: { tags: ["y"] } };
      expect(
        mergeProjectConfig(
          { workspacePatternConfigs: [entry1] },
          { workspacePatternConfigs: [entry2] },
        ),
      ).toMatchObject({ workspacePatternConfigs: [entry1, entry2] });
    });

    test("entries from three configs are concatenated left to right", () => {
      const entry1 = { patterns: ["a"], config: {} };
      const entry2 = { patterns: ["b"], config: {} };
      const entry3 = { patterns: ["c"], config: {} };
      const { workspacePatternConfigs } = mergeProjectConfig(
        { workspacePatternConfigs: [entry1] },
        { workspacePatternConfigs: [entry2] },
        { workspacePatternConfigs: [entry3] },
      );
      expect(workspacePatternConfigs).toEqual([entry1, entry2, entry3]);
    });

    test("config with no workspacePatternConfigs does not clear accumulated entries", () => {
      const entry1 = { patterns: ["a"], config: {} };
      expect(
        mergeProjectConfig(
          { workspacePatternConfigs: [entry1] },
          { defaults: { parallelMax: 4 } },
        ),
      ).toMatchObject({ workspacePatternConfigs: [entry1] });
    });

    test("workspacePatternConfigs is absent from result when neither config has entries", () => {
      const result = mergeProjectConfig(
        { defaults: { parallelMax: 4 } },
        { defaults: { shell: "system" } },
      );
      expect(result.workspacePatternConfigs).toBeUndefined();
    });
  });

  describe("packageManager (top-level)", () => {
    test("later config wins for packageManager", () => {
      expect(
        mergeProjectConfig(
          { packageManager: "bun" },
          { packageManager: "npm" },
        ),
      ).toMatchObject({ packageManager: "npm" });
    });

    test("earlier packageManager survives when later config omits it", () => {
      expect(
        mergeProjectConfig(
          { packageManager: "npm" },
          { defaults: { parallelMax: 4 } },
        ),
      ).toMatchObject({ packageManager: "npm" });
    });

    test("packageManager is absent from result when no config sets it", () => {
      const result = mergeProjectConfig(
        { defaults: { parallelMax: 4 } },
        { defaults: { shell: "system" } },
      );
      expect(result.packageManager).toBeUndefined();
    });
  });

  describe("verify.workspaceDependencies.ignoreInputFiles", () => {
    test("entries from two configs are concatenated in order", () => {
      expect(
        mergeProjectConfig(
          {
            verify: {
              workspaceDependencies: { ignoreInputFiles: ["a/**/*"] },
            },
          },
          {
            verify: {
              workspaceDependencies: { ignoreInputFiles: ["b/**/*"] },
            },
          },
        ),
      ).toMatchObject({
        verify: {
          workspaceDependencies: { ignoreInputFiles: ["a/**/*", "b/**/*"] },
        },
      });
    });

    test("duplicate patterns across configs are deduplicated", () => {
      expect(
        mergeProjectConfig(
          {
            verify: {
              workspaceDependencies: {
                ignoreInputFiles: ["shared/**/*", "a/**/*"],
              },
            },
          },
          {
            verify: {
              workspaceDependencies: {
                ignoreInputFiles: ["shared/**/*", "b/**/*"],
              },
            },
          },
        ),
      ).toMatchObject({
        verify: {
          workspaceDependencies: {
            ignoreInputFiles: ["shared/**/*", "a/**/*", "b/**/*"],
          },
        },
      });
    });

    test("config with no verify field does not clear accumulated entries", () => {
      expect(
        mergeProjectConfig(
          {
            verify: {
              workspaceDependencies: { ignoreInputFiles: ["a/**/*"] },
            },
          },
          { defaults: { parallelMax: 4 } },
        ),
      ).toMatchObject({
        verify: {
          workspaceDependencies: { ignoreInputFiles: ["a/**/*"] },
        },
      });
    });

    test("verify is absent from result when no config sets it", () => {
      const result = mergeProjectConfig(
        { defaults: { parallelMax: 4 } },
        { defaults: { shell: "system" } },
      );
      expect(result.verify).toBeUndefined();
    });

    test("entries from three configs concatenate left to right", () => {
      const { verify } = mergeProjectConfig(
        {
          verify: {
            workspaceDependencies: { ignoreInputFiles: ["a/**/*"] },
          },
        },
        {
          verify: {
            workspaceDependencies: { ignoreInputFiles: ["b/**/*"] },
          },
        },
        {
          verify: {
            workspaceDependencies: { ignoreInputFiles: ["c/**/*"] },
          },
        },
      );
      expect(verify?.workspaceDependencies?.ignoreInputFiles).toEqual([
        "a/**/*",
        "b/**/*",
        "c/**/*",
      ]);
    });
  });

  describe("verify.workspaceDependencies.ignoreImportsFromWorkspacePatterns", () => {
    test("entries from two configs are concatenated and deduplicated", () => {
      expect(
        mergeProjectConfig(
          {
            verify: {
              workspaceDependencies: {
                ignoreImportsFromWorkspacePatterns: ["tag:a", "shared"],
              },
            },
          },
          {
            verify: {
              workspaceDependencies: {
                ignoreImportsFromWorkspacePatterns: ["tag:b", "shared"],
              },
            },
          },
        ),
      ).toMatchObject({
        verify: {
          workspaceDependencies: {
            ignoreImportsFromWorkspacePatterns: ["tag:a", "shared", "tag:b"],
          },
        },
      });
    });

    test("merges independently of ignoreInputFiles in the same config", () => {
      expect(
        mergeProjectConfig(
          {
            verify: {
              workspaceDependencies: {
                ignoreInputFiles: ["a/**/*"],
                ignoreImportsFromWorkspacePatterns: ["tag:a"],
              },
            },
          },
          {
            verify: {
              workspaceDependencies: {
                ignoreInputFiles: ["b/**/*"],
                ignoreImportsFromWorkspacePatterns: ["tag:b"],
              },
            },
          },
        ),
      ).toMatchObject({
        verify: {
          workspaceDependencies: {
            ignoreInputFiles: ["a/**/*", "b/**/*"],
            ignoreImportsFromWorkspacePatterns: ["tag:a", "tag:b"],
          },
        },
      });
    });
  });

  test("is exported from the main module", async () => {
    const { mergeProjectConfig: imported } = await import("../../src/index");
    expect(imported).toBe(mergeProjectConfig);
  });
});
