import { IS_WINDOWS } from "../../../../src/internal/core";
import { runScript, runScripts } from "../../../../src/runScript";
import { describe, test, expect } from "../../../util/testFramework";

/** POSIX command that emits exactly `bytes` bytes of ASCII output. */
const emitBytesCommand = (bytes: number) => `yes x | head -c ${bytes}`;

// PRODUCED is kept far larger than CAP so that, even accounting for the
// post-exit pipe-drain / consume race (the consumer can pull a few chunks
// before eviction applies), the retained tail is still a small fraction of
// what was produced. The exact drop-oldest cap semantics are pinned
// deterministically in processOutput.test.ts; here we only assert the cap is
// wired end-to-end and bounds memory to well under the produced volume.
const PRODUCED = 4_000_000;
const CAP = 100_000;
const RETAINED_UPPER_BOUND = PRODUCED / 2;

describe.skipIf(IS_WINDOWS)("Output buffer — runScript (single)", () => {
  test("bounds retained output and reports dropped bytes", async () => {
    const result = runScript({
      scriptCommand: {
        command: emitBytesCommand(PRODUCED),
        workingDirectory: "",
      },
      metadata: { name: "big" },
      env: {},
      maxOutputBufferBytes: CAP,
    });

    // Let the subprocess finish producing before consuming, so the buffer
    // fills and drops (the slow/absent-consumer memory-safety scenario).
    await result.exit;

    let retained = 0;
    let dropped = 0;
    for await (const { chunk, droppedBytesBefore } of result.output.bytes()) {
      retained += chunk.byteLength;
      dropped += droppedBytesBefore ?? 0;
    }

    expect(dropped).toBeGreaterThan(0);
    expect(retained + dropped).toBe(PRODUCED);
    expect(retained).toBeLessThan(RETAINED_UPPER_BOUND);
  });

  test("unbounded (Infinity) retains everything, drops nothing", async () => {
    const result = runScript({
      scriptCommand: {
        command: emitBytesCommand(PRODUCED),
        workingDirectory: "",
      },
      metadata: { name: "big" },
      env: {},
      maxOutputBufferBytes: Infinity,
    });

    await result.exit;

    let retained = 0;
    let dropped = 0;
    for await (const { chunk, droppedBytesBefore } of result.output.bytes()) {
      retained += chunk.byteLength;
      dropped += droppedBytesBefore ?? 0;
    }

    expect(dropped).toBe(0);
    expect(retained).toBe(PRODUCED);
  });
});

describe.skipIf(IS_WINDOWS)("Output buffer — runScripts (batch)", () => {
  test("bounds retained output per script and reports dropped bytes on end", async () => {
    const result = runScripts({
      scripts: [
        {
          metadata: { name: "big" },
          scriptCommand: {
            command: emitBytesCommand(PRODUCED),
            workingDirectory: "",
          },
          env: {},
        },
      ],
      parallel: false,
      maxOutputBufferBytes: CAP,
    });

    // Drain into the bounded buffer, then consume.
    await result.summary;

    let retained = 0;
    let dropped = 0;
    for await (const event of result.output.textWithCompletion()) {
      if (event.type === "chunk") {
        // ASCII output: char length == byte length.
        retained += event.chunk.length;
      } else if (event.metadata.streamName === "stdout") {
        dropped = event.droppedBytes;
      }
    }

    expect(dropped).toBeGreaterThan(0);
    expect(retained + dropped).toBe(PRODUCED);
    expect(retained).toBeLessThan(RETAINED_UPPER_BOUND);
  });

  test("ignoreOutput wins: nothing captured, nothing dropped", async () => {
    const result = runScripts({
      scripts: [
        {
          metadata: { name: "big" },
          scriptCommand: {
            command: emitBytesCommand(PRODUCED),
            workingDirectory: "",
          },
          env: {},
        },
      ],
      parallel: false,
      ignoreOutput: true,
      maxOutputBufferBytes: CAP,
    });

    await result.summary;

    let retained = 0;
    let dropped = 0;
    for await (const event of result.output.textWithCompletion()) {
      if (event.type === "chunk") retained += event.chunk.length;
      else dropped += event.droppedBytes;
    }

    expect(retained).toBe(0);
    expect(dropped).toBe(0);
  });
});
