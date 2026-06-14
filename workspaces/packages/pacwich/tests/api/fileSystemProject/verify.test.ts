import { InvalidJSTypeError } from "../../../src/internal/core";
import {
  createFileSystemProject,
  type ImplicitWorkspaceDependencyMetadata,
  type VerifyIssue,
  type VerifyResult,
} from "../../../src/project";
import { getProjectRoot } from "../../fixtures/testProjects";
import { describe, expect, test } from "../../util/testFramework";

const buildProject = (fixtureName: "verifySimple" | "verifyWithIgnore") =>
  createFileSystemProject({ rootDirectory: getProjectRoot(fixtureName) });

const allIssues = (result: VerifyResult): VerifyIssue[] => [
  ...result.errors,
  ...result.warnings,
];

const allImplicitDepMetadata = (
  result: VerifyResult,
): ImplicitWorkspaceDependencyMetadata[] =>
  allIssues(result)
    .filter(
      (issue): issue is VerifyIssue<"implicitWorkspaceDependency"> =>
        issue.name === "implicitWorkspaceDependency",
    )
    .map((issue) => issue.metadata);

const findImplicitDep = (
  result: VerifyResult,
  workspace: string,
  dependency: string,
): ImplicitWorkspaceDependencyMetadata | undefined =>
  allImplicitDepMetadata(result).find(
    (metadata) =>
      metadata.workspace === workspace && metadata.dependency === dependency,
  );

describe("project.verify (API)", () => {
  describe("default options", () => {
    test("ok is true when not in strict mode even if findings exist", async () => {
      const project = buildProject("verifySimple");
      const result = await project.verify();
      expect(result.ok).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    test("findings are warnings in non-strict mode", async () => {
      const project = buildProject("verifySimple");
      const result = await project.verify();
      for (const issue of result.warnings) {
        expect(issue.level).toBe("warn");
      }
    });

    test("each warning has name='implicitWorkspaceDependency'", async () => {
      const project = buildProject("verifySimple");
      const result = await project.verify();
      for (const issue of result.warnings) {
        expect(issue.name).toBe("implicitWorkspaceDependency");
      }
    });
  });

  describe("simple fixture findings", () => {
    test("flags app-c importing lib-b without declaring it", async () => {
      const project = buildProject("verifySimple");
      const result = await project.verify();
      const metadata = findImplicitDep(result, "app-c", "lib-b");
      expect(metadata).toBeDefined();
      expect(metadata!.files).toEqual([
        {
          path: "packages/app-c/src/index.ts",
          occurrences: [
            { line: 3, specifier: "lib-b" },
            { line: 4, specifier: "lib-b/sub/path" },
          ],
        },
      ]);
    });

    test("does not flag app-c for lib-a (it is declared)", async () => {
      const project = buildProject("verifySimple");
      const result = await project.verify();
      expect(findImplicitDep(result, "app-c", "lib-a")).toBeUndefined();
    });

    test("does not flag lib-b for lib-a (it is declared)", async () => {
      const project = buildProject("verifySimple");
      const result = await project.verify();
      expect(findImplicitDep(result, "lib-b", "lib-a")).toBeUndefined();
    });

    test("does not flag self-imports (app-e → app-e/sub-module)", async () => {
      const project = buildProject("verifySimple");
      const result = await project.verify();
      expect(findImplicitDep(result, "app-e", "app-e")).toBeUndefined();
    });

    test("does not flag imports of non-workspace packages (app-e → node:path, fs)", async () => {
      const project = buildProject("verifySimple");
      const result = await project.verify();
      const appEMeta = allImplicitDepMetadata(result).filter(
        (metadata) => metadata.workspace === "app-e",
      );
      expect(appEMeta).toEqual([]);
    });

    test("does not flag app-d which only has commented-out and string-literal imports", async () => {
      const project = buildProject("verifySimple");
      const result = await project.verify();
      const appDMeta = allImplicitDepMetadata(result).filter(
        (metadata) => metadata.workspace === "app-d",
      );
      expect(appDMeta).toEqual([]);
    });

    test("returned issues are sorted by workspace then dependency", async () => {
      const project = buildProject("verifySimple");
      const result = await project.verify();
      const keys = allImplicitDepMetadata(result).map(
        (metadata) => `${metadata.workspace}::${metadata.dependency}`,
      );
      const sortedKeys = [...keys].sort();
      expect(keys).toEqual(sortedKeys);
    });

    test("fixHint is non-empty and references the importing workspace's package.json", async () => {
      const project = buildProject("verifySimple");
      const result = await project.verify();
      const metadata = findImplicitDep(result, "app-c", "lib-b");
      expect(metadata!.fixHint).toContain('"lib-b"');
      expect(metadata!.fixHint).toContain("packages/app-c/package.json");
      expect(metadata!.fixHint).toContain("dependencies");
    });

    test("fixHint uses pm-adapter version string (bun → '*')", async () => {
      const project = buildProject("verifySimple");
      const result = await project.verify();
      const metadata = findImplicitDep(result, "app-c", "lib-b");
      expect(metadata!.fixHint).toContain('"*"');
    });

    test("issue.message embeds the fixHint and source locations", async () => {
      const project = buildProject("verifySimple");
      const result = await project.verify();
      const issue = result.warnings.find(
        (issue): issue is VerifyIssue<"implicitWorkspaceDependency"> =>
          issue.name === "implicitWorkspaceDependency" &&
          issue.metadata.workspace === "app-c" &&
          issue.metadata.dependency === "lib-b",
      );
      expect(issue).toBeDefined();
      expect(issue!.message).toContain('"app-c"');
      expect(issue!.message).toContain('"lib-b"');
      expect(issue!.message).toContain("packages/app-c/src/index.ts:3");
      expect(issue!.message).toContain(issue!.metadata.fixHint);
    });
  });

  describe("strict mode", () => {
    test("findings are errors when strict and ok is false", async () => {
      const project = buildProject("verifySimple");
      const result = await project.verify({ strict: true });
      expect(result.ok).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.warnings).toEqual([]);
      for (const issue of result.errors) {
        expect(issue.level).toBe("error");
      }
    });

    test("ok is true in strict mode when no findings exist", async () => {
      const project = buildProject("verifySimple");
      const result = await project.verify({
        strict: true,
        workspacePatterns: ["lib-a", "lib-b"],
      });
      expect(result.ok).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.warnings).toEqual([]);
    });
  });

  describe("workspacePatterns filter", () => {
    test("limits scanning to matched workspaces", async () => {
      const project = buildProject("verifySimple");
      const result = await project.verify({ workspacePatterns: ["app-c"] });
      for (const metadata of allImplicitDepMetadata(result)) {
        expect(metadata.workspace).toBe("app-c");
      }
    });

    test("returns no findings when no workspaces match", async () => {
      const project = buildProject("verifySimple");
      const result = await project.verify({
        workspacePatterns: ["does-not-exist"],
      });
      expect(result.ok).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.warnings).toEqual([]);
    });

    test("accepts wildcard patterns", async () => {
      const project = buildProject("verifySimple");
      const result = await project.verify({ workspacePatterns: ["lib-*"] });
      for (const metadata of allImplicitDepMetadata(result)) {
        expect(metadata.workspace).toMatch(/^lib-/);
      }
    });

    test("only-negation patterns scan no workspaces", async () => {
      const project = buildProject("verifySimple");
      const result = await project.verify({
        workspacePatterns: ["not:app-c"],
      });
      expect(result.ok).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.warnings).toEqual([]);
    });

    test("subtracting via not: leaves the remaining matched workspaces", async () => {
      const project = buildProject("verifySimple");
      const result = await project.verify({
        workspacePatterns: ["*", "not:app-c"],
      });
      for (const metadata of allImplicitDepMetadata(result)) {
        expect(metadata.workspace).not.toBe("app-c");
      }
    });

    test("explicit empty workspacePatterns array scans no workspaces (undefined means 'all')", async () => {
      // Consistent with runScriptAcrossWorkspaces and findWorkspacesByPattern:
      // undefined = "no filter, target all", [] = "filter that matches nothing".
      const project = buildProject("verifySimple");
      const result = await project.verify({ workspacePatterns: [] });
      expect(result.ok).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.warnings).toEqual([]);
    });

    test("strict + scoped to a workspace with findings still surfaces errors", async () => {
      const project = buildProject("verifySimple");
      const result = await project.verify({
        strict: true,
        workspacePatterns: ["app-c"],
      });
      expect(result.ok).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.warnings).toEqual([]);
      for (const issue of result.errors) {
        expect(issue.metadata.workspace).toBe("app-c");
      }
    });
  });

  describe("verify.workspaceDependencies.ignoreInputFiles", () => {
    test("excludes matching files from the scan", async () => {
      const project = buildProject("verifyWithIgnore");
      const result = await project.verify();
      const appBMeta = allImplicitDepMetadata(result).filter(
        (metadata) =>
          metadata.workspace === "app-b" && metadata.dependency === "lib-a",
      );
      expect(appBMeta).toHaveLength(1);
      const files = appBMeta[0].files.map((file) => file.path);
      expect(files).toEqual(["packages/app-b/src/index.ts"]);
    });
  });

  describe("argument validation", () => {
    test("throws when strict is not a boolean", async () => {
      const project = buildProject("verifySimple");
      await expect(
        project.verify({ strict: "yes" as unknown as boolean }),
      ).rejects.toBeInstanceOf(InvalidJSTypeError);
    });

    test("throws when workspacePatterns is not an array of strings", async () => {
      const project = buildProject("verifySimple");
      await expect(
        project.verify({
          workspacePatterns: [123 as unknown as string],
        }),
      ).rejects.toBeInstanceOf(InvalidJSTypeError);
    });

    test("throws when workspacePatterns is not an array", async () => {
      const project = buildProject("verifySimple");
      await expect(
        project.verify({
          workspacePatterns: "lib-a" as unknown as string[],
        }),
      ).rejects.toBeInstanceOf(InvalidJSTypeError);
    });
  });
});
