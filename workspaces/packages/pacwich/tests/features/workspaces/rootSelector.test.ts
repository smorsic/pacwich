import { createFileSystemProject } from "../../../src";
import { getProjectRoot } from "../../fixtures/testProjects";
import { setupCliTest } from "../../util/cliTestUtils";
import { describe, expect, test } from "../../util/testFramework";

describe("Test root selector", () => {
  describe("API", () => {
    test("findWorkspacesByPattern selects root when not included", () => {
      const projectNoRoot = createFileSystemProject({
        rootDirectory: getProjectRoot("withRootWorkspace"),
        includeRootWorkspace: false,
      });

      expect(projectNoRoot.findWorkspacesByPattern("@root")).toEqual([
        projectNoRoot.rootWorkspace,
      ]);
    });

    test("findWorkspacesByPattern combines root with other patterns", () => {
      const projectNoRoot = createFileSystemProject({
        rootDirectory: getProjectRoot("withRootWorkspace"),
        includeRootWorkspace: false,
      });

      expect(
        projectNoRoot.findWorkspacesByPattern("application-*", "@root"),
      ).toEqual([
        projectNoRoot.rootWorkspace,
        projectNoRoot.findWorkspaceByName("application-1a")!,
        projectNoRoot.findWorkspaceByName("application-1b")!,
      ]);
    });

    test("findWorkspacesByPattern selects root when included", () => {
      const projectWithRoot = createFileSystemProject({
        rootDirectory: getProjectRoot("withRootWorkspace"),
        includeRootWorkspace: true,
      });

      expect(projectWithRoot.findWorkspacesByPattern("@root")).toEqual([
        projectWithRoot.rootWorkspace,
      ]);
    });

    test("not:@root subtracts the root from a result set that included it", () => {
      const projectNoRoot = createFileSystemProject({
        rootDirectory: getProjectRoot("withRootWorkspace"),
        includeRootWorkspace: false,
      });

      expect(
        projectNoRoot
          .findWorkspacesByPattern("*", "@root", "not:@root")
          .map((w) => w.name)
          .sort(),
      ).toEqual([
        "application-1a",
        "application-1b",
        "library-1a",
        "library-1b",
      ]);
    });

    test("@root combined with not:@root yields empty (positive then negation cancel)", () => {
      const projectNoRoot = createFileSystemProject({
        rootDirectory: getProjectRoot("withRootWorkspace"),
        includeRootWorkspace: false,
      });

      expect(
        projectNoRoot.findWorkspacesByPattern("@root", "not:@root"),
      ).toEqual([]);
    });
  });

  describe("CLI", () => {
    test("workspace-info shows root workspace", async () => {
      const { run } = setupCliTest({
        testProject: "withRootWorkspace",
      });

      const result = await run("--no-include-root", "workspace-info", "@root");
      expect(result.exitCode).toBe(0);
      expect(result.stdout.raw).toContain(
        `Workspace: test-root (root)
 - Aliases: my-root-alias
 - Path: 
 - Glob Match: 
 - Scripts: all-workspaces, root-workspace`,
      );
    });

    test("run-script runs on root workspace", async () => {
      const { run } = setupCliTest({
        testProject: "withRootWorkspace",
      });

      const result = await run(
        "--no-include-root",
        "run-script",
        "root-workspace",
        "@root",
      );
      expect(result.exitCode).toBe(0);
      expect(result.stdout.sanitizedCompactLines).toContain(
        `[test-root] script for root workspace
✅ test-root: root-workspace
1 script ran successfully`,
      );
    });
  });
});
