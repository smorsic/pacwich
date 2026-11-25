import { IS_POSIX } from "../../../src/internal/core";
import { runScript } from "../../../src/runScript";
import { stripANSI } from "../../util/runtime";
import { expect, test, describe } from "../../util/testFramework";

type HostProcessRun = {
  stdout: string;
  stderr: string;
  exitCode: number;
  signal: NodeJS.Signals | null;
};

const runHostProcessScript = async (
  env: Record<string, string> = {},
): Promise<HostProcessRun> => {
  const { exit, output } = runScript({
    scriptCommand: {
      command: "bun run ../../fixtures/testScripts/onExitHostProcess.ts",
      workingDirectory: __dirname,
    },
    metadata: {},
    env,
  });

  let stdout = "";
  let stderr = "";
  for await (const { chunk, metadata } of output.text()) {
    if (metadata.streamName === "stderr") {
      stderr += stripANSI(chunk);
    } else {
      stdout += chunk;
    }
  }

  const { exitCode, signal } = await exit;
  return { stdout, stderr, exitCode, signal };
};

describe("runOnExit host process behavior", () => {
  test("host exit listeners registered after runOnExit still run", async () => {
    const { stdout, exitCode } = await runHostProcessScript();
    expect(stdout).toInclude("pacwich cleanup ran");
    expect(stdout).toInclude("host exit listener ran");
    expect(exitCode).toBe(0);
  });

  test("uncaught exceptions in the host process are still reported", async () => {
    const { stdout, stderr, exitCode } = await runHostProcessScript({
      CRASH: "true",
    });
    expect(stderr).toInclude("Host crash");
    expect(stdout).toInclude("pacwich cleanup ran");
    expect(stdout).toInclude("host exit listener ran");
    expect(exitCode).toBe(1);
  });

  test.if(IS_POSIX)(
    "signal is not re-raised when the host has its own handler",
    async () => {
      const { stdout, exitCode } = await runHostProcessScript({
        SIGNAL_MODE: "host-handler",
      });
      expect(stdout).toInclude("pacwich cleanup ran");
      expect(stdout).toInclude("host SIGINT calls: 1");
      expect(exitCode).toBe(42);
    },
  );

  test.if(IS_POSIX)(
    "signal death is preserved when pacwich has the only handler",
    async () => {
      const { stdout, exitCode, signal } = await runHostProcessScript({
        SIGNAL_MODE: "no-handler",
      });
      expect(stdout).toInclude("pacwich cleanup ran");
      expect(stdout).not.toInclude("keep-alive expired without signal death");
      expect(signal === "SIGTERM" || exitCode === 143).toBe(true);
    },
  );
});
