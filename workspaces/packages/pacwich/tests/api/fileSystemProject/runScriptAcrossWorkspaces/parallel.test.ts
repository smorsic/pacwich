import { availableParallelism } from "os";
import { getUserEnvVar } from "../../../../src/config/userEnvVars";
import { createFileSystemProject } from "../../../../src/project";
import { getProjectRoot } from "../../../fixtures/testProjects";
import { collectStdout } from "../../../util/collectOutput";
import { makeTestWorkspace } from "../../../util/testData";
import { expect, test, describe } from "../../../util/testFramework";
import { makeScriptResult, makeSummaryResult } from "./util";

describe("FileSystemProject runScriptAcrossWorkspaces - parallel", () => {
  test("parallel", async () => {
    const project = createFileSystemProject({
      rootDirectory: getProjectRoot("runScriptWithDelays"),
    });

    const { output, summary } = project.runScriptAcrossWorkspaces({
      workspacePatterns: ["*"],
      script: "test-delay",
    });

    const expectedOutput = [
      {
        outputChunk: {
          streamName: "stdout" as const,
          text: "first",
          textNoAnsi: "first",
        },
        scriptMetadata: {
          workspace: makeTestWorkspace({
            name: "first",
            matchPattern: "packages/**/*",
            path: "packages/first",
            scripts: ["test-delay"],
          }),
        },
      },
      {
        outputChunk: {
          streamName: "stdout" as const,
          text: "second",
          textNoAnsi: "second",
        },
        scriptMetadata: {
          workspace: makeTestWorkspace({
            name: "second",
            matchPattern: "packages/**/*",
            path: "packages/second",
            scripts: ["test-delay"],
          }),
        },
      },
      {
        outputChunk: {
          streamName: "stdout" as const,
          text: "third",
          textNoAnsi: "third",
        },
        scriptMetadata: {
          workspace: makeTestWorkspace({
            name: "third",
            matchPattern: "packages/**/*",
            path: "packages/third",
            scripts: ["test-delay"],
          }),
        },
      },
      {
        outputChunk: {
          streamName: "stdout" as const,
          text: "fourth",
          textNoAnsi: "fourth",
        },
        scriptMetadata: {
          workspace: makeTestWorkspace({
            name: "fourth",
            matchPattern: "packages/**/*",
            path: "packages/fourth",
            scripts: ["test-delay"],
          }),
        },
      },
      {
        outputChunk: {
          streamName: "stdout" as const,
          text: "fifth",
          textNoAnsi: "fifth",
        },
        scriptMetadata: {
          workspace: makeTestWorkspace({
            name: "fifth",
            matchPattern: "packages/**/*",
            path: "packages/fifth",
            scripts: ["test-delay"],
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

    expect(summaryResult.durationMs).toBeGreaterThan(1000);
    expect(summaryResult.durationMs).toBeLessThan(2000);

    expect(summaryResult).toEqual(
      makeSummaryResult({
        totalCount: 5,
        successCount: 5,
        scriptResults: [
          makeScriptResult({
            metadata: {
              workspace: makeTestWorkspace({
                name: "fifth",
                matchPattern: "packages/**/*",
                path: "packages/fifth",
                scripts: ["test-delay"],
              }),
            },
          }),
          makeScriptResult({
            metadata: {
              workspace: makeTestWorkspace({
                name: "first",
                matchPattern: "packages/**/*",
                path: "packages/first",
                scripts: ["test-delay"],
              }),
            },
          }),
          makeScriptResult({
            metadata: {
              workspace: makeTestWorkspace({
                name: "fourth",
                matchPattern: "packages/**/*",
                path: "packages/fourth",
                scripts: ["test-delay"],
              }),
            },
          }),
          makeScriptResult({
            metadata: {
              workspace: makeTestWorkspace({
                name: "second",
                matchPattern: "packages/**/*",
                path: "packages/second",
                scripts: ["test-delay"],
              }),
            },
          }),
          makeScriptResult({
            metadata: {
              workspace: makeTestWorkspace({
                name: "third",
                matchPattern: "packages/**/*",
                path: "packages/third",
                scripts: ["test-delay"],
              }),
            },
          }),
        ],
      }),
    );
  });

  test("parallel with root default", async () => {
    const project = createFileSystemProject({
      rootDirectory: getProjectRoot("runScriptWithDebugParallelMaxRootDefault"),
    });

    const { output } = project.runScriptAcrossWorkspaces({
      workspacePatterns: ["*"],
      script: "test-debug",
    });

    const chunks = await collectStdout(output);
    expect(chunks.map((c) => c.text)).toEqual(["3"]);
  });

  test.each([1, 2, 3, "default", "auto", "unbounded", "100%", "50%"] as const)(
    "parallel with max (%p)",
    async (max) => {
      const project = createFileSystemProject({
        rootDirectory: getProjectRoot("runScriptWithDebugParallelMax"),
      });

      const { output } = project.runScriptAcrossWorkspaces({
        workspacePatterns: ["*"],
        script: "test-debug",
        parallel: { max },
      });

      const expectedMax = (() => {
        if (typeof max === "number") return max.toString();
        if (max === "default")
          return (
            getUserEnvVar("parallelMaxDefault")?.trim() ??
            availableParallelism().toString()
          );
        if (max === "auto") return availableParallelism().toString();
        if (max === "unbounded") return "Infinity";
        // percentage
        return Math.max(
          1,
          Math.floor(
            (availableParallelism() * parseFloat(max.slice(0, -1))) / 100,
          ),
        ).toString();
      })();

      const chunks = await collectStdout(output);
      expect(chunks.map((c) => c.text)).toEqual([expectedMax]);
    },
  );
});
