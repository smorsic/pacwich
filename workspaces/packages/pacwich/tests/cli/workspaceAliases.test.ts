import { setupCliTest, assertOutputMatches } from "../util/cliTestUtils";
import { test, expect, describe } from "../util/testFramework";
import { withWindowsPath } from "../util/windows";

describe("CLI Workspace Aliases", () => {
  describe("workspace-info", () => {
    test("finds workspace by alias", async () => {
      const { run } = setupCliTest({
        testProject: "workspaceConfigPackageFileMix",
      });
      const result = await run("workspace-info", "appA");
      expect(result.exitCode).toBe(0);
      assertOutputMatches(
        result.stdout.raw,
        `Workspace: application-1a
 - Aliases: appA
 - Path: ${withWindowsPath("applications/application-a")}
 - Glob Match: applications/*
 - Scripts: a-workspaces, all-workspaces, application-a
 - Tags: 
 - Dependencies: 
 - Dependents: `,
      );
    });

    test("finds workspace by file-based alias", async () => {
      const { run } = setupCliTest({
        testProject: "workspaceConfigPackageFileMix",
      });
      const result = await run("workspace-info", "appB_file");
      expect(result.exitCode).toBe(0);
      assertOutputMatches(
        result.stdout.raw,
        `Workspace: application-1b
 - Aliases: appB_file
 - Path: ${withWindowsPath("applications/application-b")}
 - Glob Match: applications/*
 - Scripts: all-workspaces, application-b, b-workspaces
 - Tags: 
 - Dependencies: 
 - Dependents: `,
      );
    });

    test("finds workspace by name showing alias", async () => {
      const { run } = setupCliTest({
        testProject: "workspaceConfigPackageFileMix",
      });
      const result = await run("workspace-info", "application-1a");
      expect(result.exitCode).toBe(0);
      assertOutputMatches(
        result.stdout.raw,
        `Workspace: application-1a
 - Aliases: appA
 - Path: ${withWindowsPath("applications/application-a")}
 - Glob Match: applications/*
 - Scripts: a-workspaces, all-workspaces, application-a
 - Tags: 
 - Dependencies: 
 - Dependents: `,
      );
    });

    describe("run-script", () => {
      test("runs script for alias pattern match", async () => {
        const { run } = setupCliTest({
          testProject: "workspaceConfigPackageFileMix",
        });
        const result = await run(
          "run-script",
          "all-workspaces",
          "alias:*A",
          "--parallel=false",
        );
        expect(result.exitCode).toBe(0);
        assertOutputMatches(
          result.stdout.sanitizedCompactLines,
          `[application-1a] script for all workspaces
✅ application-1a: all-workspaces
1 script ran successfully`,
        );
      });

      test("runs script for mixed alias and name targets", async () => {
        const { run } = setupCliTest({
          testProject: "workspaceConfigPackageFileMix",
        });
        const result = await run(
          "run-script",
          "b-workspaces",
          "appB_file",
          "library-1b",
          "--parallel=false",
        );
        expect(result.exitCode).toBe(0);
        assertOutputMatches(
          result.stdout.sanitizedCompactLines,
          `[application-1b] script for b workspaces
[library-1b] script for b workspaces
✅ application-1b: b-workspaces
✅ library-1b: b-workspaces
2 scripts ran successfully`,
        );
      });

      test("runs script for alias and name glob targets", async () => {
        const { run } = setupCliTest({
          testProject: "workspaceConfigPackageFileMix",
        });
        const result = await run(
          "run-script",
          "all-workspaces",
          "alias:libA_file",
          "application-*",
          "--parallel=false",
        );
        expect(result.exitCode).toBe(0);
        assertOutputMatches(
          result.stdout.sanitizedCompactLines,
          `[application-1b] script for all workspaces
[application-1a] script for all workspaces
[application-1c] script for all workspaces
[library-1a] script for all workspaces
✅ application-1b: all-workspaces
✅ application-1a: all-workspaces
✅ application-1c: all-workspaces
✅ library-1a: all-workspaces
4 scripts ran successfully`,
        );
      });
    });
  });
});
