import { text as readStreamText } from "stream/consumers";
import { SERVER_INSTRUCTIONS } from "../../src/ai/mcp";
import { createSubprocess } from "../../src/runScript/subprocesses";
import { getProjectRoot, type TestProjectName } from "../fixtures/testProjects";
import { CLI_INVOCATION } from "../util/cliTestUtils";
import { describe, expect, test } from "../util/testFramework";

const sendMcpInitialize = async (
  args: string[],
  testProject: TestProjectName = "fullProject",
) => {
  const subprocess = createSubprocess(
    [...CLI_INVOCATION, "mcp-server", ...args],
    {
      cwd: getProjectRoot(testProject),
      env: { ...process.env },
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
    },
  );
  subprocess.stdin!.write(
    JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {},
    }) + "\n",
  );
  subprocess.stdin!.end();
  const output = await readStreamText(subprocess.stdout!);
  await subprocess.exited;
  return JSON.parse(output.trim()) as {
    result?: { instructions?: string };
  };
};

describe("CLI - mcp-server command", () => {
  test("initializes with server instructions", async () => {
    const response = await sendMcpInitialize([]);
    expect(response.result?.instructions).toContain(SERVER_INSTRUCTIONS);
  });
});
