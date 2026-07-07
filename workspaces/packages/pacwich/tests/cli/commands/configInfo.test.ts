import {
  setupCliTest,
  assertOutputMatches,
  listCommandAndAliases,
} from "../../util/cliTestUtils";
import { test, expect, describe } from "../../util/testFramework";

/**
 * Assert a resolved project config's stable fields exactly and its
 * environment-dependent defaults (`parallelMax` derives from
 * `availableParallelism`, `shell` default varies by env) by type, so
 * assertions stay machine-independent.
 */
const expectProjectConfigShape = (
  projectConfig: {
    packageManager: string;
    defaults: {
      parallelMax: unknown;
      shell: unknown;
      includeRootWorkspace: unknown;
      affectedBaseRef: unknown;
    };
    workspacePatternConfigs: unknown;
    verify: unknown;
  },
  expected: { workspacePatternConfigs: unknown },
) => {
  expect(projectConfig.packageManager).toBe("auto");
  expect(projectConfig.defaults.includeRootWorkspace).toBe(false);
  expect(projectConfig.defaults.affectedBaseRef).toBe("main");
  expect(typeof projectConfig.defaults.parallelMax).toBe("number");
  expect(typeof projectConfig.defaults.shell).toBe("string");
  expect(projectConfig.workspacePatternConfigs).toEqual(
    expected.workspacePatternConfigs,
  );
  expect(projectConfig.verify).toEqual({
    workspaceDependencies: { ignoreInputFiles: [] },
  });
};

const SIMPLE1_APPLICATION_1A_CONFIG = {
  aliases: ["appA"],
  tags: [],
  scripts: {},
  rules: {},
};

const EMPTY_WORKSPACE_CONFIG = {
  aliases: [],
  tags: [],
  scripts: {},
  rules: {},
};

describe("Config Info", () => {
  describe("combined output (no argument)", () => {
    test.each(listCommandAndAliases("configInfo"))(
      "prints combined project and workspace configs: %s",
      async (command) => {
        const { run } = setupCliTest({ testProject: "simple1" });
        const result = await run(command);
        expect(result.stderr.raw).toBeEmpty();
        expect(result.exitCode).toBe(0);

        const parsed = JSON.parse(result.stdout.raw);
        expectProjectConfigShape(parsed.project, {
          workspacePatternConfigs: [],
        });
        expect(parsed.workspaces["application-1a"]).toEqual(
          SIMPLE1_APPLICATION_1A_CONFIG,
        );
        expect(parsed.workspaces["application-1b"]).toEqual({
          ...EMPTY_WORKSPACE_CONFIG,
          aliases: ["appB"],
        });
      },
    );

    test("--pretty pretty-prints the combined object", async () => {
      const { run } = setupCliTest({ testProject: "simple1" });
      const result = await run("config-info", "--pretty");
      expect(result.stderr.raw).toBeEmpty();
      expect(result.exitCode).toBe(0);

      const parsed = JSON.parse(result.stdout.raw);
      assertOutputMatches(result.stdout.raw, JSON.stringify(parsed, null, 2));
      expect(result.stdout.raw).toContain("\n");
    });
  });

  describe("project config (--project)", () => {
    test("prints only the resolved project config", async () => {
      const { run } = setupCliTest({ testProject: "simple1" });
      const result = await run("config-info", "--project");
      expect(result.stderr.raw).toBeEmpty();
      expect(result.exitCode).toBe(0);
      expectProjectConfigShape(JSON.parse(result.stdout.raw), {
        workspacePatternConfigs: [],
      });
    });

    test("--project --pretty pretty-prints the project config", async () => {
      const { run } = setupCliTest({ testProject: "simple1" });
      const result = await run("config-info", "--project", "--pretty");
      expect(result.stderr.raw).toBeEmpty();
      expect(result.exitCode).toBe(0);

      const parsed = JSON.parse(result.stdout.raw);
      expectProjectConfigShape(parsed, { workspacePatternConfigs: [] });
      assertOutputMatches(result.stdout.raw, JSON.stringify(parsed, null, 2));
      expect(result.stdout.raw).toContain("\n");
    });

    test("surfaces workspacePatternConfigs entries verbatim", async () => {
      const { run } = setupCliTest({
        testProject: "projectConfigWorkspacePatternConfigs",
      });
      const result = await run("config-info", "--project");
      expect(result.stderr.raw).toBeEmpty();
      expect(result.exitCode).toBe(0);
      expect(JSON.parse(result.stdout.raw).workspacePatternConfigs).toEqual([
        {
          patterns: ["workspace-a"],
          config: { alias: "ws-a", tags: ["type-a"] },
        },
        {
          patterns: ["workspace-b"],
          config: { alias: "ws-b", tags: ["type-b"] },
        },
        { patterns: ["tag:type-a"], config: { tags: ["accumulated-match"] } },
      ]);
    });
  });

  describe("workspace config (positional)", () => {
    test("prints resolved config for a workspace by name", async () => {
      const { run } = setupCliTest({ testProject: "simple1" });
      const result = await run("config-info", "application-1a");
      expect(result.stderr.raw).toBeEmpty();
      expect(result.exitCode).toBe(0);
      expect(JSON.parse(result.stdout.raw)).toEqual(
        SIMPLE1_APPLICATION_1A_CONFIG,
      );
    });

    test("resolves a workspace by alias", async () => {
      const { run } = setupCliTest({ testProject: "simple1" });
      const result = await run("config-info", "appA");
      expect(result.stderr.raw).toBeEmpty();
      expect(result.exitCode).toBe(0);
      expect(JSON.parse(result.stdout.raw)).toEqual(
        SIMPLE1_APPLICATION_1A_CONFIG,
      );
    });

    test("reflects accumulated workspacePatternConfigs in workspace config", async () => {
      const { run } = setupCliTest({
        testProject: "projectConfigWorkspacePatternConfigs",
      });
      const result = await run("config-info", "workspace-a");
      expect(result.stderr.raw).toBeEmpty();
      expect(result.exitCode).toBe(0);
      expect(JSON.parse(result.stdout.raw)).toEqual({
        aliases: ["ws-a"],
        tags: ["type-a", "accumulated-match"],
        scripts: {},
        rules: {},
      });
    });

    test("resolves the root workspace via @root", async () => {
      const { run } = setupCliTest({ testProject: "simple1" });
      const result = await run("config-info", "@root");
      expect(result.stderr.raw).toBeEmpty();
      expect(result.exitCode).toBe(0);
      expect(JSON.parse(result.stdout.raw)).toEqual(EMPTY_WORKSPACE_CONFIG);
    });

    test("--pretty pretty-prints the workspace config", async () => {
      const { run } = setupCliTest({ testProject: "simple1" });
      const result = await run("config-info", "application-1a", "--pretty");
      expect(result.stderr.raw).toBeEmpty();
      expect(result.exitCode).toBe(0);
      assertOutputMatches(
        result.stdout.raw,
        JSON.stringify(SIMPLE1_APPLICATION_1A_CONFIG, null, 2),
      );
    });
  });

  describe("errors", () => {
    test("exits with error when the workspace does not exist", async () => {
      const { run } = setupCliTest({ testProject: "simple1" });
      const result = await run("config-info", "does-not-exist");
      expect(result.stdout.raw).toBeEmpty();
      expect(result.exitCode).toBe(1);
      assertOutputMatches(
        result.stderr.sanitized,
        'Workspace "does-not-exist" not found',
      );
    });

    test("errors when a workspace argument and --project are combined", async () => {
      const { run } = setupCliTest({ testProject: "simple1" });
      const result = await run("config-info", "application-1a", "--project");
      expect(result.stdout.raw).toBeEmpty();
      expect(result.exitCode).toBe(1);
      assertOutputMatches(
        result.stderr.sanitized,
        "CLI syntax error: Cannot use both a workspace argument and --project",
      );
    });

    test("rejects --json (JSON is always emitted; only --pretty is offered)", async () => {
      const { run } = setupCliTest({ testProject: "simple1" });
      const result = await run("config-info", "--json");
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr.sanitized).toContain("unknown option '--json'");
    });
  });
});
