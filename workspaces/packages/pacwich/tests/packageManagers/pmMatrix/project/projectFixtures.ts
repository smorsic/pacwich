import type { CreateFileSystemProjectOptions } from "../../../../src/project";
import { type TestProjectName } from "../../../fixtures/testProjects";

/**
 * Project-shape scenarios driving the smoke matrix in
 * {@link ./projectEndToEnd.test.ts}.
 *
 * Always-present fields gate the universal property/lookup tests.
 * Optional fields opt the fixture into surface-specific tests (alias
 * lookup, tag lookup, script execution, affected workflows). Adding a
 * new project shape to the matrix is just appending a spec here.
 *
 * Skipped from the matrix intentionally:
 *  - `emptyWorkspaces` — has no lockfile, and adding one would break
 *    the chunk-7 missing-lockfile error test that uses the same
 *    fixture.
 *  - `withCatalogSimple` — catalog-specific behavior is covered in the
 *    conformance suite via capability gating.
 */
export type ProjectSmokeFixture = {
  name: TestProjectName;
  /** Short label for the describe block; should describe the shape. */
  description: string;
  /** Extra createFileSystemProject options (e.g. includeRootWorkspace). */
  createOptions?: Omit<
    CreateFileSystemProjectOptions,
    "rootDirectory" | "packageManager"
  >;
  expected: {
    rootName: string;
    /** List of expected workspace names returned by project.workspaces (compared after sort). */
    workspaceNames: string[];
  };
  /** Opt into alias-lookup smoke tests. */
  knownAlias?: { alias: string; resolvesToWorkspace: string };
  /** Opt into listWorkspacesWithScript smoke tests. */
  knownScript?: { script: string; workspaces: string[] };
  /** Opt into listWorkspacesWithTag smoke tests. */
  knownTag?: { tag: string; workspaces: string[] };
  /** Opt into findWorkspacesByPattern smoke tests. */
  namePattern?: { pattern: string; matches: string[] };
  /** Opt into runWorkspaceScript smoke test. */
  scriptExecution?: {
    workspace: string;
    script: string;
    stdoutContains: string;
  };
  /** Opt into runScriptAcrossWorkspaces smoke test. */
  fanoutScript?: { script: string; expectedSuccessWorkspaceCount: number };
  /** Opt into determineAffectedWorkspaces + runAffectedWorkspaceScript. */
  affected?: {
    changedFiles: string[];
    expectedAffectedNames: string[];
    runScriptName: string;
    /** Names of workspaces that should be RUN (after any
     * `ignoreWorkspaceDependencies` scoping below). */
    expectedRunNames: string[];
    /** If true, scope runAffectedWorkspaceScript without dep cascade. */
    ignoreWorkspaceDependencies?: boolean;
  };
};

export const PROJECT_SMOKE_FIXTURES: readonly ProjectSmokeFixture[] = [
  {
    name: "workspaceTags",
    description: "aliases + tags + scripts, four workspaces",
    expected: {
      rootName: "test-root",
      workspaceNames: [
        "application-1a",
        "application-1b",
        "library-1a",
        "library-1b",
      ],
    },
    knownAlias: { alias: "appA", resolvesToWorkspace: "application-1a" },
    knownScript: {
      script: "a-workspaces",
      workspaces: ["application-1a", "library-1a"],
    },
    knownTag: {
      tag: "app",
      workspaces: ["application-1a", "application-1b"],
    },
    namePattern: {
      pattern: "application-*",
      matches: ["application-1a", "application-1b"],
    },
    scriptExecution: {
      workspace: "application-1a",
      script: "application-a",
      stdoutContains: "script for application-a",
    },
    fanoutScript: {
      script: "all-workspaces",
      expectedSuccessWorkspaceCount: 4,
    },
  },
  {
    name: "default",
    description: "five workspaces including a nested one (libraries/**/* glob)",
    expected: {
      rootName: "test-root",
      workspaceNames: [
        "application-a",
        "application-b",
        "library-a",
        "library-b",
        "library-c",
      ],
    },
    knownScript: {
      script: "a-workspaces",
      workspaces: ["application-a", "library-a"],
    },
    namePattern: {
      pattern: "library-*",
      matches: ["library-a", "library-b", "library-c"],
    },
    scriptExecution: {
      workspace: "library-c",
      script: "library-c",
      stdoutContains: "script for library-c",
    },
    fanoutScript: {
      script: "all-workspaces",
      expectedSuccessWorkspaceCount: 5,
    },
  },
  {
    name: "simple1",
    description: "aliases + scripts, four workspaces (no tags)",
    expected: {
      rootName: "test-root",
      workspaceNames: [
        "application-1a",
        "application-1b",
        "library-1a",
        "library-1b",
      ],
    },
    knownAlias: { alias: "libA", resolvesToWorkspace: "library-1a" },
    knownScript: {
      script: "b-workspaces",
      workspaces: ["application-1b", "library-1b"],
    },
    namePattern: {
      pattern: "*-1b",
      matches: ["application-1b", "library-1b"],
    },
    scriptExecution: {
      workspace: "application-1a",
      script: "application-a",
      stdoutContains: "script for application-a",
    },
    fanoutScript: {
      script: "all-workspaces",
      expectedSuccessWorkspaceCount: 4,
    },
  },
  {
    name: "oneWorkspace",
    description: "single workspace",
    expected: {
      rootName: "test-root",
      workspaceNames: ["application-a"],
    },
    namePattern: {
      pattern: "application-*",
      matches: ["application-a"],
    },
    scriptExecution: {
      workspace: "application-a",
      script: "application-a",
      stdoutContains: "script for application-a",
    },
    fanoutScript: {
      script: "all-workspaces",
      expectedSuccessWorkspaceCount: 1,
    },
  },
  {
    name: "emptyScripts",
    description: "four workspaces with no executable scripts",
    expected: {
      rootName: "test-root",
      workspaceNames: [
        "application-1a",
        "application-1b",
        "library-1a",
        "library-1b",
      ],
    },
    namePattern: {
      pattern: "library-*",
      matches: ["library-1a", "library-1b"],
    },
  },
  {
    name: "withDependenciesSimple",
    description: "workspace dep graph (5 workspaces, deps across all 4 maps)",
    expected: {
      rootName: "test-root",
      workspaceNames: [
        "a-depends-e",
        "b-depends-cd",
        "c-depends-e",
        "d-depends-e",
        "e",
      ],
    },
    knownScript: {
      script: "test-script",
      workspaces: [
        "a-depends-e",
        "b-depends-cd",
        "c-depends-e",
        "d-depends-e",
        "e",
      ],
    },
    namePattern: {
      pattern: "*-depends-*",
      matches: ["a-depends-e", "b-depends-cd", "c-depends-e", "d-depends-e"],
    },
    scriptExecution: {
      workspace: "e",
      script: "test-script",
      stdoutContains: "E",
    },
  },
  {
    name: "simpleWorkspaceGlobs",
    description:
      "variety of workspace glob shapes (single-dir, trailing slash, etc.)",
    expected: {
      rootName: "test-root",
      workspaceNames: [
        "application-1a",
        "application-1b",
        "library-1a",
        "library-1b",
        "package-a",
        "package-b",
        "package-c",
      ],
    },
    knownAlias: { alias: "pa", resolvesToWorkspace: "package-a" },
    namePattern: {
      pattern: "package-*",
      matches: ["package-a", "package-b", "package-c"],
    },
    scriptExecution: {
      workspace: "package-a",
      script: "package-a",
      stdoutContains: "script for package-a",
    },
  },
  {
    name: "withRootWorkspace",
    description: "root workspace included via includeRootWorkspace: true",
    createOptions: { includeRootWorkspace: true },
    expected: {
      rootName: "test-root",
      workspaceNames: [
        "application-1a",
        "application-1b",
        "library-1a",
        "library-1b",
        "test-root",
      ],
    },
    knownAlias: {
      alias: "my-root-alias",
      resolvesToWorkspace: "test-root",
    },
    knownScript: {
      script: "all-workspaces",
      workspaces: [
        "application-1a",
        "application-1b",
        "library-1a",
        "library-1b",
        "test-root",
      ],
    },
  },
  {
    name: "semverWorkspaceLink",
    description:
      "workspace dep declared with a plain semver range, linked via the lockfile",
    expected: {
      rootName: "semver-workspace-link-root",
      workspaceNames: ["pkg-a", "pkg-b"],
    },
    knownScript: {
      script: "noop",
      workspaces: ["pkg-a", "pkg-b"],
    },
    namePattern: {
      pattern: "pkg-*",
      matches: ["pkg-a", "pkg-b"],
    },
    // The semver-ranged pkg-b → pkg-a edge (the point of this fixture)
    // is asserted precisely, per pm, in
    // tests/packageManagers/workspaceLinks/lockfileResolution.test.ts.
    affected: {
      changedFiles: ["packages/pkg-a/index.ts"],
      // pkg-a changed; pkg-b cascades via the lockfile-resolved dep edge.
      expectedAffectedNames: ["pkg-a", "pkg-b"],
      runScriptName: "noop",
      expectedRunNames: ["pkg-a", "pkg-b"],
    },
  },
  {
    name: "affectedWithInputs",
    description: "affected workflows with input config (b → a workspace dep)",
    expected: {
      rootName: "test-root",
      workspaceNames: ["a", "b", "c", "d", "e"],
    },
    knownScript: {
      script: "echo-script",
      workspaces: ["a", "b", "c", "d"],
    },
    affected: {
      // a's defaultInputs.files = ["src/**/*"] → matches
      changedFiles: ["packages/a/src/index.ts"],
      // a directly affected, b cascades via workspace dep
      expectedAffectedNames: ["a", "b"],
      runScriptName: "echo-script",
      expectedRunNames: ["a"],
      ignoreWorkspaceDependencies: true,
    },
  },
];
