import { type RunScriptAcrossWorkspacesResult } from "pacwich_local";

const start = new Date("1999-12-31T23:59:59.999Z");
const end = new Date(start.getTime() + 5136);
const durationMs = end.getTime() - start.getTime();

export const RUN_SCRIPT_EXAMPLE_JSON_OUTPUT: Awaited<
  RunScriptAcrossWorkspacesResult["summary"]
> = {
  totalCount: 2,
  successCount: 1,
  failureCount: 1,
  allSuccess: false,
  startTimeISO: start.toISOString(),
  endTimeISO: end.toISOString(),
  durationMs,
  scriptResults: [
    {
      exitCode: 0,
      signal: null,
      success: true,
      startTimeISO: start.toISOString(),
      endTimeISO: new Date(end.getTime() - durationMs * 0.75).toISOString(),
      durationMs: durationMs * 0.75,
      metadata: {
        workspace: {
          name: "my-workspace-a",
          isRoot: false,
          matchPattern: "packages/**/*",
          path: "packages/my-workspace-a",
          scripts: ["my-script"],
          tags: ["my-tag"],
          aliases: ["mwa"],
          dependencies: [],
          dependents: [],
          externalDependencies: [],
        },
      },
    },
    {
      exitCode: 1,
      signal: null,
      success: false,
      startTimeISO: new Date(start.getTime() + durationMs * 0.75).toISOString(),
      endTimeISO: new Date(end.getTime() - 1).toISOString(),
      durationMs: durationMs * 0.25 - 1,
      metadata: {
        workspace: {
          name: "my-workspace-b",
          isRoot: false,
          matchPattern: "packages/**/*",
          path: "packages/my-workspace-b",
          scripts: ["my-script"],
          tags: ["my-tag"],
          aliases: ["mwb"],
          dependencies: [],
          dependents: [],
          externalDependencies: [],
        },
      },
    },
  ],
};
