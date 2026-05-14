import { describe, expect, test } from "bun:test";
import { SERVER_INSTRUCTIONS } from "../../src/ai/mcp";
import { createSubprocess } from "../../src/runScript/subprocesses";
import { getProjectRoot, type TestProjectName } from "../fixtures/testProjects";
import { SOURCE_BIN_PATH } from "../util/cliTestUtils";

const sendMcpInitialize = async (
  args: string[],
  testProject: TestProjectName = "fullProject",
) => {
  const subprocess = createSubprocess(
    ["bun", SOURCE_BIN_PATH, "mcp-server", ...args],
    {
      cwd: getProjectRoot(testProject),
      env: { ...process.env },
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
    },
  );
  subprocess.stdin.write(
    JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {},
    }) + "\n",
  );
  subprocess.stdin.end();
  const output = await new Response(subprocess.stdout).text();
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

  test("accepts --enable-all-config-files flag", async () => {
    const response = await sendMcpInitialize(["--enable-all-config-files"]);
    expect(response.result?.instructions).toContain(SERVER_INSTRUCTIONS);
  });
});
