import { createFileSystemProject } from "../../../src/project";
import {
  getProjectRoot,
  type TestProjectName,
} from "../../fixtures/testProjects";
import { setupCliTest } from "../../util/cliTestUtils";
import { describe, expect, test } from "../../util/testFramework";

const buildProject = (fixtureName: TestProjectName) =>
  createFileSystemProject({ rootDirectory: getProjectRoot(fixtureName) });

describe("CLI config debug", () => {
  describe("default (no flags)", () => {
    test("prints both project and workspace configs", async () => {
      const { run } = setupCliTest({ testProject: "simple1" });
      const result = await run("config", "debug");
      expect(result.stderr.raw).toBeEmpty();
      expect(result.exitCode).toBe(0);

      const project = buildProject("simple1");
      expect(JSON.parse(result.stdout.sanitized)).toEqual({
        project: project.config.project,
        workspaces: project.config.workspaces,
      });
    });
  });

  describe("--project", () => {
    test("prints only the resolved project config", async () => {
      const { run } = setupCliTest({ testProject: "simple1" });
      const result = await run("config", "debug", "--project");
      expect(result.exitCode).toBe(0);

      const project = buildProject("simple1");
      expect(JSON.parse(result.stdout.sanitized)).toEqual(
        project.config.project,
      );
    });
  });

  describe("--workspace / -w", () => {
    test("prints a single workspace's resolved config by name", async () => {
      const { run } = setupCliTest({ testProject: "simple1" });
      const result = await run("config", "debug", "--workspace=application-1a");
      expect(result.exitCode).toBe(0);

      const project = buildProject("simple1");
      expect(JSON.parse(result.stdout.sanitized)).toEqual(
        project.config.workspaces["application-1a"],
      );
    });

    test("-w short form", async () => {
      const { run } = setupCliTest({ testProject: "simple1" });
      const result = await run("config", "debug", "-w", "application-1a");
      expect(result.exitCode).toBe(0);

      const project = buildProject("simple1");
      expect(JSON.parse(result.stdout.sanitized)).toEqual(
        project.config.workspaces["application-1a"],
      );
    });

    test("resolves by alias", async () => {
      const { run } = setupCliTest({ testProject: "simple1" });
      const result = await run("config", "debug", "--workspace=appA");
      expect(result.exitCode).toBe(0);

      const project = buildProject("simple1");
      expect(JSON.parse(result.stdout.sanitized)).toEqual(
        project.config.workspaces["application-1a"],
      );
    });

    test("supports the @root selector", async () => {
      const { run } = setupCliTest({ testProject: "simple1" });
      const result = await run("config", "debug", "--workspace=@root");
      expect(result.exitCode).toBe(0);

      const project = buildProject("simple1");
      expect(JSON.parse(result.stdout.sanitized)).toEqual(
        project.config.workspaces[project.rootWorkspace.name],
      );
    });

    test("exits with error when workspace does not exist", async () => {
      const { run } = setupCliTest({ testProject: "simple1" });
      const result = await run("config", "debug", "--workspace=does-not-exist");
      expect(result.stdout.raw).toBeEmpty();
      expect(result.exitCode).toBe(1);
      expect(result.stderr.sanitized).toContain(
        'Workspace "does-not-exist" not found',
      );
    });
  });

  describe("--workspace-patterns / -W", () => {
    test("prints a map of matched workspaces' resolved configs", async () => {
      const { run } = setupCliTest({ testProject: "withDependenciesSimple" });
      const result = await run(
        "config",
        "debug",
        "--workspace-patterns=d-depends-e",
      );
      expect(result.exitCode).toBe(0);

      const project = buildProject("withDependenciesSimple");
      expect(JSON.parse(result.stdout.sanitized)).toEqual({
        "d-depends-e": project.config.workspaces["d-depends-e"],
      });
    });

    test("-W short form", async () => {
      const { run } = setupCliTest({ testProject: "withDependenciesSimple" });
      const result = await run("config", "debug", "-W", "d-depends-e");
      expect(result.exitCode).toBe(0);

      const project = buildProject("withDependenciesSimple");
      expect(JSON.parse(result.stdout.sanitized)).toEqual({
        "d-depends-e": project.config.workspaces["d-depends-e"],
      });
    });

    test("prints an empty object when no workspace matches", async () => {
      const { run } = setupCliTest({ testProject: "simple1" });
      const result = await run(
        "config",
        "debug",
        "--workspace-patterns=does-not-exist-*",
      );
      expect(result.exitCode).toBe(0);
      expect(JSON.parse(result.stdout.sanitized)).toEqual({});
    });
  });

  describe("mutually exclusive scope flags", () => {
    test("--project with --workspace errors with a hint", async () => {
      const { run } = setupCliTest({ testProject: "simple1" });
      const result = await run(
        "config",
        "debug",
        "--project",
        "--workspace=application-1a",
      );
      expect(result.exitCode).toBe(1);
      expect(result.stderr.sanitized).toContain("cannot be combined");
      expect(result.stderr.sanitized).toContain("pacwich config debug");
    });

    test("--workspace with --workspace-patterns errors", async () => {
      const { run } = setupCliTest({ testProject: "simple1" });
      const result = await run(
        "config",
        "debug",
        "--workspace=application-1a",
        "--workspace-patterns=application-1a",
      );
      expect(result.exitCode).toBe(1);
      expect(result.stderr.sanitized).toContain("cannot be combined");
    });
  });

  describe("--pretty", () => {
    test("pretty-prints the JSON output", async () => {
      const { run } = setupCliTest({ testProject: "simple1" });
      const result = await run("config", "debug", "--project", "--pretty");
      expect(result.exitCode).toBe(0);

      const project = buildProject("simple1");
      expect(result.stdout.sanitized.trim()).toBe(
        JSON.stringify(project.config.project, null, 2),
      );
    });
  });

  describe("unevaluated workspacePatternConfigs factories", () => {
    test("marks a factory function instead of silently dropping it", async () => {
      const { run } = setupCliTest({
        testProject: "projectConfigWorkspacePatternConfigsFactory",
      });
      const result = await run("config", "debug", "--project");
      expect(result.exitCode).toBe(0);

      const parsed = JSON.parse(result.stdout.sanitized);
      expect(parsed.workspacePatternConfigs).toEqual([
        {
          patterns: ["workspace-a"],
          config: { __function: true, name: "tagFactory" },
        },
      ]);
    });

    test("the resolved workspace config has the factory's output, not the function", async () => {
      const { run } = setupCliTest({
        testProject: "projectConfigWorkspacePatternConfigsFactory",
      });
      const result = await run("config", "debug", "--workspace=workspace-a");
      expect(result.exitCode).toBe(0);

      const parsed = JSON.parse(result.stdout.sanitized);
      expect(parsed.tags).toEqual(["from-factory"]);
      expect(result.stdout.sanitized).not.toContain("__function");
    });
  });
});
