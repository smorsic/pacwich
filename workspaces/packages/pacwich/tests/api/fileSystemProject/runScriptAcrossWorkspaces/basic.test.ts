import {
  createFileSystemProject,
  type RunWorkspaceScriptMetadata,
} from "../../../../src/project";
import {
  type RunScriptExit,
  type ScriptEventName,
} from "../../../../src/runScript";
import { getProjectRoot } from "../../../fixtures/testProjects";
import { collectStdout } from "../../../util/collectOutput";
import { makeTestWorkspace } from "../../../util/testData";
import { expect, test, describe } from "../../../util/testFramework";
import { makeSummaryResult, makeScriptResult } from "./util";

const DEFAULT_RETRY = 5;

describe("FileSystemProject runScriptAcrossWorkspaces - basic", () => {
  test("simple success", async () => {
    const project = createFileSystemProject({
      rootDirectory: getProjectRoot("default"),
    });

    const { output, summary } = project.runScriptAcrossWorkspaces({
      workspacePatterns: ["library-b"],
      script: "b-workspaces",
      parallel: false,
    });

    for await (const { metadata, chunk } of output.text()) {
      expect(metadata.streamName).toBe("stdout");
      expect(chunk.trim()).toMatch("script for b workspaces");
      expect(metadata.workspace).toEqual(
        makeTestWorkspace({
          name: "library-b",
          path: "libraries/libraryB",
          matchPattern: "libraries/**/*",
          scripts: ["all-workspaces", "b-workspaces", "library-b"],
        }),
      );
    }

    const summaryResult = await summary;
    expect(summaryResult).toEqual(
      makeSummaryResult({
        scriptResults: [
          makeScriptResult({
            metadata: {
              workspace: makeTestWorkspace({
                name: "library-b",
                path: "libraries/libraryB",
                matchPattern: "libraries/**/*",
                scripts: ["all-workspaces", "b-workspaces", "library-b"],
              }),
            },
          }),
        ],
      }),
    );
  });

  test("ignore output", async () => {
    const project = createFileSystemProject({
      rootDirectory: getProjectRoot("default"),
    });

    const { output, summary } = project.runScriptAcrossWorkspaces({
      workspacePatterns: ["library-b"],
      script: "b-workspaces",
      ignoreOutput: true,
      parallel: false,
    });
    let chunkCount = 0;
    for await (const _chunk of output.text()) {
      chunkCount++;
    }
    expect(chunkCount).toBe(0);

    const summaryResult = await summary;
    expect(summaryResult).toEqual(
      makeSummaryResult({
        totalCount: 1,
        successCount: 1,
        scriptResults: [
          makeScriptResult({
            metadata: {
              workspace: makeTestWorkspace({
                name: "library-b",
                path: "libraries/libraryB",
                matchPattern: "libraries/**/*",
                scripts: ["all-workspaces", "b-workspaces", "library-b"],
              }),
            },
          }),
        ],
      }),
    );
  });

  test("all workspaces", async () => {
    const project = createFileSystemProject({
      rootDirectory: getProjectRoot("simple1"),
    });

    const { output, summary } = project.runScriptAcrossWorkspaces({
      script: "all-workspaces",
      parallel: false,
    });

    const outputChunk = {
      streamName: "stdout" as const,
      text: "script for all workspaces",
      textNoAnsi: "script for all workspaces",
    };

    const expectedOutput = [
      { outputChunk },
      { outputChunk },
      { outputChunk },
      { outputChunk },
    ];

    let i = 0;
    for await (const { metadata, chunk } of output.text()) {
      expect(metadata.streamName).toBe("stdout");
      expect(chunk.trim()).toBe(expectedOutput[i].outputChunk.text);
      i++;
    }

    const summaryResult = await summary;
    expect(summaryResult).toEqual(
      makeSummaryResult({
        totalCount: 4,
        successCount: 4,
        scriptResults: [
          makeScriptResult({
            metadata: {
              workspace: makeTestWorkspace({
                name: "application-1a",
                aliases: ["appA"],
                matchPattern: "applications/*",
                path: "applications/applicationA",
                scripts: ["a-workspaces", "all-workspaces", "application-a"],
              }),
            },
          }),
          makeScriptResult({
            metadata: {
              workspace: makeTestWorkspace({
                name: "application-1b",
                aliases: ["appB"],
                matchPattern: "applications/*",
                path: "applications/applicationB",
                scripts: ["all-workspaces", "application-b", "b-workspaces"],
              }),
            },
          }),
          makeScriptResult({
            metadata: {
              workspace: makeTestWorkspace({
                name: "library-1a",
                aliases: ["libA"],
                matchPattern: "libraries/*",
                path: "libraries/libraryA",
                scripts: ["a-workspaces", "all-workspaces", "library-a"],
              }),
            },
          }),
          makeScriptResult({
            metadata: {
              workspace: makeTestWorkspace({
                name: "library-1b",
                aliases: ["libB"],
                matchPattern: "libraries/*",
                path: "libraries/libraryB",
                scripts: ["all-workspaces", "b-workspaces", "library-b"],
              }),
            },
          }),
        ],
      }),
    );
  });

  test("some workspaces", async () => {
    const project = createFileSystemProject({
      rootDirectory: getProjectRoot("simple1"),
    });

    const { output, summary } = project.runScriptAcrossWorkspaces({
      workspacePatterns: ["application-1b", "library*"],
      script: "b-workspaces",
      parallel: false,
    });

    const expectedOutput = [
      {
        outputChunk: {
          streamName: "stdout" as const,
          text: "script for b workspaces",
          textNoAnsi: "script for b workspaces",
        },
        scriptMetadata: {
          workspace: makeTestWorkspace({
            name: "application-1b",
            aliases: ["appB"],
            matchPattern: "applications/*",
            path: "applications/applicationB",
            scripts: ["all-workspaces", "application-b", "b-workspaces"],
          }),
        },
      },
      {
        outputChunk: {
          streamName: "stdout" as const,
          text: "script for b workspaces",
          textNoAnsi: "script for b workspaces",
        },
        scriptMetadata: {
          workspace: makeTestWorkspace({
            name: "library-1b",
            aliases: ["libB"],
            matchPattern: "libraries/*",
            path: "libraries/libraryB",
            scripts: ["all-workspaces", "b-workspaces", "library-b"],
          }),
        },
      },
    ];

    let i = 0;
    for await (const { metadata, chunk } of output.text()) {
      expect(metadata.streamName).toBe(
        expectedOutput[i].outputChunk.streamName,
      );
      expect(chunk.trim()).toBe(expectedOutput[i].outputChunk.text);
      i++;
    }

    const summaryResult = await summary;
    expect(summaryResult).toEqual(
      makeSummaryResult({
        totalCount: 2,
        successCount: 2,
        scriptResults: [
          makeScriptResult({
            metadata: {
              workspace: makeTestWorkspace({
                name: "application-1b",
                aliases: ["appB"],
                matchPattern: "applications/*",
                path: "applications/applicationB",
                scripts: ["all-workspaces", "application-b", "b-workspaces"],
              }),
            },
          }),
          makeScriptResult({
            metadata: {
              workspace: makeTestWorkspace({
                name: "library-1b",
                aliases: ["libB"],
                matchPattern: "libraries/*",
                path: "libraries/libraryB",
                scripts: ["all-workspaces", "b-workspaces", "library-b"],
              }),
            },
          }),
        ],
      }),
    );
  });

  test("no workspaces", async () => {
    const project = createFileSystemProject({
      rootDirectory: getProjectRoot("simple1"),
    });

    expect(() =>
      project.runScriptAcrossWorkspaces({
        workspacePatterns: [],
        script: "all-workspaces",
        parallel: false,
      }),
    ).toThrow('No matching workspaces found with script "all-workspaces"');
  });

  test("all workspaces with wildcard pattern", async () => {
    const project = createFileSystemProject({
      rootDirectory: getProjectRoot("simple1"),
    });

    const { output, summary } = project.runScriptAcrossWorkspaces({
      workspacePatterns: ["*"],
      script: "all-workspaces",
      parallel: false,
    });

    const expectedOutput = [
      {
        outputChunk: {
          streamName: "stdout" as const,
          text: "script for all workspaces",
          textNoAnsi: "script for all workspaces",
        },
        scriptMetadata: {
          workspace: makeTestWorkspace({
            name: "application-1a",
            aliases: ["appA"],
            matchPattern: "applications/*",
            path: "applications/applicationA",
            scripts: ["a-workspaces", "all-workspaces", "application-a"],
          }),
        },
      },
      {
        outputChunk: {
          streamName: "stdout" as const,
          text: "script for all workspaces",
          textNoAnsi: "script for all workspaces",
        },
        scriptMetadata: {
          workspace: makeTestWorkspace({
            name: "application-1b",
            aliases: ["appB"],
            matchPattern: "applications/*",
            path: "applications/applicationB",
            scripts: ["all-workspaces", "application-b", "b-workspaces"],
          }),
        },
      },
      {
        outputChunk: {
          streamName: "stdout" as const,
          text: "script for all workspaces",
          textNoAnsi: "script for all workspaces",
        },
        scriptMetadata: {
          workspace: makeTestWorkspace({
            name: "library-1a",
            aliases: ["libA"],
            matchPattern: "libraries/*",
            path: "libraries/libraryA",
            scripts: ["a-workspaces", "all-workspaces", "library-a"],
          }),
        },
      },
      {
        outputChunk: {
          streamName: "stdout" as const,
          text: "script for all workspaces",
          textNoAnsi: "script for all workspaces",
        },
        scriptMetadata: {
          workspace: makeTestWorkspace({
            name: "library-1b",
            aliases: ["libB"],
            matchPattern: "libraries/*",
            path: "libraries/libraryB",
            scripts: ["all-workspaces", "b-workspaces", "library-b"],
          }),
        },
      },
    ];

    let i = 0;
    for await (const { metadata, chunk } of output.text()) {
      expect(metadata.streamName).toBe(
        expectedOutput[i].outputChunk.streamName,
      );
      expect(chunk.trim()).toBe(expectedOutput[i].outputChunk.text);
      i++;
    }

    const summaryResult = await summary;

    expect(summaryResult).toEqual(
      makeSummaryResult({
        totalCount: 4,
        successCount: 4,
        scriptResults: [
          makeScriptResult({
            metadata: {
              workspace: makeTestWorkspace({
                name: "application-1a",
                aliases: ["appA"],
                matchPattern: "applications/*",
                path: "applications/applicationA",
                scripts: ["a-workspaces", "all-workspaces", "application-a"],
              }),
            },
          }),
          makeScriptResult({
            metadata: {
              workspace: makeTestWorkspace({
                name: "application-1b",
                aliases: ["appB"],
                matchPattern: "applications/*",
                path: "applications/applicationB",
                scripts: ["all-workspaces", "application-b", "b-workspaces"],
              }),
            },
          }),
          makeScriptResult({
            metadata: {
              workspace: makeTestWorkspace({
                name: "library-1a",
                aliases: ["libA"],
                matchPattern: "libraries/*",
                path: "libraries/libraryA",
                scripts: ["a-workspaces", "all-workspaces", "library-a"],
              }),
            },
          }),
          makeScriptResult({
            metadata: {
              workspace: makeTestWorkspace({
                name: "library-1b",
                aliases: ["libB"],
                matchPattern: "libraries/*",
                path: "libraries/libraryB",
                scripts: ["all-workspaces", "b-workspaces", "library-b"],
              }),
            },
          }),
        ],
      }),
    );
  });

  test(
    "onScriptEvent fires start, exit, and skip events with workspace metadata",
    async () => {
      const project = createFileSystemProject({
        rootDirectory: getProjectRoot("withDependenciesWithFailures"),
      });

      const events: {
        event: ScriptEventName;
        workspaceName: string;
        exitResult: RunScriptExit<RunWorkspaceScriptMetadata> | null;
      }[] = [];

      const { summary } = project.runScriptAcrossWorkspaces({
        script: "test-script",
        dependencyOrder: true,
        onScriptEvent: async (event, { workspace, exitResult }) => {
          events.push({ event, workspaceName: workspace.name, exitResult });
        },
        parallel: false,
      });

      await summary;

      const namesByEvent = (eventName: ScriptEventName) =>
        new Set(
          events
            .filter(({ event }) => event === eventName)
            .map(({ workspaceName }) => workspaceName),
        );

      // e, c-depends-e-fails, d-depends-e, f-fails actually run
      const runWorkspaces = new Set([
        "e",
        "c-depends-e-fails",
        "d-depends-e",
        "f-fails",
      ]);
      // a-depends-f and b-depends-cd are skipped due to dependency failures
      const skippedWorkspaces = new Set(["a-depends-f", "b-depends-cd"]);

      expect(namesByEvent("start")).toEqual(runWorkspaces);
      expect(namesByEvent("exit")).toEqual(runWorkspaces);
      expect(namesByEvent("skip")).toEqual(skippedWorkspaces);

      // start and skip events receive null exitResult; exit events receive the actual exit result
      events
        .filter(({ event }) => event === "start" || event === "skip")
        .forEach(({ exitResult }) => expect(exitResult).toBeNull());
      events
        .filter(({ event }) => event === "exit")
        .forEach(({ workspaceName, exitResult }) => {
          expect(exitResult).not.toBeNull();
          expect(exitResult?.success).toBe(
            workspaceName.includes("fails") ? false : true,
          );
          expect(exitResult?.metadata.workspace.name).toBe(workspaceName);
        });
    },
    { retry: DEFAULT_RETRY },
  );

  test("with args", async () => {
    const project = createFileSystemProject({
      rootDirectory: getProjectRoot("runScriptWithEchoArgs"),
    });

    const { output } = project.runScriptAcrossWorkspaces({
      workspacePatterns: ["application-*"],
      script: "test-echo",
      args: "--arg1=value1 --arg2=value2",
      parallel: false,
    });

    const chunks = await collectStdout(output);
    expect(chunks.map((c) => c.text)).toEqual([
      "passed args: --arg1=value1 --arg2=value2",
      "passed args: --arg1=value1 --arg2=value2",
    ]);
  });

  test("a script name with shell metacharacters is not injected", async () => {
    // The package.json script key contains `;` and `echo INJECTED`. It must be
    // quoted where it lands in the generated shell command, so only the real
    // script body runs and the appended `echo INJECTED` never executes.
    const project = createFileSystemProject({
      rootDirectory: getProjectRoot("runScriptWithMetacharScriptName"),
    });

    const { output } = project.runScriptAcrossWorkspaces({
      script: "evil; echo INJECTED",
      parallel: false,
    });

    const chunks = await collectStdout(output);
    expect(chunks.map((c) => c.text)).toEqual(["ran the real script"]);
  });

  describe("not: pattern semantics", () => {
    test("not: excludes from a positive set", async () => {
      const project = createFileSystemProject({
        rootDirectory: getProjectRoot("workspaceTags"),
      });
      const { summary } = project.runScriptAcrossWorkspaces({
        workspacePatterns: ["*", "not:tag:lib"],
        script: "all-workspaces",
        parallel: false,
      });
      const summaryResult = await summary;
      const names = summaryResult.scriptResults.map(
        (r) => r.metadata.workspace.name,
      );
      expect(names.sort()).toEqual(["application-1a", "application-1b"]);
    });

    test("not: alongside a name pattern that fully overlaps yields empty", () => {
      const project = createFileSystemProject({
        rootDirectory: getProjectRoot("workspaceTags"),
      });
      expect(() =>
        project.runScriptAcrossWorkspaces({
          workspacePatterns: ["library-*", "not:tag:lib"],
          script: "all-workspaces",
          parallel: false,
        }),
      ).toThrow('No matching workspaces found with script "all-workspaces"');
    });

    test("only-negation pattern matches nothing (needs a positive set)", () => {
      const project = createFileSystemProject({
        rootDirectory: getProjectRoot("workspaceTags"),
      });
      expect(() =>
        project.runScriptAcrossWorkspaces({
          workspacePatterns: ["not:tag:lib"],
          script: "all-workspaces",
          parallel: false,
        }),
      ).toThrow('No matching workspaces found with script "all-workspaces"');
    });

    test("prefixed specifier with no match is NOT reported as name-not-found", () => {
      const project = createFileSystemProject({
        rootDirectory: getProjectRoot("workspaceTags"),
      });
      try {
        project.runScriptAcrossWorkspaces({
          workspacePatterns: ["tag:does-not-exist"],
          script: "all-workspaces",
          parallel: false,
        });
        throw new Error("expected to throw");
      } catch (err) {
        const message = (err as Error).message;
        expect(message).not.toContain("Workspace name or alias not found");
        expect(message).toBe(
          'No matching workspaces found with script "all-workspaces"',
        );
      }
    });

    test("explicit empty workspacePatterns array matches no workspaces", () => {
      const project = createFileSystemProject({
        rootDirectory: getProjectRoot("workspaceTags"),
      });
      expect(() =>
        project.runScriptAcrossWorkspaces({
          workspacePatterns: [],
          script: "all-workspaces",
          parallel: false,
        }),
      ).toThrow('No matching workspaces found with script "all-workspaces"');
    });
  });

  describe("@root selector in workspacePatterns", () => {
    test("runs the script on the root workspace when @root is matched", async () => {
      const project = createFileSystemProject({
        rootDirectory: getProjectRoot("withRootWorkspace"),
        includeRootWorkspace: false,
      });

      const { summary } = project.runScriptAcrossWorkspaces({
        workspacePatterns: ["@root"],
        script: "root-workspace",
        parallel: false,
      });

      const summaryResult = await summary;
      expect(summaryResult.totalCount).toBe(1);
      expect(summaryResult.successCount).toBe(1);
      expect(summaryResult.scriptResults[0]?.metadata.workspace.name).toBe(
        "test-root",
      );
    });

    test("@root combines with other patterns", async () => {
      const project = createFileSystemProject({
        rootDirectory: getProjectRoot("withRootWorkspace"),
        includeRootWorkspace: false,
      });

      const { summary } = project.runScriptAcrossWorkspaces({
        workspacePatterns: ["@root", "application-*"],
        script: "all-workspaces",
        parallel: false,
      });

      const summaryResult = await summary;
      const names = summaryResult.scriptResults
        .map((r) => r.metadata.workspace.name)
        .sort();
      expect(names).toContain("test-root");
      expect(names.filter((n) => n.startsWith("application-"))).toHaveLength(2);
    });
  });

  describe("parallel option edge cases", () => {
    test("parallel: true literal does not crash and runs all workspaces", async () => {
      const project = createFileSystemProject({
        rootDirectory: getProjectRoot("default"),
      });

      const { summary } = project.runScriptAcrossWorkspaces({
        workspacePatterns: ["*"],
        script: "all-workspaces",
        parallel: true,
      });

      const summaryResult = await summary;
      expect(summaryResult.totalCount).toBe(5);
      expect(summaryResult.successCount).toBe(5);
    });

    test("parallel.max: 0 throws (must be at least 1)", () => {
      const project = createFileSystemProject({
        rootDirectory: getProjectRoot("default"),
      });

      expect(() =>
        project.runScriptAcrossWorkspaces({
          workspacePatterns: ["*"],
          script: "all-workspaces",
          parallel: { max: 0 },
        }),
      ).toThrow(/at least 1/);
    });

    test("parallel.max: negative number throws", () => {
      const project = createFileSystemProject({
        rootDirectory: getProjectRoot("default"),
      });

      expect(() =>
        project.runScriptAcrossWorkspaces({
          workspacePatterns: ["*"],
          script: "all-workspaces",
          parallel: { max: -3 },
        }),
      ).toThrow(/at least 1/);
    });

    test("parallel.max: 0% throws (percentage must be > 0)", () => {
      const project = createFileSystemProject({
        rootDirectory: getProjectRoot("default"),
      });

      expect(() =>
        project.runScriptAcrossWorkspaces({
          workspacePatterns: ["*"],
          script: "all-workspaces",
          parallel: { max: "0%" },
        }),
      ).toThrow(/greater than 0 and less than or equal to 100/);
    });

    test("parallel.max: garbage string throws Invalid parallel max value", () => {
      const project = createFileSystemProject({
        rootDirectory: getProjectRoot("default"),
      });

      expect(() =>
        project.runScriptAcrossWorkspaces({
          workspacePatterns: ["*"],
          script: "all-workspaces",
          parallel: { max: "not-a-number" as never },
        }),
      ).toThrow(/Invalid parallel max value/);
    });
  });
});
