import type {
  RawWorkspace,
  ResolvedWorkspaceConfig,
} from "../../../src/config/public";
import { resolvePackageManagerAdapter } from "../../../src/packageManager/adapter";
import { createFileSystemProject } from "../../../src/project";
import { assembleProject } from "../../../src/project/implementations/fileSystemProject/assembleProject";
import { WORKSPACE_ERRORS } from "../../../src/workspaces/errors";
import { getProjectRoot } from "../../fixtures/testProjects";
import { describe, expect, test } from "../../util/testFramework";

const adapter = resolvePackageManagerAdapter("bun");

// workspaceTags fixture: four workspaces with pre-existing aliases and tags via package.json pacwich field
// application-1a: aliases=["appA"], tags=["app","workspace"], path=applications/applicationA
// application-1b: aliases=["appB"], tags=["workspace","app"], path=applications/applicationB
// library-1a:     aliases=["libA"], tags=["lib","workspace"], path=libraries/libraryA
// library-1b:     aliases=["libB"], tags=["workspace","lib"], path=libraries/libraryB
const WORKSPACE_TAGS_ROOT = getProjectRoot("workspaceTags");

describe("workspacePatternConfigs - via findWorkspaces", () => {
  describe("basic matching", () => {
    test("name match applies config to matched workspace only", () => {
      const { workspaces } = assembleProject({
        adapter,
        rootDirectory: WORKSPACE_TAGS_ROOT,
        workspacePatternConfigs: [
          { patterns: ["application-1a"], config: { alias: "pattern-alias" } },
        ],
      });
      const appA = workspaces.find((w) => w.name === "application-1a")!;
      const appB = workspaces.find((w) => w.name === "application-1b")!;
      expect(appA.aliases).toContain("pattern-alias");
      expect(appB.aliases).not.toContain("pattern-alias");
    });

    test("wildcard name match applies to all matching workspaces", () => {
      const { workspaces } = assembleProject({
        adapter,
        rootDirectory: WORKSPACE_TAGS_ROOT,
        workspacePatternConfigs: [
          { patterns: ["application-*"], config: { tags: ["is-application"] } },
        ],
      });
      const apps = workspaces.filter((w) => w.name.startsWith("application-"));
      const libs = workspaces.filter((w) => w.name.startsWith("library-"));
      for (const app of apps) expect(app.tags).toContain("is-application");
      for (const lib of libs) expect(lib.tags).not.toContain("is-application");
    });

    test("path: pattern matches workspaces by path glob", () => {
      const { workspaces } = assembleProject({
        adapter,
        rootDirectory: WORKSPACE_TAGS_ROOT,
        workspacePatternConfigs: [
          {
            patterns: ["path:libraries/**/*"],
            config: { tags: ["lib-by-path"] },
          },
        ],
      });
      const libs = workspaces.filter((w) => w.path.startsWith("libraries"));
      const apps = workspaces.filter((w) => w.path.startsWith("applications"));
      for (const lib of libs) expect(lib.tags).toContain("lib-by-path");
      for (const app of apps) expect(app.tags).not.toContain("lib-by-path");
    });

    test("tag: pattern matches workspaces with that local tag", () => {
      const { workspaces } = assembleProject({
        adapter,
        rootDirectory: WORKSPACE_TAGS_ROOT,
        workspacePatternConfigs: [
          { patterns: ["tag:lib"], config: { tags: ["matched-by-lib-tag"] } },
        ],
      });
      const libA = workspaces.find((w) => w.name === "library-1a")!;
      const libB = workspaces.find((w) => w.name === "library-1b")!;
      const appA = workspaces.find((w) => w.name === "application-1a")!;
      expect(libA.tags).toContain("matched-by-lib-tag");
      expect(libB.tags).toContain("matched-by-lib-tag");
      expect(appA.tags).not.toContain("matched-by-lib-tag");
    });

    test("alias: pattern matches workspace with that local alias", () => {
      const { workspaces } = assembleProject({
        adapter,
        rootDirectory: WORKSPACE_TAGS_ROOT,
        workspacePatternConfigs: [
          {
            patterns: ["alias:appA"],
            config: { tags: ["matched-by-appA-alias"] },
          },
        ],
      });
      const appA = workspaces.find((w) => w.name === "application-1a")!;
      const appB = workspaces.find((w) => w.name === "application-1b")!;
      expect(appA.tags).toContain("matched-by-appA-alias");
      expect(appB.tags).not.toContain("matched-by-appA-alias");
    });

    test("not: pattern excludes matched workspaces from the positive set", () => {
      const { workspaces } = assembleProject({
        adapter,
        rootDirectory: WORKSPACE_TAGS_ROOT,
        workspacePatternConfigs: [
          {
            patterns: ["library-*", "not:library-1a"],
            config: { tags: ["lib-not-a"] },
          },
        ],
      });
      const libA = workspaces.find((w) => w.name === "library-1a")!;
      const libB = workspaces.find((w) => w.name === "library-1b")!;
      expect(libB.tags).toContain("lib-not-a");
      expect(libA.tags).not.toContain("lib-not-a");
    });

    test("entry with no matching workspaces applies nothing and does not throw", () => {
      const { workspaces } = assembleProject({
        adapter,
        rootDirectory: WORKSPACE_TAGS_ROOT,
        workspacePatternConfigs: [
          {
            patterns: ["nonexistent-workspace"],
            config: { tags: ["unreachable"] },
          },
        ],
      });
      for (const w of workspaces) {
        expect(w.tags).not.toContain("unreachable");
      }
    });

    test("@root pattern applies config to the root workspace (includeRootWorkspace=false)", () => {
      const { rootWorkspace, workspaces } = assembleProject({
        adapter,
        rootDirectory: getProjectRoot("withRootWorkspace"),
        includeRootWorkspace: false,
        workspacePatternConfigs: [
          { patterns: ["@root"], config: { tags: ["root-tagged"] } },
        ],
      });
      expect(rootWorkspace.tags).toContain("root-tagged");
      for (const w of workspaces) {
        expect(w.tags).not.toContain("root-tagged");
      }
    });

    test("@root pattern applies config to the root workspace (includeRootWorkspace=true)", () => {
      const { rootWorkspace, workspaces } = assembleProject({
        adapter,
        rootDirectory: getProjectRoot("withRootWorkspace"),
        includeRootWorkspace: true,
        workspacePatternConfigs: [
          { patterns: ["@root"], config: { tags: ["root-tagged"] } },
        ],
      });
      expect(rootWorkspace.tags).toContain("root-tagged");
      const nonRoot = workspaces.filter((w) => !w.isRoot);
      for (const w of nonRoot) {
        expect(w.tags).not.toContain("root-tagged");
      }
    });

    test("not:@root excludes the root workspace from a wildcard match", () => {
      const { rootWorkspace, workspaces } = assembleProject({
        adapter,
        rootDirectory: getProjectRoot("withRootWorkspace"),
        includeRootWorkspace: true,
        workspacePatternConfigs: [
          {
            patterns: ["*", "not:@root"],
            config: { tags: ["non-root-tagged"] },
          },
        ],
      });
      expect(rootWorkspace.tags).not.toContain("non-root-tagged");
      const nonRoot = workspaces.filter((w) => !w.isRoot);
      for (const w of nonRoot) {
        expect(w.tags).toContain("non-root-tagged");
      }
    });
  });

  describe("multiple entries applied left to right", () => {
    test("all entries are applied in sequence to their matched workspaces", () => {
      const { workspaces } = assembleProject({
        adapter,
        rootDirectory: WORKSPACE_TAGS_ROOT,
        workspacePatternConfigs: [
          { patterns: ["application-1a"], config: { alias: "entry-1-alias" } },
          { patterns: ["application-1a"], config: { alias: "entry-2-alias" } },
        ],
      });
      const appA = workspaces.find((w) => w.name === "application-1a")!;
      expect(appA.aliases).toContain("entry-1-alias");
      expect(appA.aliases).toContain("entry-2-alias");
    });

    test("each entry only affects its own matched workspaces", () => {
      const { workspaces } = assembleProject({
        adapter,
        rootDirectory: WORKSPACE_TAGS_ROOT,
        workspacePatternConfigs: [
          { patterns: ["application-1a"], config: { tags: ["entry-1-tag"] } },
          { patterns: ["library-1a"], config: { tags: ["entry-2-tag"] } },
        ],
      });
      const appA = workspaces.find((w) => w.name === "application-1a")!;
      const libA = workspaces.find((w) => w.name === "library-1a")!;
      expect(appA.tags).toContain("entry-1-tag");
      expect(appA.tags).not.toContain("entry-2-tag");
      expect(libA.tags).toContain("entry-2-tag");
      expect(libA.tags).not.toContain("entry-1-tag");
    });
  });

  describe("accumulated state", () => {
    test("alias added by entry 1 can be matched by alias: in entry 2", () => {
      const { workspaces } = assembleProject({
        adapter,
        rootDirectory: WORKSPACE_TAGS_ROOT,
        workspacePatternConfigs: [
          {
            patterns: ["application-1a"],
            config: { alias: "accumulated-alias" },
          },
          {
            patterns: ["alias:accumulated-alias"],
            config: { tags: ["matched-by-accumulated-alias"] },
          },
        ],
      });
      const appA = workspaces.find((w) => w.name === "application-1a")!;
      const appB = workspaces.find((w) => w.name === "application-1b")!;
      expect(appA.tags).toContain("matched-by-accumulated-alias");
      expect(appB.tags).not.toContain("matched-by-accumulated-alias");
    });

    test("tag added by entry 1 can be matched by tag: in entry 2", () => {
      const { workspaces } = assembleProject({
        adapter,
        rootDirectory: WORKSPACE_TAGS_ROOT,
        workspacePatternConfigs: [
          { patterns: ["library-1a"], config: { tags: ["accumulated-tag"] } },
          {
            patterns: ["tag:accumulated-tag"],
            config: { alias: "matched-by-accumulated-tag" },
          },
        ],
      });
      const libA = workspaces.find((w) => w.name === "library-1a")!;
      const libB = workspaces.find((w) => w.name === "library-1b")!;
      expect(libA.aliases).toContain("matched-by-accumulated-tag");
      expect(libB.aliases).not.toContain("matched-by-accumulated-tag");
    });

    test("only workspaces that received the alias/tag can be matched by it in later entries", () => {
      const { workspaces } = assembleProject({
        adapter,
        rootDirectory: WORKSPACE_TAGS_ROOT,
        workspacePatternConfigs: [
          { patterns: ["application-1a"], config: { tags: ["specific-tag"] } },
          {
            patterns: ["tag:specific-tag"],
            config: { alias: "tag-propagated" },
          },
        ],
      });
      const appA = workspaces.find((w) => w.name === "application-1a")!;
      const appB = workspaces.find((w) => w.name === "application-1b")!;
      const libA = workspaces.find((w) => w.name === "library-1a")!;
      expect(appA.aliases).toContain("tag-propagated");
      expect(appB.aliases).not.toContain("tag-propagated");
      expect(libA.aliases).not.toContain("tag-propagated");
    });
  });

  describe("factory function form", () => {
    test("factory receives correct RawWorkspace context", () => {
      const contexts: RawWorkspace[] = [];
      assembleProject({
        adapter,
        rootDirectory: WORKSPACE_TAGS_ROOT,
        workspacePatternConfigs: [
          {
            patterns: ["application-1a"],
            config: (ctx) => {
              contexts.push(ctx);
              return {};
            },
          },
        ],
      });
      expect(contexts).toHaveLength(1);
      expect(contexts[0]).toEqual({
        name: "application-1a",
        isRoot: false,
        path: "applications/applicationA",
        matchPattern: "applications/*",
        scripts: expect.arrayContaining(["application-a", "all-workspaces"]),
        dependencies: [],
        dependents: [],
      });
    });

    test("factory prevConfig reflects local workspace config", () => {
      const prevConfigs: ResolvedWorkspaceConfig[] = [];
      assembleProject({
        adapter,
        rootDirectory: WORKSPACE_TAGS_ROOT,
        workspacePatternConfigs: [
          {
            patterns: ["application-1a"],
            config: (_, prev) => {
              prevConfigs.push(prev);
              return {};
            },
          },
        ],
      });
      expect(prevConfigs[0].aliases).toContain("appA");
      expect(prevConfigs[0].tags).toContain("app");
      expect(prevConfigs[0].tags).toContain("workspace");
    });

    test("factory prevConfig reflects config accumulated by prior pattern entries", () => {
      const prevConfigs: ResolvedWorkspaceConfig[] = [];
      assembleProject({
        adapter,
        rootDirectory: WORKSPACE_TAGS_ROOT,
        workspacePatternConfigs: [
          {
            patterns: ["application-1a"],
            config: { alias: "entry-1-alias", tags: ["entry-1-tag"] },
          },
          {
            patterns: ["application-1a"],
            config: (_, prev) => {
              prevConfigs.push(prev);
              return {};
            },
          },
        ],
      });
      expect(prevConfigs[0].aliases).toContain("appA");
      expect(prevConfigs[0].aliases).toContain("entry-1-alias");
      expect(prevConfigs[0].tags).toContain("app");
      expect(prevConfigs[0].tags).toContain("entry-1-tag");
    });

    test("factory return value is merged as a WorkspaceConfig", () => {
      const { workspaces } = assembleProject({
        adapter,
        rootDirectory: WORKSPACE_TAGS_ROOT,
        workspacePatternConfigs: [
          {
            patterns: ["application-*"],
            config: (ctx) => ({
              alias: `${ctx.name}-dynamic`,
              tags: ["from-factory"],
            }),
          },
        ],
      });
      const appA = workspaces.find((w) => w.name === "application-1a")!;
      const appB = workspaces.find((w) => w.name === "application-1b")!;
      expect(appA.aliases).toContain("application-1a-dynamic");
      expect(appB.aliases).toContain("application-1b-dynamic");
      expect(appA.tags).toContain("from-factory");
      expect(appB.tags).toContain("from-factory");
    });
  });

  describe("combined with local workspace config", () => {
    test("local config aliases are preserved and new aliases are added on top", () => {
      const { workspaces } = assembleProject({
        adapter,
        rootDirectory: WORKSPACE_TAGS_ROOT,
        workspacePatternConfigs: [
          { patterns: ["application-1a"], config: { alias: "pattern-added" } },
        ],
      });
      const appA = workspaces.find((w) => w.name === "application-1a")!;
      expect(appA.aliases).toContain("appA");
      expect(appA.aliases).toContain("pattern-added");
    });

    test("local config tags are preserved and new tags are added on top", () => {
      const { workspaces } = assembleProject({
        adapter,
        rootDirectory: WORKSPACE_TAGS_ROOT,
        workspacePatternConfigs: [
          { patterns: ["library-1a"], config: { tags: ["extra-tag"] } },
        ],
      });
      const libA = workspaces.find((w) => w.name === "library-1a")!;
      expect(libA.tags).toContain("lib");
      expect(libA.tags).toContain("extra-tag");
    });

    test("local config tags appear before pattern config tags in merged array", () => {
      // library-1a local tags: ["lib", "workspace"] — pattern config adds after
      const { workspaces } = assembleProject({
        adapter,
        rootDirectory: WORKSPACE_TAGS_ROOT,
        workspacePatternConfigs: [
          { patterns: ["library-1a"], config: { tags: ["pattern-tag"] } },
        ],
      });
      const libA = workspaces.find((w) => w.name === "library-1a")!;
      const libIndex = libA.tags.indexOf("lib");
      const patternIndex = libA.tags.indexOf("pattern-tag");
      expect(libIndex).toBeGreaterThanOrEqual(0);
      expect(patternIndex).toBeGreaterThanOrEqual(0);
      expect(libIndex).toBeLessThan(patternIndex);
    });

    test("local config allowPatterns appear before pattern config allowPatterns in merged rules", () => {
      // workspace "a" in withDependencyRulesAllowDirect has local allowPatterns: ["c"]
      const { workspaceMap } = assembleProject({
        adapter,
        rootDirectory: getProjectRoot("withDependencyRulesAllowDirect"),
        workspacePatternConfigs: [
          {
            patterns: ["a"],
            config: {
              rules: { workspaceDependencies: { allowPatterns: ["b"] } },
            },
          },
        ],
      });
      const allow =
        workspaceMap["a"].config.rules.workspaceDependencies?.allowPatterns ??
        [];
      expect(allow.indexOf("c")).toBeLessThan(allow.indexOf("b"));
    });

    test("workspaceMap config reflects merged result of local config and pattern configs", () => {
      const { workspaceMap } = assembleProject({
        adapter,
        rootDirectory: WORKSPACE_TAGS_ROOT,
        workspacePatternConfigs: [
          {
            patterns: ["application-1a"],
            config: { alias: "map-alias", tags: ["map-tag"] },
          },
        ],
      });
      const config = workspaceMap["application-1a"].config;
      expect(config.aliases).toContain("appA");
      expect(config.aliases).toContain("map-alias");
      expect(config.tags).toContain("app");
      expect(config.tags).toContain("map-tag");
    });
  });

  describe("alias validation", () => {
    test("alias added by pattern config that equals an existing workspace name throws AliasConflict", () => {
      expect(() =>
        assembleProject({
          adapter,
          rootDirectory: WORKSPACE_TAGS_ROOT,
          workspacePatternConfigs: [
            {
              patterns: ["application-1a"],
              config: { alias: "library-1b" },
            },
          ],
        }),
      ).toThrow(WORKSPACE_ERRORS.AliasConflict);
    });

    test("same alias assigned to two different workspaces by separate entries throws AliasConflict", () => {
      expect(() =>
        assembleProject({
          adapter,
          rootDirectory: WORKSPACE_TAGS_ROOT,
          workspacePatternConfigs: [
            {
              patterns: ["application-1a"],
              config: { alias: "shared-conflict" },
            },
            { patterns: ["library-1a"], config: { alias: "shared-conflict" } },
          ],
        }),
      ).toThrow(WORKSPACE_ERRORS.AliasConflict);
    });
  });
});

describe("workspacePatternConfigs - root config file (pacwich.project.ts)", () => {
  test("pattern configs from pacwich.project.ts are applied to matched workspaces", () => {
    const project = createFileSystemProject({
      rootDirectory: getProjectRoot("projectConfigWorkspacePatternConfigs"),
    });
    const wsA = project.findWorkspaceByName("workspace-a")!;
    const wsB = project.findWorkspaceByName("workspace-b")!;
    expect(wsA.aliases).toContain("ws-a");
    expect(wsB.aliases).toContain("ws-b");
    expect(wsA.tags).toContain("type-a");
    expect(wsB.tags).toContain("type-b");
  });

  test("accumulated tag from first entry matches workspace in third entry", () => {
    const project = createFileSystemProject({
      rootDirectory: getProjectRoot("projectConfigWorkspacePatternConfigs"),
    });
    // pacwich.project.ts entry 1 adds tag:type-a to workspace-a; entry 3 matches tag:type-a
    const wsA = project.findWorkspaceByName("workspace-a")!;
    const wsB = project.findWorkspaceByName("workspace-b")!;
    expect(wsA.tags).toContain("accumulated-match");
    expect(wsB.tags).not.toContain("accumulated-match");
  });

  test("workspaces not matched by any pattern retain their original config", () => {
    const project = createFileSystemProject({
      rootDirectory: getProjectRoot("projectConfigWorkspacePatternConfigs"),
    });
    // no pattern in pacwich.project.ts adds anything to workspace-b except type-b alias ws-b
    const wsB = project.findWorkspaceByName("workspace-b")!;
    expect(wsB.aliases).not.toContain("ws-a");
    expect(wsB.tags).not.toContain("type-a");
    expect(wsB.tags).not.toContain("accumulated-match");
  });
});
