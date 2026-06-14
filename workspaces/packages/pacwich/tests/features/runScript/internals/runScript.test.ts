import { IS_WINDOWS } from "../../../../src/internal/core";
import { runScript, type RunScriptExit } from "../../../../src/runScript";
import { test, expect, describe } from "../../../util/testFramework";

const makeExitResult = (
  overrides: Partial<RunScriptExit> = {},
): RunScriptExit => ({
  exitCode: 0,
  success: true,
  startTimeISO: expect.any(String),
  endTimeISO: expect.any(String),
  durationMs: expect.any(Number),
  signal: null,
  metadata: {},
  ...overrides,
});

describe("Run Script", () => {
  test("Simple success - process output (bytes)", async () => {
    const result = await runScript({
      scriptCommand: {
        command: "echo test-script 1",
        workingDirectory: ".",
      },
      metadata: {},
      env: {},
    });

    let outputCount = 0;
    for await (const chunk of result.output.bytes()) {
      expect(chunk.metadata.streamName).toBe("stdout");
      expect(chunk.chunk).toBeInstanceOf(Uint8Array);
      expect(new TextDecoder().decode(chunk.chunk)).toMatch(
        `test-script ${outputCount + 1}`,
      );
      outputCount++;
    }

    const exit = await result.exit;
    expect(exit).toEqual(makeExitResult({}));
    expect(new Date(exit.startTimeISO).getTime()).toBeLessThanOrEqual(
      new Date(exit.endTimeISO).getTime(),
    );
    expect(exit.durationMs).toBe(
      new Date(exit.endTimeISO).getTime() -
        new Date(exit.startTimeISO).getTime(),
    );
    expect(outputCount).toBe(1);
  });

  test("Simple success - process output (text)", async () => {
    const result = await runScript({
      scriptCommand: {
        command: "echo test-script 1",
        workingDirectory: ".",
      },
      metadata: {},
      env: {},
    });

    let outputCount = 0;
    for await (const chunk of result.output.text()) {
      expect(chunk.metadata.streamName).toBe("stdout");
      expect(chunk.chunk.trim()).toBe(`test-script ${outputCount + 1}`);
      outputCount++;
    }

    const exit = await result.exit;
    expect(exit).toEqual(makeExitResult({}));
    expect(new Date(exit.startTimeISO).getTime()).toBeLessThanOrEqual(
      new Date(exit.endTimeISO).getTime(),
    );
    expect(exit.durationMs).toBe(
      new Date(exit.endTimeISO).getTime() -
        new Date(exit.startTimeISO).getTime(),
    );
    expect(outputCount).toBe(1);
  });

  test("Simple failure", async () => {
    const result = await runScript({
      scriptCommand: {
        command: IS_WINDOWS
          ? "echo test-script 1 && exit /b 2"
          : "echo 'test-script 1' && sleep 0.1 && exit 2",
        workingDirectory: ".",
      },
      metadata: {},
      env: {},
    });

    let outputCount = 0;
    for await (const outputChunk of result.output.bytes()) {
      expect(outputChunk.metadata.streamName).toBe("stdout");
      expect(new TextDecoder().decode(outputChunk.chunk)).toMatch(
        `test-script ${outputCount + 1}`,
      );
      outputCount++;
    }
    const exit = await result.exit;
    expect(exit).toEqual(makeExitResult({ exitCode: 2, success: false }));
    expect(new Date(exit.startTimeISO).getTime()).toBeLessThanOrEqual(
      new Date(exit.endTimeISO).getTime(),
    );
    expect(exit.durationMs).toBe(
      new Date(exit.endTimeISO).getTime() -
        new Date(exit.startTimeISO).getTime(),
    );
    expect(outputCount).toBe(1);
  });

  if (!IS_WINDOWS) {
    test(
      "Simple failure with signal",
      async () => {
        const result = await runScript({
          scriptCommand: {
            command: "sleep 5",
            workingDirectory: ".",
          },
          metadata: {},
          env: {},
        });

        result.kill("SIGINT");

        const exit = await result.exit;
        expect(exit).toEqual(
          makeExitResult({
            exitCode: 130,
            success: false,
            signal: "SIGINT",
          }),
        );
      },
      { retry: 5 },
    );
  }

  test(
    "With stdout and stderr - process output (bytes)",
    async () => {
      const result = await runScript({
        scriptCommand: {
          command: "echo test-script 1 && echo test-script 2 >&2",
          workingDirectory: ".",
        },
        metadata: {},
        env: {},
      });

      let outputCount = 0;
      for await (const chunk of result.output.bytes()) {
        expect(chunk.metadata.streamName).toBe(
          outputCount === 1 ? "stderr" : "stdout",
        );
        expect(new TextDecoder().decode(chunk.chunk)).toMatch(
          `test-script ${outputCount + 1}`,
        );
        outputCount++;
      }

      const exit = await result.exit;
      expect(exit).toEqual(makeExitResult({}));
    },
    { retry: 5 },
  );

  test("With stdout and stderr - process output (text)", async () => {
    const result = await runScript({
      scriptCommand: {
        command: "echo test-script 1 && echo test-script 2 >&2",
        workingDirectory: ".",
      },
      metadata: {},
      env: {},
    });

    let outputCount = 0;
    for await (const chunk of result.output.text()) {
      expect(chunk.metadata.streamName).toBe(
        outputCount === 1 ? "stderr" : "stdout",
      );
      expect(chunk.chunk.trim()).toBe(`test-script ${outputCount + 1}`);
      outputCount++;
    }
  });

  test("Env vars are passed", async () => {
    const testValue = `test value ${Math.round(Math.random() * 1000000)}`;
    const scriptCommand = {
      command: IS_WINDOWS
        ? `echo %NODE_ENV% %TEST_ENV_VAR%`
        : "echo $NODE_ENV $TEST_ENV_VAR",
      workingDirectory: ".",
      env: { TEST_ENV_VAR: testValue },
    };

    const options = {
      scriptCommand,
      metadata: {},
      env: { TEST_ENV_VAR: testValue },
    };

    const result = await runScript(options);

    for await (const outputChunk of result.output.text()) {
      expect(outputChunk.metadata.streamName).toBe("stdout");
      expect(outputChunk.chunk.trim()).toBe(`test ${testValue}`);
    }
  });
});
