import { describe, test, expect } from "bun:test";
import { resolveWorkspaceConfig } from "../../../src/config";
import { validateWorkspaceDependencyRules } from "../../../src/workspaces/dependencyGraph";
import type { WorkspaceMap } from "../../../src/workspaces/dependencyGraph";
import { WORKSPACE_ERRORS } from "../../../src/workspaces/errors";
import { findWorkspaces } from "../../../src/workspaces/findWorkspaces";
import { getProjectRoot } from "../../fixtures/testProjects";
import { makeTestWorkspace } from "../../util/testData";

const makeWorkspaceMapEntry = (
  workspace: ReturnType<typeof makeTestWorkspace>,
  config: Parameters<typeof resolveWorkspaceConfig>[0] = {},
) => ({
  workspace,
  config: resolveWorkspaceConfig(config),
  packageJson: expect.any(Object),
});

// Synthetic root workspace for tests that don't exercise @root semantics —
// validateWorkspaceDependencyRules requires a rootWorkspace for pattern resolution.
const TEST_ROOT_WORKSPACE = makeTestWorkspace({
  name: "__test-root__",
  isRoot: true,
  path: "",
  matchPattern: "",
});

describe("validateWorkspaceDependencyRules", () => {
  describe("no rules", () => {
    test("does nothing when workspaces have no rules", () => {
      const workspaceMap: WorkspaceMap = {
        a: makeWorkspaceMapEntry(
          makeTestWorkspace({ name: "a", dependencies: ["b"] }),
        ),
        b: makeWorkspaceMapEntry(makeTestWorkspace({ name: "b" })),
      };
      expect(() =>
        validateWorkspaceDependencyRules({
          workspaceMap,
          rootWorkspace: TEST_ROOT_WORKSPACE,
        }),
      ).not.toThrow();
    });
  });

  describe("denyPatterns", () => {
    test("throws when a direct dependency matches denyPatterns by name", () => {
      const workspaceMap: WorkspaceMap = {
        a: makeWorkspaceMapEntry(
          makeTestWorkspace({ name: "a", dependencies: ["b"] }),
          { rules: { workspaceDependencies: { denyPatterns: ["b"] } } },
        ),
        b: makeWorkspaceMapEntry(makeTestWorkspace({ name: "b" })),
      };
      expect(() =>
        validateWorkspaceDependencyRules({
          workspaceMap,
          rootWorkspace: TEST_ROOT_WORKSPACE,
        }),
      ).toThrow(WORKSPACE_ERRORS.DependencyRuleViolation);
    });

    test("throws when an indirect dependency matches denyPatterns", () => {
      const workspaceMap: WorkspaceMap = {
        a: makeWorkspaceMapEntry(
          makeTestWorkspace({ name: "a", dependencies: ["b"] }),
          { rules: { workspaceDependencies: { denyPatterns: ["c"] } } },
        ),
        b: makeWorkspaceMapEntry(
          makeTestWorkspace({ name: "b", dependencies: ["c"] }),
        ),
        c: makeWorkspaceMapEntry(makeTestWorkspace({ name: "c" })),
      };
      expect(() =>
        validateWorkspaceDependencyRules({
          workspaceMap,
          rootWorkspace: TEST_ROOT_WORKSPACE,
        }),
      ).toThrow(WORKSPACE_ERRORS.DependencyRuleViolation);
    });

    test("throws when an indirect dependency matches denyPatterns via a longer chain", () => {
      const workspaceMap: WorkspaceMap = {
        a: makeWorkspaceMapEntry(
          makeTestWorkspace({ name: "a", dependencies: ["b"] }),
          { rules: { workspaceDependencies: { denyPatterns: ["d"] } } },
        ),
        b: makeWorkspaceMapEntry(
          makeTestWorkspace({ name: "b", dependencies: ["c"] }),
        ),
        c: makeWorkspaceMapEntry(
          makeTestWorkspace({ name: "c", dependencies: ["d"] }),
        ),
        d: makeWorkspaceMapEntry(makeTestWorkspace({ name: "d" })),
      };
      expect(() =>
        validateWorkspaceDependencyRules({
          workspaceMap,
          rootWorkspace: TEST_ROOT_WORKSPACE,
        }),
      ).toThrow(WORKSPACE_ERRORS.DependencyRuleViolation);
    });

    test("does not throw when no dependencies match denyPatterns", () => {
      const workspaceMap: WorkspaceMap = {
        a: makeWorkspaceMapEntry(
          makeTestWorkspace({ name: "a", dependencies: ["b"] }),
          { rules: { workspaceDependencies: { denyPatterns: ["c"] } } },
        ),
        b: makeWorkspaceMapEntry(makeTestWorkspace({ name: "b" })),
      };
      expect(() =>
        validateWorkspaceDependencyRules({
          workspaceMap,
          rootWorkspace: TEST_ROOT_WORKSPACE,
        }),
      ).not.toThrow();
    });

    test("does not throw when workspace has no dependencies and denyPatterns is set", () => {
      const workspaceMap: WorkspaceMap = {
        a: makeWorkspaceMapEntry(makeTestWorkspace({ name: "a" }), {
          rules: { workspaceDependencies: { denyPatterns: ["b"] } },
        }),
        b: makeWorkspaceMapEntry(makeTestWorkspace({ name: "b" })),
      };
      expect(() =>
        validateWorkspaceDependencyRules({
          workspaceMap,
          rootWorkspace: TEST_ROOT_WORKSPACE,
        }),
      ).not.toThrow();
    });

    test("matches by tag pattern", () => {
      const workspaceMap: WorkspaceMap = {
        a: makeWorkspaceMapEntry(
          makeTestWorkspace({ name: "a", dependencies: ["b"] }),
          {
            rules: {
              workspaceDependencies: { denyPatterns: ["tag:internal"] },
            },
          },
        ),
        b: makeWorkspaceMapEntry(
          makeTestWorkspace({ name: "b", tags: ["internal"] }),
        ),
      };
      expect(() =>
        validateWorkspaceDependencyRules({
          workspaceMap,
          rootWorkspace: TEST_ROOT_WORKSPACE,
        }),
      ).toThrow(WORKSPACE_ERRORS.DependencyRuleViolation);
    });

    test("does not throw when tag does not match denyPatterns", () => {
      const workspaceMap: WorkspaceMap = {
        a: makeWorkspaceMapEntry(
          makeTestWorkspace({ name: "a", dependencies: ["b"] }),
          {
            rules: {
              workspaceDependencies: { denyPatterns: ["tag:internal"] },
            },
          },
        ),
        b: makeWorkspaceMapEntry(
          makeTestWorkspace({ name: "b", tags: ["shared"] }),
        ),
      };
      expect(() =>
        validateWorkspaceDependencyRules({
          workspaceMap,
          rootWorkspace: TEST_ROOT_WORKSPACE,
        }),
      ).not.toThrow();
    });

    test("matches by path pattern", () => {
      const workspaceMap: WorkspaceMap = {
        a: makeWorkspaceMapEntry(
          makeTestWorkspace({
            name: "a",
            dependencies: ["b"],
            path: "packages/a",
          }),
          {
            rules: {
              workspaceDependencies: { denyPatterns: ["path:private/**/*"] },
            },
          },
        ),
        b: makeWorkspaceMapEntry(
          makeTestWorkspace({ name: "b", path: "private/packages/b" }),
        ),
      };
      expect(() =>
        validateWorkspaceDependencyRules({
          workspaceMap,
          rootWorkspace: TEST_ROOT_WORKSPACE,
        }),
      ).toThrow(WORKSPACE_ERRORS.DependencyRuleViolation);
    });

    test("matches by alias pattern", () => {
      const workspaceMap: WorkspaceMap = {
        a: makeWorkspaceMapEntry(
          makeTestWorkspace({ name: "a", dependencies: ["b"] }),
          {
            rules: {
              workspaceDependencies: { denyPatterns: ["alias:my-alias"] },
            },
          },
        ),
        b: makeWorkspaceMapEntry(
          makeTestWorkspace({ name: "b", aliases: ["my-alias"] }),
        ),
      };
      expect(() =>
        validateWorkspaceDependencyRules({
          workspaceMap,
          rootWorkspace: TEST_ROOT_WORKSPACE,
        }),
      ).toThrow(WORKSPACE_ERRORS.DependencyRuleViolation);
    });

    test("matches by wildcard name pattern", () => {
      const workspaceMap: WorkspaceMap = {
        a: makeWorkspaceMapEntry(
          makeTestWorkspace({ name: "a", dependencies: ["private-lib"] }),
          { rules: { workspaceDependencies: { denyPatterns: ["private-*"] } } },
        ),
        "private-lib": makeWorkspaceMapEntry(
          makeTestWorkspace({ name: "private-lib" }),
        ),
      };
      expect(() =>
        validateWorkspaceDependencyRules({
          workspaceMap,
          rootWorkspace: TEST_ROOT_WORKSPACE,
        }),
      ).toThrow(WORKSPACE_ERRORS.DependencyRuleViolation);
    });

    test("only validates the workspace that has the rule, not others", () => {
      const workspaceMap: WorkspaceMap = {
        a: makeWorkspaceMapEntry(
          makeTestWorkspace({ name: "a", dependencies: ["b"] }),
          { rules: { workspaceDependencies: { denyPatterns: ["c"] } } },
        ),
        b: makeWorkspaceMapEntry(
          makeTestWorkspace({ name: "b", dependencies: ["c"] }),
        ),
        c: makeWorkspaceMapEntry(makeTestWorkspace({ name: "c" })),
        // d has no rule and depends on c — should not throw
        d: makeWorkspaceMapEntry(
          makeTestWorkspace({ name: "d", dependencies: ["c"] }),
        ),
      };
      expect(() =>
        validateWorkspaceDependencyRules({
          workspaceMap,
          rootWorkspace: TEST_ROOT_WORKSPACE,
        }),
      ).toThrow(WORKSPACE_ERRORS.DependencyRuleViolation);
    });
  });

  describe("allowPatterns", () => {
    test("does not throw when all direct dependencies are allowed", () => {
      const workspaceMap: WorkspaceMap = {
        a: makeWorkspaceMapEntry(
          makeTestWorkspace({ name: "a", dependencies: ["b"] }),
          { rules: { workspaceDependencies: { allowPatterns: ["b"] } } },
        ),
        b: makeWorkspaceMapEntry(makeTestWorkspace({ name: "b" })),
      };
      expect(() =>
        validateWorkspaceDependencyRules({
          workspaceMap,
          rootWorkspace: TEST_ROOT_WORKSPACE,
        }),
      ).not.toThrow();
    });

    test("does not throw when all transitive dependencies are allowed", () => {
      const workspaceMap: WorkspaceMap = {
        a: makeWorkspaceMapEntry(
          makeTestWorkspace({ name: "a", dependencies: ["b"] }),
          { rules: { workspaceDependencies: { allowPatterns: ["b", "c"] } } },
        ),
        b: makeWorkspaceMapEntry(
          makeTestWorkspace({ name: "b", dependencies: ["c"] }),
        ),
        c: makeWorkspaceMapEntry(makeTestWorkspace({ name: "c" })),
      };
      expect(() =>
        validateWorkspaceDependencyRules({
          workspaceMap,
          rootWorkspace: TEST_ROOT_WORKSPACE,
        }),
      ).not.toThrow();
    });

    test("throws when a direct dependency is not in allowPatterns", () => {
      const workspaceMap: WorkspaceMap = {
        a: makeWorkspaceMapEntry(
          makeTestWorkspace({ name: "a", dependencies: ["b"] }),
          { rules: { workspaceDependencies: { allowPatterns: ["c"] } } },
        ),
        b: makeWorkspaceMapEntry(makeTestWorkspace({ name: "b" })),
        c: makeWorkspaceMapEntry(makeTestWorkspace({ name: "c" })),
      };
      expect(() =>
        validateWorkspaceDependencyRules({
          workspaceMap,
          rootWorkspace: TEST_ROOT_WORKSPACE,
        }),
      ).toThrow(WORKSPACE_ERRORS.DependencyRuleViolation);
    });

    test("throws when an indirect dependency is not in allowPatterns", () => {
      const workspaceMap: WorkspaceMap = {
        a: makeWorkspaceMapEntry(
          makeTestWorkspace({ name: "a", dependencies: ["b"] }),
          { rules: { workspaceDependencies: { allowPatterns: ["b"] } } },
        ),
        b: makeWorkspaceMapEntry(
          makeTestWorkspace({ name: "b", dependencies: ["c"] }),
        ),
        c: makeWorkspaceMapEntry(makeTestWorkspace({ name: "c" })),
      };
      expect(() =>
        validateWorkspaceDependencyRules({
          workspaceMap,
          rootWorkspace: TEST_ROOT_WORKSPACE,
        }),
      ).toThrow(WORKSPACE_ERRORS.DependencyRuleViolation);
    });

    test("allows by tag pattern", () => {
      const workspaceMap: WorkspaceMap = {
        a: makeWorkspaceMapEntry(
          makeTestWorkspace({ name: "a", dependencies: ["b"] }),
          {
            rules: { workspaceDependencies: { allowPatterns: ["tag:shared"] } },
          },
        ),
        b: makeWorkspaceMapEntry(
          makeTestWorkspace({ name: "b", tags: ["shared"] }),
        ),
      };
      expect(() =>
        validateWorkspaceDependencyRules({
          workspaceMap,
          rootWorkspace: TEST_ROOT_WORKSPACE,
        }),
      ).not.toThrow();
    });

    test("throws when dep tag is not in allowPatterns", () => {
      const workspaceMap: WorkspaceMap = {
        a: makeWorkspaceMapEntry(
          makeTestWorkspace({ name: "a", dependencies: ["b"] }),
          {
            rules: { workspaceDependencies: { allowPatterns: ["tag:shared"] } },
          },
        ),
        b: makeWorkspaceMapEntry(
          makeTestWorkspace({ name: "b", tags: ["internal"] }),
        ),
      };
      expect(() =>
        validateWorkspaceDependencyRules({
          workspaceMap,
          rootWorkspace: TEST_ROOT_WORKSPACE,
        }),
      ).toThrow(WORKSPACE_ERRORS.DependencyRuleViolation);
    });

    test("does not throw when workspace has no dependencies and allowPatterns is set", () => {
      const workspaceMap: WorkspaceMap = {
        a: makeWorkspaceMapEntry(makeTestWorkspace({ name: "a" }), {
          rules: { workspaceDependencies: { allowPatterns: ["b"] } },
        }),
        b: makeWorkspaceMapEntry(makeTestWorkspace({ name: "b" })),
      };
      expect(() =>
        validateWorkspaceDependencyRules({
          workspaceMap,
          rootWorkspace: TEST_ROOT_WORKSPACE,
        }),
      ).not.toThrow();
    });
  });

  describe("allowPatterns and denyPatterns combined", () => {
    test("does not throw when dep is in allowPatterns and not in denyPatterns", () => {
      const workspaceMap: WorkspaceMap = {
        a: makeWorkspaceMapEntry(
          makeTestWorkspace({ name: "a", dependencies: ["b"] }),
          {
            rules: {
              workspaceDependencies: {
                allowPatterns: ["b"],
                denyPatterns: ["c"],
              },
            },
          },
        ),
        b: makeWorkspaceMapEntry(makeTestWorkspace({ name: "b" })),
        c: makeWorkspaceMapEntry(makeTestWorkspace({ name: "c" })),
      };
      expect(() =>
        validateWorkspaceDependencyRules({
          workspaceMap,
          rootWorkspace: TEST_ROOT_WORKSPACE,
        }),
      ).not.toThrow();
    });

    test("throws with denyPatterns message when dep is in allowPatterns but also in denyPatterns", () => {
      const workspaceMap: WorkspaceMap = {
        a: makeWorkspaceMapEntry(
          makeTestWorkspace({ name: "a", dependencies: ["b"] }),
          {
            rules: {
              workspaceDependencies: {
                allowPatterns: ["b"],
                denyPatterns: ["b"],
              },
            },
          },
        ),
        b: makeWorkspaceMapEntry(makeTestWorkspace({ name: "b" })),
      };
      expect(() =>
        validateWorkspaceDependencyRules({
          workspaceMap,
          rootWorkspace: TEST_ROOT_WORKSPACE,
        }),
      ).toThrow(WORKSPACE_ERRORS.DependencyRuleViolation);
      try {
        validateWorkspaceDependencyRules({
          workspaceMap,
          rootWorkspace: TEST_ROOT_WORKSPACE,
        });
      } catch (e) {
        expect((e as Error).message).toContain("denied by denyPatterns");
        expect((e as Error).message).not.toContain(
          "not permitted by allowPatterns",
        );
      }
    });

    test("throws with allowPatterns message when dep is not in allowPatterns, regardless of denyPatterns", () => {
      const workspaceMap: WorkspaceMap = {
        a: makeWorkspaceMapEntry(
          makeTestWorkspace({ name: "a", dependencies: ["b"] }),
          {
            rules: {
              workspaceDependencies: {
                allowPatterns: ["c"],
                denyPatterns: ["a"],
              },
            },
          },
        ),
        b: makeWorkspaceMapEntry(makeTestWorkspace({ name: "b" })),
        c: makeWorkspaceMapEntry(makeTestWorkspace({ name: "c" })),
      };
      expect(() =>
        validateWorkspaceDependencyRules({
          workspaceMap,
          rootWorkspace: TEST_ROOT_WORKSPACE,
        }),
      ).toThrow(WORKSPACE_ERRORS.DependencyRuleViolation);
      try {
        validateWorkspaceDependencyRules({
          workspaceMap,
          rootWorkspace: TEST_ROOT_WORKSPACE,
        });
      } catch (e) {
        expect((e as Error).message).toContain(
          "not permitted by allowPatterns",
        );
        expect((e as Error).message).not.toContain("denied by denyPatterns");
      }
    });
  });

  describe("cycles in dependency graph", () => {
    test("does not infinitely recurse on a cyclic dependency graph", () => {
      const workspaceMap: WorkspaceMap = {
        a: makeWorkspaceMapEntry(
          makeTestWorkspace({ name: "a", dependencies: ["b"] }),
        ),
        b: makeWorkspaceMapEntry(
          makeTestWorkspace({ name: "b", dependencies: ["a"] }),
        ),
      };
      expect(() =>
        validateWorkspaceDependencyRules({
          workspaceMap,
          rootWorkspace: TEST_ROOT_WORKSPACE,
        }),
      ).not.toThrow();
    });

    test("validates rules against cyclic deps without infinite recursion", () => {
      const workspaceMap: WorkspaceMap = {
        a: makeWorkspaceMapEntry(
          makeTestWorkspace({ name: "a", dependencies: ["b"] }),
          { rules: { workspaceDependencies: { denyPatterns: ["b"] } } },
        ),
        b: makeWorkspaceMapEntry(
          makeTestWorkspace({ name: "b", dependencies: ["a"] }),
        ),
      };
      expect(() =>
        validateWorkspaceDependencyRules({
          workspaceMap,
          rootWorkspace: TEST_ROOT_WORKSPACE,
        }),
      ).toThrow(WORKSPACE_ERRORS.DependencyRuleViolation);
    });
  });

  describe("@root selector", () => {
    test("denyPatterns: [@root] throws when the root workspace is a transitive dep", () => {
      const rootWs = makeTestWorkspace({ name: "root-ws", isRoot: true });
      const workspaceMap: WorkspaceMap = {
        a: makeWorkspaceMapEntry(
          makeTestWorkspace({ name: "a", dependencies: ["root-ws"] }),
          { rules: { workspaceDependencies: { denyPatterns: ["@root"] } } },
        ),
        "root-ws": makeWorkspaceMapEntry(rootWs),
      };
      expect(() =>
        validateWorkspaceDependencyRules({
          workspaceMap,
          rootWorkspace: rootWs,
        }),
      ).toThrow(WORKSPACE_ERRORS.DependencyRuleViolation);
    });

    test("denyPatterns: [@root] does not falsely flag non-root deps", () => {
      const rootWs = makeTestWorkspace({ name: "root-ws", isRoot: true });
      const workspaceMap: WorkspaceMap = {
        a: makeWorkspaceMapEntry(
          makeTestWorkspace({ name: "a", dependencies: ["b"] }),
          { rules: { workspaceDependencies: { denyPatterns: ["@root"] } } },
        ),
        b: makeWorkspaceMapEntry(makeTestWorkspace({ name: "b" })),
        "root-ws": makeWorkspaceMapEntry(rootWs),
      };
      expect(() =>
        validateWorkspaceDependencyRules({
          workspaceMap,
          rootWorkspace: rootWs,
        }),
      ).not.toThrow();
    });

    test("allowPatterns: [@root] permits only the root workspace as a dep", () => {
      const rootWs = makeTestWorkspace({ name: "root-ws", isRoot: true });
      const workspaceMap: WorkspaceMap = {
        a: makeWorkspaceMapEntry(
          makeTestWorkspace({ name: "a", dependencies: ["root-ws"] }),
          { rules: { workspaceDependencies: { allowPatterns: ["@root"] } } },
        ),
        "root-ws": makeWorkspaceMapEntry(rootWs),
      };
      expect(() =>
        validateWorkspaceDependencyRules({
          workspaceMap,
          rootWorkspace: rootWs,
        }),
      ).not.toThrow();
    });

    test("allowPatterns: [@root] rejects a non-root dep", () => {
      const rootWs = makeTestWorkspace({ name: "root-ws", isRoot: true });
      const workspaceMap: WorkspaceMap = {
        a: makeWorkspaceMapEntry(
          makeTestWorkspace({ name: "a", dependencies: ["b"] }),
          { rules: { workspaceDependencies: { allowPatterns: ["@root"] } } },
        ),
        b: makeWorkspaceMapEntry(makeTestWorkspace({ name: "b" })),
        "root-ws": makeWorkspaceMapEntry(rootWs),
      };
      expect(() =>
        validateWorkspaceDependencyRules({
          workspaceMap,
          rootWorkspace: rootWs,
        }),
      ).toThrow(WORKSPACE_ERRORS.DependencyRuleViolation);
    });
  });
});

describe("findWorkspaces - multi-violation and multi-valid", () => {
  /**
   * Graph: app -> service, lib-a
   *        service -> feature, lib-b  (service <-> feature cycle)
   *        feature -> service
   *        lib-a -> shared
   *        lib-b -> shared
   *
   * Rules:
   *   app:     denyPatterns: ["lib-b"]         → violated (app -> service -> lib-b)
   *   service: allowPatterns: ["feature"]      → violated by lib-b (direct) and shared (indirect via lib-b)
   *   lib-b:   allowPatterns: ["shared"]       → valid (lib-b only reaches shared)
   */
  test("collects all violations into a single error and reports each one", () => {
    let thrownError: unknown;
    try {
      findWorkspaces({
        rootDirectory: getProjectRoot("withDependencyRulesMultiViolation"),
      });
    } catch (e) {
      thrownError = e;
    }

    expect(thrownError).toBeInstanceOf(
      WORKSPACE_ERRORS.DependencyRuleViolation,
    );
    const message = (thrownError as Error).message;

    expect(message).toContain(
      '"app" violates workspaceDependencies rule: workspace "lib-b" is denied by denyPatterns (dependency chain: app -> service -> lib-b)',
    );
    expect(message).toContain(
      '"service" violates workspaceDependencies rule: workspace "lib-b" is not permitted by allowPatterns (dependency chain: service -> lib-b)',
    );
    expect(message).toContain(
      '"service" violates workspaceDependencies rule: workspace "shared" is not permitted by allowPatterns (dependency chain: service -> lib-b -> shared)',
    );
  });

  test("does not throw when all rules are satisfied (same graph complexity, no violations)", () => {
    expect(() =>
      findWorkspaces({
        rootDirectory: getProjectRoot("withDependencyRulesMultiValid"),
      }),
    ).not.toThrow();
  });
});

describe("findWorkspaces with dependency rules", () => {
  describe("denyPatterns", () => {
    test("throws for a direct dependency matching denyPatterns", () => {
      expect(() =>
        findWorkspaces({
          rootDirectory: getProjectRoot("withDependencyRulesDenyDirect"),
        }),
      ).toThrow(WORKSPACE_ERRORS.DependencyRuleViolation);
    });

    test("throws for an indirect dependency matching denyPatterns", () => {
      expect(() =>
        findWorkspaces({
          rootDirectory: getProjectRoot("withDependencyRulesDenyIndirect"),
        }),
      ).toThrow(WORKSPACE_ERRORS.DependencyRuleViolation);
    });

    test("throws for a denied dep in a direct cycle (a -> b -> a)", () => {
      expect(() =>
        findWorkspaces({
          rootDirectory: getProjectRoot("withDependencyRulesDirectCycle"),
        }),
      ).toThrow(WORKSPACE_ERRORS.DependencyRuleViolation);
    });

    test("throws for a denied indirect dep in an indirect cycle (a -> b -> c -> a)", () => {
      expect(() =>
        findWorkspaces({
          rootDirectory: getProjectRoot("withDependencyRulesIndirectCycle"),
        }),
      ).toThrow(WORKSPACE_ERRORS.DependencyRuleViolation);
    });
  });

  describe("allowPatterns", () => {
    test("throws when a direct dependency is not in allowPatterns", () => {
      expect(() =>
        findWorkspaces({
          rootDirectory: getProjectRoot("withDependencyRulesAllowDirect"),
        }),
      ).toThrow(WORKSPACE_ERRORS.DependencyRuleViolation);
    });

    test("throws when an indirect dependency is not in allowPatterns", () => {
      expect(() =>
        findWorkspaces({
          rootDirectory: getProjectRoot("withDependencyRulesAllowIndirect"),
        }),
      ).toThrow(WORKSPACE_ERRORS.DependencyRuleViolation);
    });
  });
});
