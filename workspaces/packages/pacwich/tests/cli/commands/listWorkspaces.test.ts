import {
  setupCliTest,
  assertOutputMatches,
  listCommandAndAliases,
} from "../../util/cliTestUtils";
import { test, expect, describe } from "../../util/testFramework";

const PLAIN_OUTPUT_SIMPLE1 = `Workspace: application-1a
 - Aliases: appA
 - Path: applications/applicationA
 - Glob Match: applications/*
 - Scripts: a-workspaces, all-workspaces, application-a
 - Tags: 
 - Dependencies: 
 - Dependents: 
Workspace: application-1b
 - Aliases: appB
 - Path: applications/applicationB
 - Glob Match: applications/*
 - Scripts: all-workspaces, application-b, b-workspaces
 - Tags: 
 - Dependencies: 
 - Dependents: 
Workspace: library-1a
 - Aliases: libA
 - Path: libraries/libraryA
 - Glob Match: libraries/*
 - Scripts: a-workspaces, all-workspaces, library-a
 - Tags: 
 - Dependencies: 
 - Dependents: 
Workspace: library-1b
 - Aliases: libB
 - Path: libraries/libraryB
 - Glob Match: libraries/*
 - Scripts: all-workspaces, b-workspaces, library-b
 - Tags: 
 - Dependencies: 
 - Dependents: `;

const NAME_ONLY_OUTPUT_SIMPLE1 = `application-1a
application-1b
library-1a
library-1b`;

const EXPECTED_WORKSPACES_JSON_SIMPLE1 = [
  {
    name: "application-1a",
    isRoot: false,
    matchPattern: "applications/*",
    path: "applications/applicationA",
    scripts: ["a-workspaces", "all-workspaces", "application-a"],
    aliases: ["appA"],
    tags: [],
    dependencies: [],
    dependents: [],
    externalDependencies: [],
  },
  {
    name: "application-1b",
    isRoot: false,
    matchPattern: "applications/*",
    path: "applications/applicationB",
    scripts: ["all-workspaces", "application-b", "b-workspaces"],
    aliases: ["appB"],
    tags: [],
    dependencies: [],
    dependents: [],
    externalDependencies: [],
  },
  {
    name: "library-1a",
    isRoot: false,
    matchPattern: "libraries/*",
    path: "libraries/libraryA",
    scripts: ["a-workspaces", "all-workspaces", "library-a"],
    aliases: ["libA"],
    tags: [],
    dependencies: [],
    dependents: [],
    externalDependencies: [],
  },
  {
    name: "library-1b",
    isRoot: false,
    matchPattern: "libraries/*",
    path: "libraries/libraryB",
    scripts: ["all-workspaces", "b-workspaces", "library-b"],
    aliases: ["libB"],
    tags: [],
    dependencies: [],
    dependents: [],
    externalDependencies: [],
  },
];

const PATTERN_OUTPUT_APPLICATION_AND_LIBRARY_1B = `Workspace: application-1a
 - Aliases: appA
 - Path: applications/applicationA
 - Glob Match: applications/*
 - Scripts: a-workspaces, all-workspaces, application-a
 - Tags: 
 - Dependencies: 
 - Dependents: 
Workspace: application-1b
 - Aliases: appB
 - Path: applications/applicationB
 - Glob Match: applications/*
 - Scripts: all-workspaces, application-b, b-workspaces
 - Tags: 
 - Dependencies: 
 - Dependents: 
Workspace: library-1b
 - Aliases: libB
 - Path: libraries/libraryB
 - Glob Match: libraries/*
 - Scripts: all-workspaces, b-workspaces, library-b
 - Tags: 
 - Dependencies: 
 - Dependents: `;

describe("List Workspaces", () => {
  describe("output format", () => {
    test.each(listCommandAndAliases("listWorkspaces"))(
      "plain output lists workspaces with details: %s",
      async (command) => {
        const { run } = setupCliTest({ testProject: "simple1" });
        const result = await run(command);
        expect(result.stderr.raw).toBeEmpty();
        expect(result.exitCode).toBe(0);
        assertOutputMatches(result.stdout.raw, PLAIN_OUTPUT_SIMPLE1);
      },
    );

    test("with dependencies and dependents", async () => {
      const { run } = setupCliTest({ testProject: "withDependenciesSimple" });
      const result = await run("ls");
      expect(result.stderr.raw).toBeEmpty();
      expect(result.exitCode).toBe(0);
      assertOutputMatches(
        result.stdout.raw,
        `Workspace: a-depends-e
 - Aliases: 
 - Path: packages/a-depends-e
 - Glob Match: packages/*
 - Scripts: test-script
 - Tags: 
 - Dependencies: e
 - Dependents: 
Workspace: b-depends-cd
 - Aliases: 
 - Path: packages/b-depends-cd
 - Glob Match: packages/*
 - Scripts: test-script
 - Tags: 
 - Dependencies: c-depends-e, d-depends-e
 - Dependents: 
Workspace: c-depends-e
 - Aliases: 
 - Path: packages/c-depends-e
 - Glob Match: packages/*
 - Scripts: test-script
 - Tags: 
 - Dependencies: e
 - Dependents: b-depends-cd
Workspace: d-depends-e
 - Aliases: 
 - Path: packages/d-depends-e
 - Glob Match: packages/*
 - Scripts: test-script
 - Tags: 
 - Dependencies: e
 - Dependents: b-depends-cd
Workspace: e
 - Aliases: 
 - Path: packages/e
 - Glob Match: packages/*
 - Scripts: test-script
 - Tags: 
 - Dependencies: 
 - Dependents: a-depends-e, c-depends-e, d-depends-e`,
      );
    });

    test("--name-only outputs workspace names only", async () => {
      const { run } = setupCliTest({ testProject: "simple1" });
      const result = await run("ls", "--name-only");
      expect(result.stderr.raw).toBeEmpty();
      expect(result.exitCode).toBe(0);
      assertOutputMatches(result.stdout.raw, NAME_ONLY_OUTPUT_SIMPLE1);
    });

    test("--json outputs workspace list as JSON", async () => {
      const { run } = setupCliTest({ testProject: "simple1" });
      const result = await run("ls", "--json");
      expect(result.stderr.raw).toBeEmpty();
      expect(result.exitCode).toBe(0);
      assertOutputMatches(
        result.stdout.raw,
        JSON.stringify(EXPECTED_WORKSPACES_JSON_SIMPLE1),
      );
    });

    test("-j outputs workspace list as JSON", async () => {
      const { run } = setupCliTest({ testProject: "simple1" });
      const result = await run("ls", "-j");
      expect(result.stderr.raw).toBeEmpty();
      expect(result.exitCode).toBe(0);
      assertOutputMatches(
        result.stdout.raw,
        JSON.stringify(EXPECTED_WORKSPACES_JSON_SIMPLE1),
      );
    });

    test("--json --pretty outputs pretty-printed JSON", async () => {
      const { run } = setupCliTest({ testProject: "simple1" });
      const result = await run("ls", "--json", "--pretty");
      expect(result.stderr.raw).toBeEmpty();
      expect(result.exitCode).toBe(0);
      assertOutputMatches(
        result.stdout.raw,
        JSON.stringify(EXPECTED_WORKSPACES_JSON_SIMPLE1, null, 2),
      );
    });

    test("-j --pretty outputs pretty-printed JSON", async () => {
      const { run } = setupCliTest({ testProject: "simple1" });
      const result = await run("ls", "-j", "--pretty");
      expect(result.stderr.raw).toBeEmpty();
      expect(result.exitCode).toBe(0);
      assertOutputMatches(
        result.stdout.raw,
        JSON.stringify(EXPECTED_WORKSPACES_JSON_SIMPLE1, null, 2),
      );
    });

    test("--name-only --json outputs workspace names only", async () => {
      const { run } = setupCliTest({ testProject: "simple1" });
      const result = await run("ls", "--name-only", "--json");
      expect(result.stderr.raw).toBeEmpty();
      expect(result.exitCode).toBe(0);
      assertOutputMatches(
        result.stdout.raw,
        JSON.stringify(
          EXPECTED_WORKSPACES_JSON_SIMPLE1.map(({ name }) => name),
        ),
      );
    });

    test("-n --json outputs workspace names only", async () => {
      const { run } = setupCliTest({ testProject: "simple1" });
      const result = await run("ls", "-n", "--json");
      expect(result.stderr.raw).toBeEmpty();
      expect(result.exitCode).toBe(0);
      assertOutputMatches(
        result.stdout.raw,
        JSON.stringify(
          EXPECTED_WORKSPACES_JSON_SIMPLE1.map(({ name }) => name),
        ),
      );
    });

    test("--name-only --json --pretty outputs pretty workspace names", async () => {
      const { run } = setupCliTest({ testProject: "simple1" });
      const result = await run("ls", "--name-only", "--json", "--pretty");
      expect(result.stderr.raw).toBeEmpty();
      expect(result.exitCode).toBe(0);
      assertOutputMatches(
        result.stdout.raw,
        JSON.stringify(
          EXPECTED_WORKSPACES_JSON_SIMPLE1.map(({ name }) => name),
          null,
          2,
        ),
      );
    });
  });

  describe("workspace patterns", () => {
    test("accepts inline workspace patterns", async () => {
      const { run } = setupCliTest({ testProject: "simple1" });
      const result = await run("ls", "name:application-*", "library-1b");
      expect(result.stderr.raw).toBeEmpty();
      expect(result.exitCode).toBe(0);
      assertOutputMatches(
        result.stdout.raw,
        PATTERN_OUTPUT_APPLICATION_AND_LIBRARY_1B,
      );
    });

    test("--workspace-patterns accepts patterns", async () => {
      const { run } = setupCliTest({ testProject: "simple1" });
      const result = await run(
        "ls",
        "--workspace-patterns=application-* path:libraries/**/*B",
      );
      expect(result.stderr.raw).toBeEmpty();
      expect(result.exitCode).toBe(0);
      assertOutputMatches(
        result.stdout.raw,
        PATTERN_OUTPUT_APPLICATION_AND_LIBRARY_1B,
      );
    });

    test("-W accepts patterns", async () => {
      const { run } = setupCliTest({ testProject: "simple1" });
      const result = await run("ls", "-W", "application-* library-1b");
      expect(result.stderr.raw).toBeEmpty();
      expect(result.exitCode).toBe(0);
      assertOutputMatches(
        result.stdout.raw,
        PATTERN_OUTPUT_APPLICATION_AND_LIBRARY_1B,
      );
    });

    test("errors when both inline patterns and --workspace-patterns used", async () => {
      const { run } = setupCliTest({ testProject: "simple1" });
      const result = await run(
        "ls",
        "--workspace-patterns=application-* library-1b",
        "application-*",
        "library-1b",
      );
      expect(result.stdout.raw).toBeEmpty();
      expect(result.exitCode).toBe(1);
      assertOutputMatches(
        result.stderr.sanitized,
        "CLI syntax error: Cannot use both inline workspace patterns and --workspace-patterns|-W option",
      );
    });
  });

  // "exits with error when project has no bun.lock" moved to
  // tests/packageManagers/bun/cli/missingLockfileErrors.test.ts
  // (consolidated with the equivalent tests for ls-scripts and list-tags).
});
