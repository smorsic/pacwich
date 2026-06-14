import { createFileSystemProject } from "../../../../src/project";
import { getProjectRoot } from "../../../fixtures/testProjects";
import { makeTestWorkspace } from "../../../util/testData";
import { expect, test, describe } from "../../../util/testFramework";
import { makeScriptResult, makeSummaryResult } from "./util";

describe("FileSystemProject runScriptAcrossWorkspaces - dependencies", () => {
  describe("dependencyOrder", () => {
    const makeSimpleDepWorkspace = (
      overrides: Parameters<typeof makeTestWorkspace>[0],
    ) =>
      makeTestWorkspace({
        matchPattern: "packages/*",
        scripts: ["test-script"],
        ...overrides,
      });

    test("runs in alphanumerical order without dependencyOrder", async () => {
      const project = createFileSystemProject({
        rootDirectory: getProjectRoot("withDependenciesSimple"),
      });

      const { output, summary } = project.runScriptAcrossWorkspaces({
        script: "test-script",
        parallel: false,
      });

      const outputLetters: string[] = [];
      for await (const { chunk } of output.text()) {
        outputLetters.push(chunk.trim());
      }

      expect(outputLetters).toEqual(["A", "B", "C", "D", "E"]);

      const summaryResult = await summary;
      expect(summaryResult).toEqual(
        makeSummaryResult({
          totalCount: 5,
          successCount: 5,
          scriptResults: [
            makeScriptResult({
              metadata: {
                workspace: makeSimpleDepWorkspace({
                  name: "a-depends-e",
                  path: "packages/a-depends-e",
                  dependencies: ["e"],
                }),
              },
            }),
            makeScriptResult({
              metadata: {
                workspace: makeSimpleDepWorkspace({
                  name: "b-depends-cd",
                  path: "packages/b-depends-cd",
                  dependencies: ["c-depends-e", "d-depends-e"],
                }),
              },
            }),
            makeScriptResult({
              metadata: {
                workspace: makeSimpleDepWorkspace({
                  name: "c-depends-e",
                  path: "packages/c-depends-e",
                  dependencies: ["e"],
                  dependents: ["b-depends-cd"],
                }),
              },
            }),
            makeScriptResult({
              metadata: {
                workspace: makeSimpleDepWorkspace({
                  name: "d-depends-e",
                  path: "packages/d-depends-e",
                  dependencies: ["e"],
                  dependents: ["b-depends-cd"],
                }),
              },
            }),
            makeScriptResult({
              metadata: {
                workspace: makeSimpleDepWorkspace({
                  name: "e",
                  path: "packages/e",
                  dependents: ["a-depends-e", "c-depends-e", "d-depends-e"],
                }),
              },
            }),
          ],
        }),
      );
    });

    test("runs in dependency graph order with dependencyOrder: true", async () => {
      const project = createFileSystemProject({
        rootDirectory: getProjectRoot("withDependenciesSimple"),
      });

      const { output, summary } = project.runScriptAcrossWorkspaces({
        script: "test-script",
        dependencyOrder: true,
        parallel: false,
      });

      // e has no deps so it runs first; then a/c/d unblock (in index order);
      // then b unblocks once both c and d are done
      const outputLetters: string[] = [];
      for await (const { chunk } of output.text()) {
        outputLetters.push(chunk.trim());
      }

      expect(outputLetters).toEqual(["E", "A", "C", "D", "B"]);

      // summary scriptResults are always in workspace index (alphanumerical) order
      const summaryResult = await summary;
      expect(summaryResult).toEqual(
        makeSummaryResult({
          totalCount: 5,
          successCount: 5,
          scriptResults: [
            makeScriptResult({
              metadata: {
                workspace: makeSimpleDepWorkspace({
                  name: "a-depends-e",
                  path: "packages/a-depends-e",
                  dependencies: ["e"],
                }),
              },
            }),
            makeScriptResult({
              metadata: {
                workspace: makeSimpleDepWorkspace({
                  name: "b-depends-cd",
                  path: "packages/b-depends-cd",
                  dependencies: ["c-depends-e", "d-depends-e"],
                }),
              },
            }),
            makeScriptResult({
              metadata: {
                workspace: makeSimpleDepWorkspace({
                  name: "c-depends-e",
                  path: "packages/c-depends-e",
                  dependencies: ["e"],
                  dependents: ["b-depends-cd"],
                }),
              },
            }),
            makeScriptResult({
              metadata: {
                workspace: makeSimpleDepWorkspace({
                  name: "d-depends-e",
                  path: "packages/d-depends-e",
                  dependencies: ["e"],
                  dependents: ["b-depends-cd"],
                }),
              },
            }),
            makeScriptResult({
              metadata: {
                workspace: makeSimpleDepWorkspace({
                  name: "e",
                  path: "packages/e",
                  dependents: ["a-depends-e", "c-depends-e", "d-depends-e"],
                }),
              },
            }),
          ],
        }),
      );
    });

    test("runs dependency batches in parallel", async () => {
      const project = createFileSystemProject({
        rootDirectory: getProjectRoot("withDependenciesSimpleWithDelays"),
      });

      const { summary } = project.runScriptAcrossWorkspaces({
        script: "test-script",
        dependencyOrder: true,
      });

      const { scriptResults } = await summary;

      const byName = new Map(
        scriptResults.map((r) => [r.metadata.workspace.name, r] as const),
      );
      const toMs = (iso: string) => new Date(iso).getTime();

      const e = byName.get("e")!;
      const a = byName.get("a-depends-e")!;
      const c = byName.get("c-depends-e")!;
      const d = byName.get("d-depends-e")!;
      const b = byName.get("b-depends-cd")!;

      // batch 1 → batch 2: e must finish before a, c, d can start
      expect(toMs(e.endTimeISO)).toBeLessThanOrEqual(toMs(a.startTimeISO));
      expect(toMs(e.endTimeISO)).toBeLessThanOrEqual(toMs(c.startTimeISO));
      expect(toMs(e.endTimeISO)).toBeLessThanOrEqual(toMs(d.startTimeISO));

      // batch 2 → batch 3: c and d must finish before b can start
      expect(toMs(c.endTimeISO)).toBeLessThanOrEqual(toMs(b.startTimeISO));
      expect(toMs(d.endTimeISO)).toBeLessThanOrEqual(toMs(b.startTimeISO));

      // c and d ran concurrently (their ranges overlap)
      expect(toMs(c.startTimeISO)).toBeLessThan(toMs(d.endTimeISO));
      expect(toMs(d.startTimeISO)).toBeLessThan(toMs(c.endTimeISO));
    });

    test("detects a direct dependency cycle and runs remaining graph in order", async () => {
      const project = createFileSystemProject({
        rootDirectory: getProjectRoot("withDependenciesDirectCycle"),
      });

      const { output, summary } = project.runScriptAcrossWorkspaces({
        script: "test-script",
        dependencyOrder: true,
        parallel: false,
      });

      // a-depends-c ↔ c-depends-a forms a cycle; all edges between cycle nodes are stripped.
      // c and a both become dep-free; b still depends on c → order: A, C, B
      const outputLetters: string[] = [];
      for await (const { chunk } of output.text()) {
        outputLetters.push(chunk.trim());
      }

      expect(outputLetters).toEqual(["A", "C", "B"]);

      const summaryResult = await summary;
      expect(summaryResult).toEqual(
        makeSummaryResult({
          totalCount: 3,
          successCount: 3,
          scriptResults: [
            makeScriptResult({
              metadata: {
                workspace: makeTestWorkspace({
                  name: "a-depends-c",
                  path: "packages/a-depends-c",
                  matchPattern: "packages/*",
                  scripts: ["test-script"],
                  dependencies: [],
                  dependents: [],
                }),
              },
            }),
            makeScriptResult({
              metadata: {
                workspace: makeTestWorkspace({
                  name: "b-depends-c",
                  path: "packages/b-depends-c",
                  matchPattern: "packages/*",
                  scripts: ["test-script"],
                  dependencies: ["c-depends-a"],
                }),
              },
            }),
            makeScriptResult({
              metadata: {
                workspace: makeTestWorkspace({
                  name: "c-depends-a",
                  path: "packages/c-depends-a",
                  matchPattern: "packages/*",
                  scripts: ["test-script"],
                  dependencies: [],
                  dependents: ["b-depends-c"],
                }),
              },
            }),
          ],
        }),
      );
    });

    test("detects an indirect dependency cycle and runs remaining graph in order", async () => {
      const project = createFileSystemProject({
        rootDirectory: getProjectRoot("withDependenciesIndirectCycle"),
      });

      const { output, summary } = project.runScriptAcrossWorkspaces({
        script: "test-script",
        dependencyOrder: true,
        parallel: false,
      });

      // a→b→c→a forms a cycle; all three nodes are cycle participants so all
      // edges between them are stripped — each runs dep-free in alphanumerical order
      const outputLetters: string[] = [];
      for await (const { chunk } of output.text()) {
        outputLetters.push(chunk.trim());
      }

      expect(outputLetters).toEqual(["A", "B", "C"]);

      const summaryResult = await summary;
      expect(summaryResult).toEqual(
        makeSummaryResult({
          totalCount: 3,
          successCount: 3,
          scriptResults: [
            makeScriptResult({
              metadata: {
                workspace: makeTestWorkspace({
                  name: "a-depends-b",
                  path: "packages/a-depends-b",
                  matchPattern: "packages/*",
                  scripts: ["test-script"],
                }),
              },
            }),
            makeScriptResult({
              metadata: {
                workspace: makeTestWorkspace({
                  name: "b-depends-c",
                  path: "packages/b-depends-c",
                  matchPattern: "packages/*",
                  scripts: ["test-script"],
                }),
              },
            }),
            makeScriptResult({
              metadata: {
                workspace: makeTestWorkspace({
                  name: "c-depends-a",
                  path: "packages/c-depends-a",
                  matchPattern: "packages/*",
                  scripts: ["test-script"],
                }),
              },
            }),
          ],
        }),
      );
    });

    test("detects an indirect cycle among a mixed graph and runs non-cycle workspaces in dependency order", async () => {
      const project = createFileSystemProject({
        rootDirectory: getProjectRoot("withDependenciesIndirectCycleMixed"),
      });

      const { output, summary } = project.runScriptAcrossWorkspaces({
        script: "test-script",
        dependencyOrder: true,
        parallel: false,
      });

      // a→b→c→a cycle: all three nodes stripped of mutual edges, run dep-free alphanumerically.
      // f depends on b (not a cycle node), e depends on f, d depends on e →
      // after a/b/c finish, f unblocks, then e, then d → A, B, C, F, E, D
      const outputLetters: string[] = [];
      for await (const { chunk } of output.text()) {
        outputLetters.push(chunk.trim());
      }

      expect(outputLetters).toEqual(["A", "B", "C", "F", "E", "D"]);

      const summaryResult = await summary;
      expect(summaryResult).toEqual(
        makeSummaryResult({
          totalCount: 6,
          successCount: 6,
          scriptResults: [
            makeScriptResult({
              metadata: {
                workspace: makeTestWorkspace({
                  name: "a-depends-b",
                  path: "packages/a-depends-b",
                  matchPattern: "packages/*",
                  scripts: ["test-script"],
                }),
              },
            }),
            makeScriptResult({
              metadata: {
                workspace: makeTestWorkspace({
                  name: "b-depends-c",
                  path: "packages/b-depends-c",
                  matchPattern: "packages/*",
                  scripts: ["test-script"],
                  dependents: ["f-depends-b"],
                }),
              },
            }),
            makeScriptResult({
              metadata: {
                workspace: makeTestWorkspace({
                  name: "c-depends-a",
                  path: "packages/c-depends-a",
                  matchPattern: "packages/*",
                  scripts: ["test-script"],
                }),
              },
            }),
            makeScriptResult({
              metadata: {
                workspace: makeTestWorkspace({
                  name: "d-depends-e",
                  path: "packages/d-depends-e",
                  matchPattern: "packages/*",
                  scripts: ["test-script"],
                  dependencies: ["e-depends-f"],
                }),
              },
            }),
            makeScriptResult({
              metadata: {
                workspace: makeTestWorkspace({
                  name: "e-depends-f",
                  path: "packages/e-depends-f",
                  matchPattern: "packages/*",
                  scripts: ["test-script"],
                  dependencies: ["f-depends-b"],
                  dependents: ["d-depends-e"],
                }),
              },
            }),
            makeScriptResult({
              metadata: {
                workspace: makeTestWorkspace({
                  name: "f-depends-b",
                  path: "packages/f-depends-b",
                  matchPattern: "packages/*",
                  scripts: ["test-script"],
                  dependencies: ["b-depends-c"],
                  dependents: ["e-depends-f"],
                }),
              },
            }),
          ],
        }),
      );
    });

    describe("when some workspaces fail", () => {
      const makeFailuresWorkspace = (
        overrides: Parameters<typeof makeTestWorkspace>[0],
      ) =>
        makeTestWorkspace({
          matchPattern: "packages/*",
          scripts: ["test-script"],
          ...overrides,
        });

      test("skips dependents of failed workspaces by default", async () => {
        const project = createFileSystemProject({
          rootDirectory: getProjectRoot("withDependenciesWithFailures"),
        });

        const { output, summary } = project.runScriptAcrossWorkspaces({
          script: "test-script",
          dependencyOrder: true,
          parallel: false,
        });

        // e runs first; c and d unblock (both dep on e); c fails, d succeeds;
        // f has no deps so runs next and fails;
        // a (deps f) and b (deps c+d, but c failed) are both skipped
        const outputLetters: string[] = [];
        for await (const { chunk } of output.text()) {
          outputLetters.push(chunk.trim());
        }

        expect(outputLetters).toEqual(["E", "C", "D", "F"]);

        const summaryResult = await summary;
        expect(summaryResult).toEqual(
          makeSummaryResult({
            totalCount: 6,
            successCount: 2,
            failureCount: 4,
            allSuccess: false,
            scriptResults: [
              makeScriptResult({
                exitCode: -1,
                success: false,
                skipped: true,
                durationMs: 0,
                metadata: {
                  workspace: makeFailuresWorkspace({
                    name: "a-depends-f",
                    path: "packages/a-depends-f",
                    dependencies: ["f-fails"],
                  }),
                },
              }),
              makeScriptResult({
                exitCode: -1,
                success: false,
                skipped: true,
                durationMs: 0,
                metadata: {
                  workspace: makeFailuresWorkspace({
                    name: "b-depends-cd",
                    path: "packages/b-depends-cd",
                    dependencies: ["c-depends-e-fails", "d-depends-e"],
                  }),
                },
              }),
              makeScriptResult({
                exitCode: 1,
                success: false,
                metadata: {
                  workspace: makeFailuresWorkspace({
                    name: "c-depends-e-fails",
                    path: "packages/c-depends-e-fails",
                    dependencies: ["e"],
                    dependents: ["b-depends-cd"],
                  }),
                },
              }),
              makeScriptResult({
                metadata: {
                  workspace: makeFailuresWorkspace({
                    name: "d-depends-e",
                    path: "packages/d-depends-e",
                    dependencies: ["e"],
                    dependents: ["b-depends-cd"],
                  }),
                },
              }),
              makeScriptResult({
                metadata: {
                  workspace: makeFailuresWorkspace({
                    name: "e",
                    path: "packages/e",
                    dependents: ["c-depends-e-fails", "d-depends-e"],
                  }),
                },
              }),
              makeScriptResult({
                exitCode: 1,
                success: false,
                metadata: {
                  workspace: makeFailuresWorkspace({
                    name: "f-fails",
                    path: "packages/f-fails",
                    dependents: ["a-depends-f"],
                  }),
                },
              }),
            ],
          }),
        );
      });

      test("runs all workspaces with ignoreDependencyFailure: true", async () => {
        const project = createFileSystemProject({
          rootDirectory: getProjectRoot("withDependenciesWithFailures"),
        });

        const { output, summary } = project.runScriptAcrossWorkspaces({
          script: "test-script",
          dependencyOrder: true,
          ignoreDependencyFailure: true,
          parallel: false,
        });

        // same order as before but nothing is skipped:
        // e → c (fail) → d → b (runs despite c failing) → f (fail) → a
        const outputLetters: string[] = [];
        for await (const { chunk } of output.text()) {
          outputLetters.push(chunk.trim());
        }

        expect(outputLetters).toEqual(["E", "C", "D", "B", "F", "A"]);

        const summaryResult = await summary;
        expect(summaryResult).toEqual(
          makeSummaryResult({
            totalCount: 6,
            successCount: 4,
            failureCount: 2,
            allSuccess: false,
            scriptResults: [
              makeScriptResult({
                metadata: {
                  workspace: makeFailuresWorkspace({
                    name: "a-depends-f",
                    path: "packages/a-depends-f",
                    dependencies: ["f-fails"],
                  }),
                },
              }),
              makeScriptResult({
                metadata: {
                  workspace: makeFailuresWorkspace({
                    name: "b-depends-cd",
                    path: "packages/b-depends-cd",
                    dependencies: ["c-depends-e-fails", "d-depends-e"],
                  }),
                },
              }),
              makeScriptResult({
                exitCode: 1,
                success: false,
                metadata: {
                  workspace: makeFailuresWorkspace({
                    name: "c-depends-e-fails",
                    path: "packages/c-depends-e-fails",
                    dependencies: ["e"],
                    dependents: ["b-depends-cd"],
                  }),
                },
              }),
              makeScriptResult({
                metadata: {
                  workspace: makeFailuresWorkspace({
                    name: "d-depends-e",
                    path: "packages/d-depends-e",
                    dependencies: ["e"],
                    dependents: ["b-depends-cd"],
                  }),
                },
              }),
              makeScriptResult({
                metadata: {
                  workspace: makeFailuresWorkspace({
                    name: "e",
                    path: "packages/e",
                    dependents: ["c-depends-e-fails", "d-depends-e"],
                  }),
                },
              }),
              makeScriptResult({
                exitCode: 1,
                success: false,
                metadata: {
                  workspace: makeFailuresWorkspace({
                    name: "f-fails",
                    path: "packages/f-fails",
                    dependents: ["a-depends-f"],
                  }),
                },
              }),
            ],
          }),
        );
      });
    });

    test("runs subset of workspaces in dependency graph order", async () => {
      const project = createFileSystemProject({
        rootDirectory: getProjectRoot("withDependenciesSimple"),
      });

      const { output, summary } = project.runScriptAcrossWorkspaces({
        workspacePatterns: ["b-depends-cd", "d-depends-e", "e"],
        script: "test-script",
        dependencyOrder: true,
        parallel: false,
      });

      // e has no deps; d unblocks after e; b unblocks after d
      // (c-depends-e is not in the subset so b's dep on it is ignored)
      const outputLetters: string[] = [];
      for await (const { chunk } of output.text()) {
        outputLetters.push(chunk.trim());
      }

      expect(outputLetters).toEqual(["E", "D", "B"]);

      const summaryResult = await summary;
      expect(summaryResult).toEqual(
        makeSummaryResult({
          totalCount: 3,
          successCount: 3,
          scriptResults: [
            makeScriptResult({
              metadata: {
                workspace: makeSimpleDepWorkspace({
                  name: "b-depends-cd",
                  path: "packages/b-depends-cd",
                  dependencies: ["c-depends-e", "d-depends-e"],
                }),
              },
            }),
            makeScriptResult({
              metadata: {
                workspace: makeSimpleDepWorkspace({
                  name: "d-depends-e",
                  path: "packages/d-depends-e",
                  dependencies: ["e"],
                  dependents: ["b-depends-cd"],
                }),
              },
            }),
            makeScriptResult({
              metadata: {
                workspace: makeSimpleDepWorkspace({
                  name: "e",
                  path: "packages/e",
                  dependents: ["a-depends-e", "c-depends-e", "d-depends-e"],
                }),
              },
            }),
          ],
        }),
      );
    });
  });
});
