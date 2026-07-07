import { resolvePackageManagerAdapter } from "../../../src/packageManager/adapter";
import { assembleProject } from "../../../src/project/implementations/fileSystemProject/assembleProject";
import { validateWorkspaceDependencyRules } from "../../../src/workspaces/dependencyGraph";
import type { WorkspaceMap } from "../../../src/workspaces/dependencyGraph";
import { WORKSPACE_ERRORS } from "../../../src/workspaces/errors";
import { getProjectRoot } from "../../fixtures/testProjects";
import {
  makeTestPackageJson,
  makeTestWorkspace,
  makeWorkspaceMapEntry,
} from "../../util/testData";
import { describe, test, expect } from "../../util/testFramework";

const adapter = resolvePackageManagerAdapter("bun");

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
          {},
          makeTestWorkspace({ name: "a", dependencies: ["b"] }),
        ),
        b: makeWorkspaceMapEntry({}, makeTestWorkspace({ name: "b" })),
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
          { rules: { workspaceDependencies: { denyPatterns: ["b"] } } },
          makeTestWorkspace({ name: "a", dependencies: ["b"] }),
        ),
        b: makeWorkspaceMapEntry({}, makeTestWorkspace({ name: "b" })),
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
          { rules: { workspaceDependencies: { denyPatterns: ["c"] } } },
          makeTestWorkspace({ name: "a", dependencies: ["b"] }),
        ),
        b: makeWorkspaceMapEntry(
          {},
          makeTestWorkspace({ name: "b", dependencies: ["c"] }),
        ),
        c: makeWorkspaceMapEntry({}, makeTestWorkspace({ name: "c" })),
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
          { rules: { workspaceDependencies: { denyPatterns: ["d"] } } },
          makeTestWorkspace({ name: "a", dependencies: ["b"] }),
        ),
        b: makeWorkspaceMapEntry(
          {},
          makeTestWorkspace({ name: "b", dependencies: ["c"] }),
        ),
        c: makeWorkspaceMapEntry(
          {},
          makeTestWorkspace({ name: "c", dependencies: ["d"] }),
        ),
        d: makeWorkspaceMapEntry({}, makeTestWorkspace({ name: "d" })),
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
          { rules: { workspaceDependencies: { denyPatterns: ["c"] } } },
          makeTestWorkspace({ name: "a", dependencies: ["b"] }),
        ),
        b: makeWorkspaceMapEntry({}, makeTestWorkspace({ name: "b" })),
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
        a: makeWorkspaceMapEntry(
          { rules: { workspaceDependencies: { denyPatterns: ["b"] } } },
          makeTestWorkspace({ name: "a" }),
        ),
        b: makeWorkspaceMapEntry({}, makeTestWorkspace({ name: "b" })),
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
          {
            rules: {
              workspaceDependencies: { denyPatterns: ["tag:internal"] },
            },
          },
          makeTestWorkspace({ name: "a", dependencies: ["b"] }),
        ),
        b: makeWorkspaceMapEntry(
          {},
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
          {
            rules: {
              workspaceDependencies: { denyPatterns: ["tag:internal"] },
            },
          },
          makeTestWorkspace({ name: "a", dependencies: ["b"] }),
        ),
        b: makeWorkspaceMapEntry(
          {},
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
          {
            rules: {
              workspaceDependencies: { denyPatterns: ["path:private/**/*"] },
            },
          },
          makeTestWorkspace({
            name: "a",
            dependencies: ["b"],
            path: "packages/a",
          }),
        ),
        b: makeWorkspaceMapEntry(
          {},
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
          {
            rules: {
              workspaceDependencies: { denyPatterns: ["alias:my-alias"] },
            },
          },
          makeTestWorkspace({ name: "a", dependencies: ["b"] }),
        ),
        b: makeWorkspaceMapEntry(
          {},
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
          { rules: { workspaceDependencies: { denyPatterns: ["private-*"] } } },
          makeTestWorkspace({ name: "a", dependencies: ["private-lib"] }),
        ),
        "private-lib": makeWorkspaceMapEntry(
          {},
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
          { rules: { workspaceDependencies: { denyPatterns: ["c"] } } },
          makeTestWorkspace({ name: "a", dependencies: ["b"] }),
        ),
        b: makeWorkspaceMapEntry(
          {},
          makeTestWorkspace({ name: "b", dependencies: ["c"] }),
        ),
        c: makeWorkspaceMapEntry({}, makeTestWorkspace({ name: "c" })),
        // d has no rule and depends on c — should not throw
        d: makeWorkspaceMapEntry(
          {},
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
          { rules: { workspaceDependencies: { allowPatterns: ["b"] } } },
          makeTestWorkspace({ name: "a", dependencies: ["b"] }),
        ),
        b: makeWorkspaceMapEntry({}, makeTestWorkspace({ name: "b" })),
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
          { rules: { workspaceDependencies: { allowPatterns: ["b", "c"] } } },
          makeTestWorkspace({ name: "a", dependencies: ["b"] }),
        ),
        b: makeWorkspaceMapEntry(
          {},
          makeTestWorkspace({ name: "b", dependencies: ["c"] }),
        ),
        c: makeWorkspaceMapEntry({}, makeTestWorkspace({ name: "c" })),
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
          { rules: { workspaceDependencies: { allowPatterns: ["c"] } } },
          makeTestWorkspace({ name: "a", dependencies: ["b"] }),
        ),
        b: makeWorkspaceMapEntry({}, makeTestWorkspace({ name: "b" })),
        c: makeWorkspaceMapEntry({}, makeTestWorkspace({ name: "c" })),
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
          { rules: { workspaceDependencies: { allowPatterns: ["b"] } } },
          makeTestWorkspace({ name: "a", dependencies: ["b"] }),
        ),
        b: makeWorkspaceMapEntry(
          {},
          makeTestWorkspace({ name: "b", dependencies: ["c"] }),
        ),
        c: makeWorkspaceMapEntry({}, makeTestWorkspace({ name: "c" })),
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
          {
            rules: { workspaceDependencies: { allowPatterns: ["tag:shared"] } },
          },
          makeTestWorkspace({ name: "a", dependencies: ["b"] }),
        ),
        b: makeWorkspaceMapEntry(
          {},
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
          {
            rules: { workspaceDependencies: { allowPatterns: ["tag:shared"] } },
          },
          makeTestWorkspace({ name: "a", dependencies: ["b"] }),
        ),
        b: makeWorkspaceMapEntry(
          {},
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
        a: makeWorkspaceMapEntry(
          { rules: { workspaceDependencies: { allowPatterns: ["b"] } } },
          makeTestWorkspace({ name: "a" }),
        ),
        b: makeWorkspaceMapEntry({}, makeTestWorkspace({ name: "b" })),
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
          {
            rules: {
              workspaceDependencies: {
                allowPatterns: ["b"],
                denyPatterns: ["c"],
              },
            },
          },
          makeTestWorkspace({ name: "a", dependencies: ["b"] }),
        ),
        b: makeWorkspaceMapEntry({}, makeTestWorkspace({ name: "b" })),
        c: makeWorkspaceMapEntry({}, makeTestWorkspace({ name: "c" })),
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
          {
            rules: {
              workspaceDependencies: {
                allowPatterns: ["b"],
                denyPatterns: ["b"],
              },
            },
          },
          makeTestWorkspace({ name: "a", dependencies: ["b"] }),
        ),
        b: makeWorkspaceMapEntry({}, makeTestWorkspace({ name: "b" })),
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
          {
            rules: {
              workspaceDependencies: {
                allowPatterns: ["c"],
                denyPatterns: ["a"],
              },
            },
          },
          makeTestWorkspace({ name: "a", dependencies: ["b"] }),
        ),
        b: makeWorkspaceMapEntry({}, makeTestWorkspace({ name: "b" })),
        c: makeWorkspaceMapEntry({}, makeTestWorkspace({ name: "c" })),
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
          {},
          makeTestWorkspace({ name: "a", dependencies: ["b"] }),
        ),
        b: makeWorkspaceMapEntry(
          {},
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
          { rules: { workspaceDependencies: { denyPatterns: ["b"] } } },
          makeTestWorkspace({ name: "a", dependencies: ["b"] }),
        ),
        b: makeWorkspaceMapEntry(
          {},
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
          { rules: { workspaceDependencies: { denyPatterns: ["@root"] } } },
          makeTestWorkspace({ name: "a", dependencies: ["root-ws"] }),
        ),
        "root-ws": makeWorkspaceMapEntry({}, rootWs),
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
          { rules: { workspaceDependencies: { denyPatterns: ["@root"] } } },
          makeTestWorkspace({ name: "a", dependencies: ["b"] }),
        ),
        b: makeWorkspaceMapEntry({}, makeTestWorkspace({ name: "b" })),
        "root-ws": makeWorkspaceMapEntry({}, rootWs),
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
          { rules: { workspaceDependencies: { allowPatterns: ["@root"] } } },
          makeTestWorkspace({ name: "a", dependencies: ["root-ws"] }),
        ),
        "root-ws": makeWorkspaceMapEntry({}, rootWs),
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
          { rules: { workspaceDependencies: { allowPatterns: ["@root"] } } },
          makeTestWorkspace({ name: "a", dependencies: ["b"] }),
        ),
        b: makeWorkspaceMapEntry({}, makeTestWorkspace({ name: "b" })),
        "root-ws": makeWorkspaceMapEntry({ scripts: {} }, rootWs),
      };
      expect(() =>
        validateWorkspaceDependencyRules({
          workspaceMap,
          rootWorkspace: rootWs,
        }),
      ).toThrow(WORKSPACE_ERRORS.DependencyRuleViolation);
    });
  });

  describe("bySource", () => {
    const runValidate = (workspaceMap: WorkspaceMap) =>
      validateWorkspaceDependencyRules({
        workspaceMap,
        rootWorkspace: TEST_ROOT_WORKSPACE,
      });

    test.each([
      "dependencies",
      "devDependencies",
      "peerDependencies",
      "optionalDependencies",
    ] as const)(
      "denyPatterns scoped to %s throws when a dep declared in that field matches",
      (source) => {
        const workspaceMap: WorkspaceMap = {
          a: makeWorkspaceMapEntry(
            {
              rules: {
                workspaceDependencies: {
                  bySource: { [source]: { denyPatterns: ["b"] } },
                },
              },
            },
            makeTestWorkspace({ name: "a", dependencies: ["b"] }),
            makeTestPackageJson({ [source]: { b: "workspace:*" } }),
          ),
          b: makeWorkspaceMapEntry({}, makeTestWorkspace({ name: "b" })),
        };
        expect(() => runValidate(workspaceMap)).toThrow(
          WORKSPACE_ERRORS.DependencyRuleViolation,
        );
      },
    );

    test("allowPatterns scoped to a field permits a matching dep in that field", () => {
      const workspaceMap: WorkspaceMap = {
        a: makeWorkspaceMapEntry(
          {
            rules: {
              workspaceDependencies: {
                bySource: { devDependencies: { allowPatterns: ["b"] } },
              },
            },
          },
          makeTestWorkspace({ name: "a", dependencies: ["b"] }),
          makeTestPackageJson({ devDependencies: { b: "workspace:*" } }),
        ),
        b: makeWorkspaceMapEntry({}, makeTestWorkspace({ name: "b" })),
      };
      expect(() => runValidate(workspaceMap)).not.toThrow();
    });

    test("allowPatterns scoped to a field rejects a non-matching dep in that field", () => {
      const workspaceMap: WorkspaceMap = {
        a: makeWorkspaceMapEntry(
          {
            rules: {
              workspaceDependencies: {
                bySource: { devDependencies: { allowPatterns: ["c"] } },
              },
            },
          },
          makeTestWorkspace({ name: "a", dependencies: ["b"] }),
          makeTestPackageJson({ devDependencies: { b: "workspace:*" } }),
        ),
        b: makeWorkspaceMapEntry({}, makeTestWorkspace({ name: "b" })),
        c: makeWorkspaceMapEntry({}, makeTestWorkspace({ name: "c" })),
      };
      expect(() => runValidate(workspaceMap)).toThrow(
        WORKSPACE_ERRORS.DependencyRuleViolation,
      );
    });

    test("does not govern a dep declared in a field other than the scoped one", () => {
      const workspaceMap: WorkspaceMap = {
        a: makeWorkspaceMapEntry(
          {
            rules: {
              workspaceDependencies: {
                bySource: { devDependencies: { denyPatterns: ["b"] } },
              },
            },
          },
          makeTestWorkspace({ name: "a", dependencies: ["b"] }),
          // b is a production dependency, not a devDependency
          makeTestPackageJson({ dependencies: { b: "workspace:*" } }),
        ),
        b: makeWorkspaceMapEntry({}, makeTestWorkspace({ name: "b" })),
      };
      expect(() => runValidate(workspaceMap)).not.toThrow();
    });

    test("catches a forbidden workspace that leaks in transitively through a scoped dep", () => {
      // a devDepends on b; b (prod) depends on c. A devDependencies-scoped rule
      // must catch c reached through the permitted dev dependency b.
      const workspaceMap: WorkspaceMap = {
        a: makeWorkspaceMapEntry(
          {
            rules: {
              workspaceDependencies: {
                bySource: { devDependencies: { denyPatterns: ["c"] } },
              },
            },
          },
          makeTestWorkspace({ name: "a", dependencies: ["b"] }),
          makeTestPackageJson({ devDependencies: { b: "workspace:*" } }),
        ),
        b: makeWorkspaceMapEntry(
          {},
          makeTestWorkspace({ name: "b", dependencies: ["c"] }),
        ),
        c: makeWorkspaceMapEntry({}, makeTestWorkspace({ name: "c" })),
      };
      expect(() => runValidate(workspaceMap)).toThrow(
        WORKSPACE_ERRORS.DependencyRuleViolation,
      );
      try {
        runValidate(workspaceMap);
      } catch (e) {
        expect((e as Error).message).toContain(
          '"a" violates workspaceDependencies rule for devDependencies: workspace "c" is denied by denyPatterns (dependency chain: a -> b -> c)',
        );
      }
    });

    test("governs a dep for every field it is declared in", () => {
      const workspaceMap: WorkspaceMap = {
        a: makeWorkspaceMapEntry(
          {
            rules: {
              workspaceDependencies: {
                bySource: { optionalDependencies: { denyPatterns: ["b"] } },
              },
            },
          },
          makeTestWorkspace({ name: "a", dependencies: ["b"] }),
          // b is declared in two fields; the optionalDependencies rule still applies
          makeTestPackageJson({
            devDependencies: { b: "workspace:*" },
            optionalDependencies: { b: "workspace:*" },
          }),
        ),
        b: makeWorkspaceMapEntry({}, makeTestWorkspace({ name: "b" })),
      };
      expect(() => runValidate(workspaceMap)).toThrow(
        WORKSPACE_ERRORS.DependencyRuleViolation,
      );
    });

    test("aggregates top-level and per-field violations together", () => {
      const workspaceMap: WorkspaceMap = {
        a: makeWorkspaceMapEntry(
          {
            rules: {
              workspaceDependencies: {
                denyPatterns: ["b"],
                bySource: { devDependencies: { denyPatterns: ["c"] } },
              },
            },
          },
          makeTestWorkspace({ name: "a", dependencies: ["b", "c"] }),
          makeTestPackageJson({
            dependencies: { b: "workspace:*" },
            devDependencies: { c: "workspace:*" },
          }),
        ),
        b: makeWorkspaceMapEntry({}, makeTestWorkspace({ name: "b" })),
        c: makeWorkspaceMapEntry({}, makeTestWorkspace({ name: "c" })),
      };
      expect(() => runValidate(workspaceMap)).toThrow(
        WORKSPACE_ERRORS.DependencyRuleViolation,
      );
      try {
        runValidate(workspaceMap);
      } catch (e) {
        const message = (e as Error).message;
        // Top-level violation carries no field scope label
        expect(message).toContain(
          '"a" violates workspaceDependencies rule: workspace "b" is denied by denyPatterns (dependency chain: a -> b)',
        );
        // Field-scoped violation names the field
        expect(message).toContain(
          '"a" violates workspaceDependencies rule for devDependencies: workspace "c" is denied by denyPatterns (dependency chain: a -> c)',
        );
      }
    });

    test("does nothing when a bySource field has no declared workspace deps", () => {
      const workspaceMap: WorkspaceMap = {
        a: makeWorkspaceMapEntry(
          {
            rules: {
              workspaceDependencies: {
                bySource: { devDependencies: { denyPatterns: ["b"] } },
              },
            },
          },
          makeTestWorkspace({ name: "a", dependencies: ["b"] }),
          // no devDependencies at all
          makeTestPackageJson({ dependencies: { b: "workspace:*" } }),
        ),
        b: makeWorkspaceMapEntry({}, makeTestWorkspace({ name: "b" })),
      };
      expect(() => runValidate(workspaceMap)).not.toThrow();
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
      assembleProject({
        adapter,
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
      assembleProject({
        adapter,
        rootDirectory: getProjectRoot("withDependencyRulesMultiValid"),
      }),
    ).not.toThrow();
  });
});

describe("findWorkspaces with dependency rules", () => {
  describe("denyPatterns", () => {
    test("throws for a direct dependency matching denyPatterns", () => {
      expect(() =>
        assembleProject({
          adapter,
          rootDirectory: getProjectRoot("withDependencyRulesDenyDirect"),
        }),
      ).toThrow(WORKSPACE_ERRORS.DependencyRuleViolation);
    });

    test("throws for an indirect dependency matching denyPatterns", () => {
      expect(() =>
        assembleProject({
          adapter,
          rootDirectory: getProjectRoot("withDependencyRulesDenyIndirect"),
        }),
      ).toThrow(WORKSPACE_ERRORS.DependencyRuleViolation);
    });

    test("throws for a denied dep in a direct cycle (a -> b -> a)", () => {
      expect(() =>
        assembleProject({
          adapter,
          rootDirectory: getProjectRoot("withDependencyRulesDirectCycle"),
        }),
      ).toThrow(WORKSPACE_ERRORS.DependencyRuleViolation);
    });

    test("throws for a denied indirect dep in an indirect cycle (a -> b -> c -> a)", () => {
      expect(() =>
        assembleProject({
          adapter,
          rootDirectory: getProjectRoot("withDependencyRulesIndirectCycle"),
        }),
      ).toThrow(WORKSPACE_ERRORS.DependencyRuleViolation);
    });
  });

  describe("allowPatterns", () => {
    test("throws when a direct dependency is not in allowPatterns", () => {
      expect(() =>
        assembleProject({
          adapter,
          rootDirectory: getProjectRoot("withDependencyRulesAllowDirect"),
        }),
      ).toThrow(WORKSPACE_ERRORS.DependencyRuleViolation);
    });

    test("throws when an indirect dependency is not in allowPatterns", () => {
      expect(() =>
        assembleProject({
          adapter,
          rootDirectory: getProjectRoot("withDependencyRulesAllowIndirect"),
        }),
      ).toThrow(WORKSPACE_ERRORS.DependencyRuleViolation);
    });
  });

  describe("bySource", () => {
    test("throws for a workspace that leaks in transitively through a devDependencies-scoped rule", () => {
      // a devDepends on b (packages/a devDependencies), b depends on c.
      // a's rule denies "c" scoped to devDependencies.
      let thrownError: unknown;
      try {
        assembleProject({
          adapter,
          rootDirectory: getProjectRoot("withDependencyRulesBySourceViolation"),
        });
      } catch (e) {
        thrownError = e;
      }
      expect(thrownError).toBeInstanceOf(
        WORKSPACE_ERRORS.DependencyRuleViolation,
      );
      expect((thrownError as Error).message).toContain(
        '"a" violates workspaceDependencies rule for devDependencies: workspace "c" is denied by denyPatterns (dependency chain: a -> b -> c)',
      );
    });

    test("does not throw when the denied dep is declared in a field the rule does not scope", () => {
      // Same graph, but b is a production dependency of a, so the
      // devDependencies-scoped rule never reaches c.
      expect(() =>
        assembleProject({
          adapter,
          rootDirectory: getProjectRoot("withDependencyRulesBySourceValid"),
        }),
      ).not.toThrow();
    });
  });
});
