import { InvalidJSTypeError } from "../../../src/internal/core";
import { logger } from "../../../src/internal/logger";
import {
  createFileSystemProject,
  type ImplicitWorkspaceDependencyMetadata,
  type VerifyIssue,
  type VerifyResult,
} from "../../../src/project";
import { getProjectRoot } from "../../fixtures/testProjects";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  spyOn,
  test,
} from "../../util/testFramework";

const buildProject = (
  fixtureName:
    | "verifySimple"
    | "verifyWithIgnore"
    | "verifyWithRootWorkspace"
    | "verifyWithWorkspaceIgnore"
    | "verifyWithImportIgnore"
    | "verifyWithIgnoreWarnings"
    | "verifyWithMatchAllIgnore"
    | "verifyWithPatternConfigVerify",
) => createFileSystemProject({ rootDirectory: getProjectRoot(fixtureName) });

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

    test("fixHint uses pm-adapter version string (bun → 'workspace:*')", async () => {
      const project = buildProject("verifySimple");
      const result = await project.verify();
      const metadata = findImplicitDep(result, "app-c", "lib-b");
      expect(metadata!.fixHint).toContain('"workspace:*"');
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

  describe("workspace-level verify.workspaceDependencies.ignoreInputFiles", () => {
    test("excludes workspace-relative and leading-/ project-relative patterns for that workspace only", async () => {
      const project = buildProject("verifyWithWorkspaceIgnore");
      const result = await project.verify();
      const appAMeta = allImplicitDepMetadata(result).filter(
        (metadata) =>
          metadata.workspace === "app-a" && metadata.dependency === "lib-a",
      );
      expect(appAMeta).toHaveLength(1);
      expect(appAMeta[0].files.map((file) => file.path)).toEqual([
        "packages/app-a/src/index.ts",
      ]);
    });

    test("does not apply to other workspaces (workspace-scoped, not global)", async () => {
      const project = buildProject("verifyWithWorkspaceIgnore");
      const result = await project.verify();
      const appBMeta = allImplicitDepMetadata(result).filter(
        (metadata) =>
          metadata.workspace === "app-b" && metadata.dependency === "lib-a",
      );
      expect(appBMeta).toHaveLength(1);
      expect(appBMeta[0].files.map((file) => file.path).sort()).toEqual([
        "packages/app-b/scripts/codegen/build.ts",
        "packages/app-b/src/index.ts",
      ]);
    });

    test('"." ignores the entire workspace directory', async () => {
      const project = buildProject("verifyWithWorkspaceIgnore");
      const result = await project.verify();
      expect(findImplicitDep(result, "app-d", "lib-a")).toBeUndefined();
    });
  });

  describe("verify.workspaceDependencies.ignoreImportsFromWorkspacePatterns", () => {
    test("project-level pattern suppresses the dependency for every importer", async () => {
      const project = buildProject("verifyWithImportIgnore");
      const result = await project.verify();
      expect(findImplicitDep(result, "app-c", "lib-b")).toBeUndefined();
    });

    test("workspace-level pattern suppresses the dependency only for that workspace", async () => {
      const project = buildProject("verifyWithImportIgnore");
      const result = await project.verify();
      expect(findImplicitDep(result, "app-a", "lib-a")).toBeUndefined();
      expect(findImplicitDep(result, "app-b", "lib-a")).toBeDefined();
    });

    test("project- and workspace-level patterns apply additively for a single workspace", async () => {
      const project = buildProject("verifyWithImportIgnore");
      const result = await project.verify();
      expect(findImplicitDep(result, "app-d", "lib-a")).toBeUndefined();
      expect(findImplicitDep(result, "app-d", "lib-c")).toBeUndefined();
    });
  });

  describe("ignoreInputFiles negation and match-everything patterns", () => {
    let warnSpy: ReturnType<typeof spyOn>;

    beforeEach(() => {
      warnSpy = spyOn(logger, "warn").mockImplementation(
        (() => undefined) as unknown as typeof logger.warn,
      );
    });

    afterEach(() => {
      warnSpy.mockRestore();
    });

    const findNegationWarning = (pattern: string) =>
      warnSpy.mock.calls.find(
        ([id, options]: [string, { pattern?: string }]) =>
          id === "IgnoreInputFilesNegationNotHonored" &&
          options?.pattern === JSON.stringify(pattern),
      );

    test("project-level ! entry warns and is treated as a plain ignore", async () => {
      const project = buildProject("verifyWithIgnoreWarnings");
      const result = await project.verify();
      expect(
        findNegationWarning("!packages/app-a/scripts/legacy/**/*"),
      ).toBeDefined();
      const appAMeta = findImplicitDep(result, "app-a", "lib-a");
      expect(appAMeta).toBeDefined();
      expect(appAMeta!.files.map((file) => file.path)).toEqual([
        "packages/app-a/src/index.ts",
      ]);
    });

    test("workspace-level ! entry warns and is treated as a plain ignore", async () => {
      const project = buildProject("verifyWithIgnoreWarnings");
      const result = await project.verify();
      expect(findNegationWarning("!scripts/codegen/**/*")).toBeDefined();
      const appAMeta = findImplicitDep(result, "app-a", "lib-a");
      expect(appAMeta).toBeDefined();
      expect(appAMeta!.files.map((file) => file.path)).toEqual([
        "packages/app-a/src/index.ts",
      ]);
    });

    test("workspace-level match-everything pattern ignores the whole workspace scan", async () => {
      // app-b's ignoreInputFiles is ["/"], which resolves to the whole
      // project, so all of app-b's matched files are ignored
      const project = buildProject("verifyWithIgnoreWarnings");
      const result = await project.verify();
      expect(findImplicitDep(result, "app-b", "lib-a")).toBeUndefined();
      expect(findNegationWarning("/")).toBeUndefined();
    });

    test("project-level match-everything pattern suppresses all findings", async () => {
      const project = buildProject("verifyWithMatchAllIgnore");
      const result = await project.verify();
      expect(result.ok).toBe(true);
      expect(allIssues(result)).toHaveLength(0);
    });
  });

  describe("workspacePatternConfigs contributing verify config", () => {
    test("pattern-contributed ignoreImportsFromWorkspacePatterns applies to matched workspaces only", async () => {
      const project = buildProject("verifyWithPatternConfigVerify");
      const result = await project.verify();
      expect(findImplicitDep(result, "app-a", "lib-a")).toBeUndefined();
      expect(findImplicitDep(result, "app-c", "lib-a")).toBeDefined();
    });

    test("pattern-contributed ignoreInputFiles concatenate with the local workspace config", async () => {
      const project = buildProject("verifyWithPatternConfigVerify");
      const result = await project.verify();
      const appBMeta = findImplicitDep(result, "app-b", "lib-a");
      expect(appBMeta).toBeDefined();
      expect(appBMeta!.files.map((file) => file.path)).toEqual([
        "packages/app-b/src/index.ts",
      ]);
    });
  });

  describe("included root workspace", () => {
    test("nested workspace files are not attributed to the root workspace", async () => {
      const project = buildProject("verifyWithRootWorkspace");
      const result = await project.verify();
      const appBFindings = allImplicitDepMetadata(result).filter(
        (metadata) => metadata.dependency === "lib-a",
      );
      const rootFindingForNestedFile = appBFindings.find(
        (metadata) =>
          metadata.workspace === "verify-root-project" &&
          metadata.files.some((file) =>
            file.path.startsWith("packages/app-b/"),
          ),
      );
      expect(rootFindingForNestedFile).toBeUndefined();
    });

    test("app-b finding appears exactly once with only its own file", async () => {
      const project = buildProject("verifyWithRootWorkspace");
      const result = await project.verify();
      const appBFindings = allImplicitDepMetadata(result).filter(
        (metadata) => metadata.workspace === "app-b",
      );
      expect(appBFindings).toHaveLength(1);
      expect(appBFindings[0].files.map((file) => file.path)).toEqual([
        "packages/app-b/src/index.ts",
      ]);
    });

    test("root workspace is still scanned for root-owned files", async () => {
      const project = buildProject("verifyWithRootWorkspace");
      const result = await project.verify();
      const rootFinding = findImplicitDep(
        result,
        "verify-root-project",
        "lib-a",
      );
      expect(rootFinding).toBeDefined();
      expect(rootFinding!.files.map((file) => file.path)).toEqual([
        "scripts/rootTool.ts",
      ]);
      expect(rootFinding!.fixHint).toContain("of package.json");
    });

    test("includeRootWorkspace: false yields only the app-b finding", async () => {
      const project = createFileSystemProject({
        rootDirectory: getProjectRoot("verifyWithRootWorkspace"),
        includeRootWorkspace: false,
      });
      const result = await project.verify();
      const metadata = allImplicitDepMetadata(result);
      expect(metadata.map((m) => m.workspace)).toEqual(["app-b"]);
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
