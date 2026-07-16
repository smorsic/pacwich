import { setupCliTest } from "../../util/cliTestUtils";
import { describe, expect, test } from "../../util/testFramework";

type ParsedIssue = {
  name: string;
  level: "warn" | "error";
  message: string;
  metadata: {
    workspace: string;
    dependency: string;
    files: { path: string }[];
    fixHint: string;
  };
};

type ParsedResult = {
  ok: boolean;
  errors: ParsedIssue[];
  warnings: ParsedIssue[];
};

describe("CLI verify", () => {
  describe("default (non-strict)", () => {
    test("warns about implicit dependencies, exit code 0", async () => {
      const { run } = setupCliTest({ testProject: "verifySimple" });
      const result = await run("verify");
      expect(result.exitCode).toBe(0);
      expect(result.stderr.sanitized).toContain('Workspace "app-c"');
      expect(result.stderr.sanitized).toContain('"lib-b"');
      expect(result.stdoutAndErr.sanitized).toContain(
        "Verify finished with 1 warning",
      );
      expect(result.stdoutAndErr.sanitized).toContain("Re-run with --strict");
    });

    test("succeeds with helpful message when no findings", async () => {
      const { run } = setupCliTest({ testProject: "verifySimple" });
      const result = await run("verify", "lib-a");
      expect(result.exitCode).toBe(0);
      expect(result.stdout.sanitized).toContain("No verify issues found.");
    });
  });

  describe("--strict / -s", () => {
    test("--strict exits 1 when findings exist (writes to stderr via logger.error)", async () => {
      const { run } = setupCliTest({ testProject: "verifySimple" });
      const result = await run("verify", "--strict");
      expect(result.exitCode).toBe(1);
      expect(result.stderr.sanitized).toContain('Workspace "app-c"');
    });

    test("-s exits 1 when findings exist (short form)", async () => {
      const { run } = setupCliTest({ testProject: "verifySimple" });
      const result = await run("verify", "-s");
      expect(result.exitCode).toBe(1);
    });

    test("--strict exits 0 when no findings exist", async () => {
      const { run } = setupCliTest({ testProject: "verifySimple" });
      const result = await run("verify", "--strict", "lib-a");
      expect(result.exitCode).toBe(0);
    });
  });

  describe("workspace patterns (positional)", () => {
    test("limits scan to matched workspaces", async () => {
      const { run } = setupCliTest({ testProject: "verifySimple" });
      const result = await run("verify", "app-c");
      expect(result.stdoutAndErr.sanitized).toContain('Workspace "app-c"');
      expect(result.stdoutAndErr.sanitized).not.toContain('Workspace "lib-b"');
    });

    test("no findings when patterns match clean workspaces", async () => {
      const { run } = setupCliTest({ testProject: "verifySimple" });
      const result = await run("verify", "lib-*");
      expect(result.exitCode).toBe(0);
      expect(result.stdout.sanitized).toContain("No verify issues found.");
    });
  });

  describe("--json output", () => {
    test("emits the full verify result as JSON", async () => {
      const { run } = setupCliTest({ testProject: "verifySimple" });
      const result = await run("verify", "--json");
      expect(result.exitCode).toBe(0);
      const parsed: ParsedResult = JSON.parse(result.stdout.sanitized);
      expect(parsed.ok).toBe(true);
      expect(parsed.errors).toEqual([]);
      expect(parsed.warnings.length).toBeGreaterThan(0);
      for (const issue of parsed.warnings) {
        expect(issue.name).toBe("implicitWorkspaceDependency");
        expect(issue.level).toBe("warn");
        expect(issue.metadata).toBeDefined();
      }
    });

    test("--json --strict exits 1 and emits findings under errors", async () => {
      const { run } = setupCliTest({ testProject: "verifySimple" });
      const result = await run("verify", "--json", "--strict");
      expect(result.exitCode).toBe(1);
      const parsed: ParsedResult = JSON.parse(result.stdout.sanitized);
      expect(parsed.ok).toBe(false);
      expect(parsed.errors.length).toBeGreaterThan(0);
      expect(parsed.warnings).toEqual([]);
      for (const issue of parsed.errors) {
        expect(issue.level).toBe("error");
      }
    });

    test("--json --pretty emits indented JSON", async () => {
      const { run } = setupCliTest({ testProject: "verifySimple" });
      const result = await run("verify", "--json", "--pretty");
      expect(result.stdout.sanitized).toMatch(/\n {2}"ok": /);
    });

    test("each issue's metadata includes a fixHint with the pm-adapter version string", async () => {
      const { run } = setupCliTest({ testProject: "verifySimple" });
      const result = await run("verify", "--json");
      const parsed: ParsedResult = JSON.parse(result.stdout.sanitized);
      for (const issue of parsed.warnings) {
        expect(issue.metadata.fixHint).toContain('"*"');
        expect(issue.metadata.fixHint).toContain("package.json");
      }
    });
  });

  describe("verify.workspaceDependencies.ignoreInputFiles", () => {
    test("project config ignore patterns are honored", async () => {
      const { run } = setupCliTest({ testProject: "verifyWithIgnore" });
      const result = await run("verify", "--json");
      const parsed: ParsedResult = JSON.parse(result.stdout.sanitized);
      const appBIssues = parsed.warnings.filter(
        (issue) =>
          issue.metadata.workspace === "app-b" &&
          issue.metadata.dependency === "lib-a",
      );
      expect(appBIssues).toHaveLength(1);
      const files = appBIssues[0].metadata.files.map((file) => file.path);
      expect(files).toEqual(["packages/app-b/src/index.ts"]);
    });
  });

  describe("included root workspace", () => {
    test("nested workspace findings are not duplicated onto the root workspace", async () => {
      // Fixture config sets defaults.includeRootWorkspace: true
      const { run } = setupCliTest({ testProject: "verifyWithRootWorkspace" });
      const result = await run("verify", "--json");
      expect(result.exitCode).toBe(0);
      const parsed: ParsedResult = JSON.parse(result.stdout.sanitized);
      const appBIssues = parsed.warnings.filter(
        (issue) => issue.metadata.workspace === "app-b",
      );
      expect(appBIssues).toHaveLength(1);
      const rootIssues = parsed.warnings.filter(
        (issue) => issue.metadata.workspace === "verify-root-project",
      );
      expect(rootIssues).toHaveLength(1);
      expect(rootIssues[0].metadata.files.map((file) => file.path)).toEqual([
        "scripts/rootTool.ts",
      ]);
    });

    test("--no-include-root drops the root workspace's own finding", async () => {
      const { run } = setupCliTest({ testProject: "verifyWithRootWorkspace" });
      const result = await run("verify", "--json", "--no-include-root");
      expect(result.exitCode).toBe(0);
      const parsed: ParsedResult = JSON.parse(result.stdout.sanitized);
      expect(parsed.warnings.map((issue) => issue.metadata.workspace)).toEqual([
        "app-b",
      ]);
    });
  });
});
