import {
  type RunScriptAcrossWorkspacesSummary,
  type RunWorkspaceScriptMetadata,
} from "../../../../src/project";
import type { RunScriptExit } from "../../../../src/runScript";
import { makeTestWorkspace } from "../../../util/testData";
import { expect } from "../../../util/testFramework";

export const makeSummaryResult = (
  overrides: Partial<RunScriptAcrossWorkspacesSummary>,
): RunScriptAcrossWorkspacesSummary => ({
  totalCount: 1,
  successCount: 1,
  failureCount: 0,
  allSuccess: true,
  startTimeISO: expect.any(String),
  endTimeISO: expect.any(String),
  durationMs: expect.any(Number),
  scriptResults: [],
  ...overrides,
});

export const makeScriptResult = (
  overrides: Partial<RunScriptExit<RunWorkspaceScriptMetadata>>,
): RunScriptExit<RunWorkspaceScriptMetadata> => ({
  exitCode: 0,
  success: true,
  startTimeISO: expect.any(String),
  endTimeISO: expect.any(String),
  durationMs: expect.any(Number),
  signal: null,
  metadata: {
    workspace: makeTestWorkspace({
      name: "test",
      path: "test",
      matchPattern: "test",
      scripts: ["test"],
    }),
  },
  ...overrides,
});
