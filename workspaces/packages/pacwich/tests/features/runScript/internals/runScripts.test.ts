import { randomUUID } from "crypto";
import fs from "fs";
import { availableParallelism } from "os";
import path from "path";
import { getUserEnvVarName } from "@pacwich/common/config";
import { IS_WINDOWS } from "../../../../src/internal/core";
import {
  runScripts,
  type RunScriptExit,
  type RunScriptsSummary,
  type ScriptEventName,
} from "../../../../src/runScript";
import { test, expect, describe, afterAll } from "../../../util/testFramework";

const makeScriptExit = <Metadata extends object = object>(
  overrides: Partial<RunScriptExit<Metadata>> = {},
): RunScriptExit<Metadata> => ({
  exitCode: 0,
  success: true,
  startTimeISO: expect.any(String),
  endTimeISO: expect.any(String),
  durationMs: expect.any(Number),
  signal: null,
  metadata: {} as Metadata,
  ...overrides,
});

const makeExitSummary = <Metadata extends object = object>(
  overrides: Partial<RunScriptsSummary<Metadata>> = {},
): RunScriptsSummary<Metadata> => ({
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

const DEFAULT_RETRY = 5;

const originalParallelMaxDefault =
  process.env[getUserEnvVarName("parallelMaxDefault")];

afterAll(() => {
  process.env[getUserEnvVarName("parallelMaxDefault")] =
    originalParallelMaxDefault;
});

describe("Run Scripts", () => {
  afterAll(() => {
    fs.rmSync(path.join(import.meta.dirname, "test-output"), {
      recursive: true,
    });
  });

  test("Run Scripts - simple series", async () => {
    const result = await runScripts({
      scripts: [
        {
          metadata: {
            name: "test-script name 1",
          },
          scriptCommand: {
            command: "echo test-script 1",
            workingDirectory: "",
          },
          env: {},
        },
        {
          metadata: {
            name: "test-script name 2",
          },
          scriptCommand: {
            command: "echo test-script 2",
            workingDirectory: "",
          },
          env: {},
        },
      ],
      parallel: false,
    });

    let i = 0;
    for await (const { metadata, chunk } of result.output.text()) {
      expect(metadata.name).toBe(`test-script name ${i + 1}`);
      expect(metadata.streamName).toBe("stdout");
      expect(chunk.trim()).toMatch(`test-script ${i + 1}`);
      i++;
    }

    const summary = await result.summary;
    expect(summary).toEqual(
      makeExitSummary({
        totalCount: 2,
        successCount: 2,
        scriptResults: [
          makeScriptExit({ metadata: { name: "test-script name 1" } }),
          makeScriptExit({ metadata: { name: "test-script name 2" } }),
        ],
      }),
    );
  });

  test("Run Scripts - stdout and stderr - process output (bytes)", async () => {
    const result = await runScripts({
      scripts: [
        {
          metadata: { name: "test-script name 1" },
          scriptCommand: {
            command: IS_WINDOWS
              ? `echo test-script 1 && echo test-script 2 1>&2`
              : "echo 'test-script 1' && echo 'test-script 2' >&2",
            workingDirectory: "",
          },
          env: {},
        },
      ],
      parallel: false,
    });

    let outputCount = 0;
    for await (const { metadata, chunk } of result.output.bytes()) {
      expect(metadata.name).toBe("test-script name 1");
      expect(metadata.streamName).toBe(outputCount === 1 ? "stderr" : "stdout");
      expect(new TextDecoder().decode(chunk)).toMatch(
        `test-script ${outputCount + 1}`,
      );
      outputCount++;
    }
    expect(outputCount).toBe(2);

    const summary = await result.summary;
    expect(summary).toEqual(
      makeExitSummary({
        scriptResults: [
          makeScriptExit({ metadata: { name: "test-script name 1" } }),
        ],
      }),
    );
  });

  test("Run Scripts - stdout and stderr - process output (text)", async () => {
    const result = await runScripts({
      scripts: [
        {
          metadata: { name: "test-script name 1" },
          scriptCommand: {
            command: IS_WINDOWS
              ? `echo test-script 1 && echo test-script 2 1>&2`
              : "echo 'test-script 1' && echo 'test-script 2' >&2",
            workingDirectory: "",
          },
          env: {},
        },
      ],
      parallel: false,
    });

    let outputCount = 0;
    for await (const { metadata, chunk } of result.output.text()) {
      expect(metadata.name).toBe("test-script name 1");
      expect(metadata.streamName).toBe(outputCount === 1 ? "stderr" : "stdout");
      expect(chunk.trim()).toBe(`test-script ${outputCount + 1}`);
      outputCount++;
    }
    expect(outputCount).toBe(2);

    const summary = await result.summary;
    expect(summary).toEqual(
      makeExitSummary({
        scriptResults: [
          makeScriptExit({ metadata: { name: "test-script name 1" } }),
        ],
      }),
    );
  });

  test("Run Scripts - simple series with failure", async () => {
    const result = await runScripts({
      scripts: [
        {
          metadata: {
            name: "test-script name 1",
          },
          scriptCommand: {
            command: IS_WINDOWS
              ? "echo test-script 1 && exit /b 1"
              : "echo 'test-script 1' && exit 1",
            workingDirectory: "",
          },
          env: {},
        },
        {
          metadata: {
            name: "test-script name 2",
          },
          scriptCommand: {
            command: "echo test-script 2",
            workingDirectory: "",
          },
          env: {},
        },
      ],
      parallel: false,
    });

    let i = 0;
    for await (const { metadata, chunk } of result.output.text()) {
      expect(metadata.name).toBe(`test-script name ${i + 1}`);
      expect(metadata.streamName).toBe("stdout");
      expect(chunk.trim()).toMatch(`test-script ${i + 1}`);
      i++;
    }

    const summary = await result.summary;
    expect(summary).toEqual(
      makeExitSummary({
        totalCount: 2,
        successCount: 1,
        failureCount: 1,
        allSuccess: false,
        scriptResults: [
          makeScriptExit({
            exitCode: 1,
            success: false,
            metadata: { name: "test-script name 1" },
          }),
          makeScriptExit({ metadata: { name: "test-script name 2" } }),
        ],
      }),
    );
  });

  test("Run Scripts - simple parallel", async () => {
    const scripts = [
      {
        metadata: {
          name: "test-script name 1",
        },
        scriptCommand: {
          command: IS_WINDOWS
            ? "ping 127.0.0.1 -n 3 >nul && echo test-script 1"
            : "sleep 0.5 && echo test-script 1",
          workingDirectory: "",
        },
        env: {},
      },
      {
        metadata: {
          name: "test-script name 2",
        },
        scriptCommand: {
          command: IS_WINDOWS
            ? "echo test-script 2 && exit /b 2"
            : "echo 'test-script 2' && exit 2",
          workingDirectory: "",
        },
        env: {},
      },
      {
        metadata: {
          name: "test-script name 3",
        },
        scriptCommand: {
          command: IS_WINDOWS
            ? "ping 127.0.0.1 -n 2 >nul && echo test-script 3"
            : "sleep 0.25 && echo test-script 3",
          workingDirectory: "",
        },
        env: {},
      },
    ];

    const result = await runScripts({
      scripts,
      parallel: true,
    });

    let i = 0;
    for await (const { metadata, chunk } of result.output.text()) {
      expect(metadata.streamName).toBe("stdout");
      const scriptNum = i === 0 ? 2 : i === 1 ? 3 : 1;
      expect(metadata.name).toBe(`test-script name ${scriptNum}`);
      expect(chunk.trim()).toMatch(`test-script ${scriptNum}`);
      i++;
    }

    const summary = await result.summary;
    expect(summary).toEqual(
      makeExitSummary({
        totalCount: 3,
        successCount: 2,
        failureCount: 1,
        allSuccess: false,
        scriptResults: [
          makeScriptExit({ metadata: { name: "test-script name 1" } }),
          makeScriptExit({
            exitCode: 2,
            success: false,
            metadata: { name: "test-script name 2" },
          }),
          makeScriptExit({ metadata: { name: "test-script name 3" } }),
        ],
      }),
    );
  });

  test.each([1, 2, 3, 4])(
    `Run Scripts - parallel max count %d`,
    { retry: 2 },
    async (max) => {
      const runId = randomUUID();

      const outputDir = path.join(
        __dirname,
        "test-output",
        "run-script-internals-parallel-max",
        runId,
      );
      if (fs.existsSync(outputDir)) {
        fs.rmSync(outputDir, { recursive: true });
      }
      fs.mkdirSync(outputDir, { recursive: true });

      // Floor at 300 ms so the script body outlasts Bun's startup cost on
      // Windows. Without that floor a script can finish before later peers
      // even begin, hiding peak overlap from the post-hoc interval math.
      const getRandomSleepMs = () =>
        Math.floor(Math.max(0.3, Math.random() * 0.4 + 0.3) * 1000);

      const helperPath = path.join(__dirname, "parallelMaxHelper.ts");
      const getOutputPath = (scriptName: string) =>
        path.join(outputDir, `${scriptName}.json`);

      const createScript = (scriptName: string) => ({
        metadata: { name: scriptName },
        scriptCommand: {
          // Bun's argv parsing is cross-platform; quoting handles spaces
          // on both cmd.exe and POSIX shells the same way. No `IS_WINDOWS`
          // branch needed — that branch is what kept tripping the test.
          command: `bun "${helperPath}" "${getOutputPath(scriptName)}" ${getRandomSleepMs()}`,
          workingDirectory: "",
        },
        env: {},
      });

      const scriptNames = [
        "test-script-1",
        "test-script-2",
        "test-script-3",
        "test-script-4",
      ];

      const result = await runScripts({
        parallel: { max },
        scripts: scriptNames.map(createScript),
      });

      // Drain output so summary resolves. We do not parse the chunks —
      // peak concurrency comes from the timestamps the helper wrote.
      for await (const _ of result.output.text()) {
        /* drain */
      }

      const summary = await result.summary;
      expect(summary).toEqual(
        makeExitSummary({
          totalCount: 4,
          successCount: 4,
          scriptResults: scriptNames.map((name) =>
            makeScriptExit({ metadata: { name } }),
          ),
        }),
      );

      // Sweep-line over [start, end) intervals to find the maximum
      // number of scripts whose run windows overlapped at any instant.
      // Ties at the same timestamp resolve "end before start" so
      // back-to-back intervals don't artificially inflate the count.
      const intervals = scriptNames.map((name) => {
        const data = JSON.parse(
          fs.readFileSync(getOutputPath(name), "utf8"),
        ) as { start: number; end: number };
        return data;
      });
      const events = intervals.flatMap(({ start, end }) => [
        { time: start, delta: 1 },
        { time: end, delta: -1 },
      ]);
      events.sort((a, b) => a.time - b.time || a.delta - b.delta);

      let maxOverlap = 0;
      let current = 0;
      for (const event of events) {
        current += event.delta;
        if (current > maxOverlap) maxOverlap = current;
      }

      expect(maxOverlap).toBeLessThanOrEqual(max);
      // 4 scripts, max ∈ [1..4] — scheduler should saturate to `max`
      // at some point during the run.
      expect(maxOverlap).toBe(max);
    },
  );

  test.each([3, "auto", "default", "unbounded", "100%", "50%"] as const)(
    "Run Scripts - confirm parallel max arg types (%p)",
    async (max) => {
      const result = await runScripts({
        parallel: {
          max,
        },
        scripts: [
          {
            scriptCommand: {
              command: IS_WINDOWS
                ? `echo %_PACWICH_PARALLEL_MAX%`
                : "echo $_PACWICH_PARALLEL_MAX",
              workingDirectory: "",
            },
            metadata: {},
            env: {
              _PACWICH_PARALLEL_MAX: max.toString(),
            },
          },
        ],
      });

      for await (const { chunk } of result.output.text()) {
        const envMax = chunk.trim();
        if (typeof max === "number") {
          expect(envMax).toBe(max.toString());
        } else if (max === "default") {
          expect(envMax).toBe(
            process.env[getUserEnvVarName("parallelMaxDefault")]?.trim() ??
              availableParallelism().toString(),
          );
        } else if (max === "auto") {
          expect(envMax).toBe(availableParallelism().toString());
        } else if (max === "unbounded") {
          expect(envMax).toBe("Infinity");
        } else if (max === "100%") {
          expect(envMax).toBe(availableParallelism().toString());
        } else if (max === "50%") {
          expect(envMax).toBe(
            Math.floor(availableParallelism() * 0.5).toString(),
          );
        }
      }
    },
  );

  test.serial.each([1, 2, 3])(
    "Run Scripts - uses default parallel max (%d)",
    async (max) => {
      process.env[getUserEnvVarName("parallelMaxDefault")] = max.toString();

      const defaultResult = await runScripts({
        parallel: true,
        scripts: [
          {
            scriptCommand: {
              command: IS_WINDOWS
                ? `echo %_PACWICH_PARALLEL_MAX%`
                : "echo $_PACWICH_PARALLEL_MAX",
              workingDirectory: "",
            },
            metadata: {},
            env: {},
          },
        ],
      });

      for await (const { chunk } of defaultResult.output.text()) {
        expect(chunk.trim()).toBe(max.toString());
      }

      const explicitResult = await runScripts({
        parallel: {
          max: "default",
        },
        scripts: [
          {
            scriptCommand: {
              command: IS_WINDOWS
                ? `echo %_PACWICH_PARALLEL_MAX%`
                : "echo $_PACWICH_PARALLEL_MAX",
              workingDirectory: "",
            },
            metadata: {},
            env: {},
          },
        ],
      });

      for await (const { chunk } of explicitResult.output.text()) {
        expect(chunk.trim()).toBe(max.toString());
      }
    },
  );

  test("Run Scripts - cyclical default parallel max as 'default' handled as 'auto'", async () => {
    process.env[getUserEnvVarName("parallelMaxDefault")] = "default";

    const result = await runScripts({
      parallel: true,
      scripts: [
        {
          scriptCommand: {
            command: IS_WINDOWS
              ? `echo %_PACWICH_PARALLEL_MAX%`
              : "echo $_PACWICH_PARALLEL_MAX",
            workingDirectory: "",
          },
          metadata: {},
          env: {},
        },
      ],
    });

    for await (const { chunk } of result.output.text()) {
      expect(chunk.trim()).toBe(availableParallelism().toString());
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

    const result = await runScripts({
      scripts: [options, options],
      parallel: false,
    });

    for await (const outputChunk of result.output.text()) {
      expect(outputChunk.metadata.streamName).toBe("stdout");
      expect(outputChunk.chunk.trim()).toBe(`test ${testValue}`);
    }

    await result.summary;
  });
});

describe("Run Scripts - Dependencies", () => {
  test("dependency ordering in serial mode", async () => {
    const executionOrder: string[] = [];

    const result = await runScripts({
      scripts: [
        {
          metadata: { name: "B" },
          scriptCommand: { command: "echo B", workingDirectory: "" },
          env: {},
          shell: "bun",
          dependsOn: [1],
        },
        {
          metadata: { name: "A" },
          scriptCommand: { command: "echo A", workingDirectory: "" },
          env: {},
          shell: "bun",
        },
      ],
      parallel: false,
    });

    for await (const { metadata } of result.output.text()) {
      executionOrder.push(metadata.name);
    }

    expect(executionOrder).toEqual(["A", "B"]);

    const summary = await result.summary;
    expect(summary).toEqual(
      makeExitSummary({
        totalCount: 2,
        successCount: 2,
        scriptResults: [
          makeScriptExit({ metadata: { name: "B" } }),
          makeScriptExit({ metadata: { name: "A" } }),
        ],
      }),
    );
  });

  test("dependency ordering in parallel mode", async () => {
    const executionOrder: string[] = [];

    const result = await runScripts({
      scripts: [
        {
          metadata: { name: "A" },
          scriptCommand: {
            command: "sleep 0.1 && echo A",
            workingDirectory: "",
          },
          env: {},
          shell: "bun",
        },
        {
          metadata: { name: "B" },
          scriptCommand: { command: "echo B", workingDirectory: "" },
          env: {},
          shell: "bun",
        },
        {
          metadata: { name: "C" },
          scriptCommand: { command: "echo C", workingDirectory: "" },
          env: {},
          shell: "bun",
          dependsOn: [0],
        },
      ],
      parallel: true,
    });

    for await (const { metadata } of result.output.text()) {
      executionOrder.push(metadata.name);
    }

    // B completes first (no sleep), then A, then C (waits for A)
    expect(executionOrder).toEqual(["B", "A", "C"]);

    const summary = await result.summary;
    expect(summary.totalCount).toBe(3);
    expect(summary.allSuccess).toBe(true);
  });

  test("skip on dependency failure (default)", async () => {
    const result = await runScripts({
      scripts: [
        {
          metadata: { name: "A" },
          scriptCommand: { command: "exit 1", workingDirectory: "" },
          env: {},
          shell: "bun",
        },
        {
          metadata: { name: "B" },
          scriptCommand: { command: "echo B", workingDirectory: "" },
          env: {},
          shell: "bun",
          dependsOn: [0],
        },
      ],
      parallel: false,
    });

    const summary = await result.summary;
    expect(summary).toEqual(
      makeExitSummary({
        totalCount: 2,
        successCount: 0,
        failureCount: 2,
        allSuccess: false,
        scriptResults: [
          makeScriptExit({
            exitCode: 1,
            success: false,
            metadata: { name: "A" },
          }),
          makeScriptExit({
            exitCode: -1,
            success: false,
            skipped: true,
            durationMs: 0,
            metadata: { name: "B" },
          }),
        ],
      }),
    );
  });

  test("continue on dependency failure", async () => {
    const result = await runScripts({
      scripts: [
        {
          metadata: { name: "A" },
          scriptCommand: { command: "exit 1", workingDirectory: "" },
          env: {},
          shell: "bun",
        },
        {
          metadata: { name: "B" },
          scriptCommand: { command: "echo B", workingDirectory: "" },
          env: {},
          shell: "bun",
          dependsOn: [0],
        },
      ],
      parallel: false,
      ignoreDependencyFailure: true,
    });

    const outputTexts: string[] = [];
    for await (const { chunk } of result.output.text()) {
      outputTexts.push(chunk.trim());
    }

    // B should still run despite A failing
    expect(outputTexts).toContain("B");

    const summary = await result.summary;
    expect(summary.totalCount).toBe(2);
    expect(summary.successCount).toBe(1);
    expect(summary.failureCount).toBe(1);
    expect(summary.scriptResults[1].success).toBe(true);
  });

  test("cycle detection throws", () => {
    expect(() =>
      runScripts({
        scripts: [
          {
            metadata: { name: "A" },
            scriptCommand: { command: "echo A", workingDirectory: "" },
            env: {},
            shell: "bun",
            dependsOn: [1],
          },
          {
            metadata: { name: "B" },
            scriptCommand: { command: "echo B", workingDirectory: "" },
            env: {},
            shell: "bun",
            dependsOn: [0],
          },
        ],
        parallel: false,
      }),
    ).toThrow(/Dependency cycle detected/);
  });

  test("self-referencing dependency throws", () => {
    expect(() =>
      runScripts({
        scripts: [
          {
            metadata: { name: "A" },
            scriptCommand: { command: "echo A", workingDirectory: "" },
            env: {},
            shell: "bun",
            dependsOn: [0],
          },
        ],
        parallel: false,
      }),
    ).toThrow(/self-referencing dependency/);
  });

  test("invalid dependency index throws", () => {
    expect(() =>
      runScripts({
        scripts: [
          {
            metadata: { name: "A" },
            scriptCommand: { command: "echo A", workingDirectory: "" },
            env: {},
            shell: "bun",
            dependsOn: [99],
          },
          {
            metadata: { name: "B" },
            scriptCommand: { command: "echo B", workingDirectory: "" },
            env: {},
            shell: "bun",
          },
          {
            metadata: { name: "C" },
            scriptCommand: { command: "echo C", workingDirectory: "" },
            env: {},
            shell: "bun",
          },
        ],
        parallel: false,
      }),
    ).toThrow(/invalid index 99/);
  });

  test("diamond dependency", async () => {
    const executionOrder: string[] = [];

    const result = await runScripts({
      scripts: [
        {
          metadata: { name: "A" },
          scriptCommand: { command: "echo A", workingDirectory: "" },
          env: {},
          shell: "bun",
        },
        {
          metadata: { name: "B" },
          scriptCommand: { command: "echo B", workingDirectory: "" },
          env: {},
          shell: "bun",
          dependsOn: [0],
        },
        {
          metadata: { name: "C" },
          scriptCommand: { command: "echo C", workingDirectory: "" },
          env: {},
          shell: "bun",
          dependsOn: [0],
        },
        {
          metadata: { name: "D" },
          scriptCommand: { command: "echo D", workingDirectory: "" },
          env: {},
          shell: "bun",
          dependsOn: [1, 2],
        },
      ],
      parallel: true,
    });

    for await (const { metadata } of result.output.text()) {
      executionOrder.push(metadata.name);
    }

    // A must run first, B and C after A (in any order), D after both B and C
    expect(executionOrder.indexOf("A")).toBeLessThan(
      executionOrder.indexOf("B"),
    );
    expect(executionOrder.indexOf("A")).toBeLessThan(
      executionOrder.indexOf("C"),
    );
    expect(executionOrder.indexOf("B")).toBeLessThan(
      executionOrder.indexOf("D"),
    );
    expect(executionOrder.indexOf("C")).toBeLessThan(
      executionOrder.indexOf("D"),
    );

    const summary = await result.summary;
    expect(summary.totalCount).toBe(4);
    expect(summary.allSuccess).toBe(true);
  });

  test("diamond dependency (different pass order)", async () => {
    const executionOrder: string[] = [];

    const result = await runScripts({
      scripts: [
        {
          metadata: { name: "D" },
          scriptCommand: { command: "echo A", workingDirectory: "" },
          env: {},
          shell: "bun",
          dependsOn: [1, 3],
        },
        {
          metadata: { name: "B" },
          scriptCommand: { command: "echo B", workingDirectory: "" },
          env: {},
          shell: "bun",
          dependsOn: [2],
        },
        {
          metadata: { name: "A" },
          scriptCommand: { command: "echo C", workingDirectory: "" },
          env: {},
          shell: "bun",
        },
        {
          metadata: { name: "C" },
          scriptCommand: { command: "echo D", workingDirectory: "" },
          env: {},
          shell: "bun",
          dependsOn: [2],
        },
      ],
      parallel: true,
    });

    for await (const { metadata } of result.output.text()) {
      executionOrder.push(metadata.name);
    }

    // A must run first, B and C after A (in any order), D after both B and C
    expect(executionOrder.indexOf("A")).toBeLessThan(
      executionOrder.indexOf("B"),
    );
    expect(executionOrder.indexOf("A")).toBeLessThan(
      executionOrder.indexOf("C"),
    );
    expect(executionOrder.indexOf("B")).toBeLessThan(
      executionOrder.indexOf("D"),
    );
    expect(executionOrder.indexOf("C")).toBeLessThan(
      executionOrder.indexOf("D"),
    );

    const summary = await result.summary;
    expect(summary.totalCount).toBe(4);
    expect(summary.allSuccess).toBe(true);
  });

  test(
    "onScriptEvent - fires start and exit for a running script",
    async () => {
      const events: {
        event: ScriptEventName;
        index: number;
        result: RunScriptExit<{ name: string }> | null;
      }[] = [];

      const result = runScripts({
        scripts: [
          {
            metadata: { name: "A" },
            scriptCommand: { command: "echo A", workingDirectory: "" },
            env: {},
            shell: "bun",
          },
          {
            metadata: { name: "B" },
            scriptCommand: { command: "echo B", workingDirectory: "" },
            env: {},
            shell: "bun",
          },
        ],
        parallel: false,
        onScriptEvent: (event, index, exitResult) => {
          events.push({ event, index, result: exitResult });
        },
      });

      await result.summary;

      expect(events).toEqual([
        { event: "start", index: 0, result: null },
        {
          event: "exit",
          index: 0,
          result: makeScriptExit({ metadata: { name: "A" } }),
        },
        { event: "start", index: 1, result: null },
        {
          event: "exit",
          index: 1,
          result: makeScriptExit({ metadata: { name: "B" } }),
        },
      ]);
    },
    { retry: DEFAULT_RETRY },
  );

  test(
    "onScriptEvent - fires skip (not start or exit) for a dependency-failed script",
    async () => {
      const events: {
        event: ScriptEventName;
        index: number;
        result: RunScriptExit<{ name: string }> | null;
      }[] = [];

      const result = runScripts({
        scripts: [
          {
            metadata: { name: "A" },
            scriptCommand: { command: "exit 1", workingDirectory: "" },
            env: {},
            shell: "bun",
          },
          {
            metadata: { name: "B" },
            scriptCommand: { command: "echo B", workingDirectory: "" },
            env: {},
            shell: "bun",
            dependsOn: [0],
          },
        ],
        parallel: false,
        onScriptEvent: (event, index, exitResult) => {
          events.push({ event, index, result: exitResult });
        },
      });

      await result.summary;

      expect(events).toContainEqual({ event: "start", index: 0, result: null });
      expect(events).toContainEqual({
        event: "exit",
        index: 0,
        result: makeScriptExit({
          exitCode: 1,
          success: false,
          metadata: { name: "A" },
        }),
      });
      expect(events).toContainEqual({ event: "skip", index: 1, result: null });
      expect(events).not.toContainEqual(
        expect.objectContaining({ event: "start", index: 1 }),
      );
      expect(events).not.toContainEqual(
        expect.objectContaining({ event: "exit", index: 1 }),
      );
    },
    { retry: DEFAULT_RETRY },
  );

  test(
    "onScriptEvent - all three event types fire across scripts in a single run",
    async () => {
      const events: {
        event: ScriptEventName;
        index: number;
        result: RunScriptExit<{ name: string }> | null;
      }[] = [];

      const result = runScripts({
        scripts: [
          {
            metadata: { name: "A" },
            scriptCommand: { command: "exit 1", workingDirectory: "" },
            env: {},
            shell: "bun",
          },
          {
            metadata: { name: "B" },
            scriptCommand: { command: "echo B", workingDirectory: "" },
            env: {},
            shell: "bun",
          },
          {
            metadata: { name: "C" },
            scriptCommand: { command: "echo C", workingDirectory: "" },
            env: {},
            shell: "bun",
            dependsOn: [0],
          },
        ],
        parallel: false,
        onScriptEvent: (event, index, exitResult) => {
          events.push({ event, index, result: exitResult });
        },
      });

      await result.summary;

      // A fails: start (null result) + exit (failed result)
      expect(events).toContainEqual({ event: "start", index: 0, result: null });
      expect(events).toContainEqual({
        event: "exit",
        index: 0,
        result: makeScriptExit({
          exitCode: 1,
          success: false,
          metadata: { name: "A" },
        }),
      });
      // B succeeds: start (null result) + exit (success result)
      expect(events).toContainEqual({ event: "start", index: 1, result: null });
      expect(events).toContainEqual({
        event: "exit",
        index: 1,
        result: makeScriptExit({ metadata: { name: "B" } }),
      });
      // C skipped due to A's failure: skip (null result) only
      expect(events).toContainEqual({ event: "skip", index: 2, result: null });
      expect(events).not.toContainEqual(
        expect.objectContaining({ event: "start", index: 2 }),
      );
      expect(events).not.toContainEqual(
        expect.objectContaining({ event: "exit", index: 2 }),
      );
    },
    { retry: DEFAULT_RETRY },
  );

  test("cascading skip on dependency failure", async () => {
    const result = await runScripts({
      scripts: [
        {
          metadata: { name: "A" },
          scriptCommand: { command: "exit 1", workingDirectory: "" },
          env: {},
          shell: "bun",
        },
        {
          metadata: { name: "B" },
          scriptCommand: { command: "echo B", workingDirectory: "" },
          env: {},
          shell: "bun",
          dependsOn: [0],
        },
        {
          metadata: { name: "C" },
          scriptCommand: { command: "echo C", workingDirectory: "" },
          env: {},
          shell: "bun",
          dependsOn: [1],
        },
      ],
      parallel: false,
    });

    const summary = await result.summary;
    expect(summary.totalCount).toBe(3);
    expect(summary.successCount).toBe(0);
    expect(summary.failureCount).toBe(3);

    expect(summary.scriptResults[0].exitCode).toBe(1);
    expect(summary.scriptResults[0].skipped).toBeUndefined();

    expect(summary.scriptResults[1].skipped).toBe(true);
    expect(summary.scriptResults[1].exitCode).toBe(-1);

    expect(summary.scriptResults[2].skipped).toBe(true);
    expect(summary.scriptResults[2].exitCode).toBe(-1);
  });
});
