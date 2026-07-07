import {
  generatePlainOutputLines,
  generateGroupedOutputLines,
} from "../../../../../src/cli/commands/runScript/output/renderPlainOutput";
import { describe, expect, test } from "../../../../util/testFramework";

type FakeChunk = {
  workspaceName: string;
  chunk: string;
  droppedBytesBefore?: number;
};

/**
 * Build a minimal stand-in for RunScriptAcrossWorkspacesOutput exposing only
 * the `text()` async iterator that `generatePlainOutputLines` consumes.
 */
const createFakeOutput = (chunks: FakeChunk[]) => ({
  text: async function* () {
    for (const { workspaceName, chunk, droppedBytesBefore } of chunks) {
      yield {
        metadata: {
          workspace: { name: workspaceName },
          streamName: "stdout" as const,
        },
        chunk,
        droppedBytesBefore,
      };
    }
  },
});

/**
 * Like {@link createFakeOutput} but exposes `textWithCompletion()` (with a
 * per-stream `end` event) for {@link generateGroupedOutputLines}.
 */
const createFakeCompletionOutput = (chunks: FakeChunk[], droppedBytes = 0) => ({
  textWithCompletion: async function* () {
    for (const { workspaceName, chunk, droppedBytesBefore } of chunks) {
      yield {
        type: "chunk" as const,
        metadata: {
          workspace: { name: workspaceName },
          streamName: "stdout" as const,
        },
        chunk,
        droppedBytesBefore,
      };
    }
    yield {
      type: "end" as const,
      metadata: {
        workspace: { name: chunks[0]?.workspaceName ?? "ws" },
        streamName: "stdout" as const,
      },
      droppedBytes,
    };
  },
});

describe("generatePlainOutputLines workspace-name prefix", () => {
  test("strips ANSI sequences and C0 controls from workspace name in prefix", async () => {
    // ANSI (clear-screen + cursor home) plus BEL and backspace — covers
    // both halves of stripANSI's escape-sequence and control-char passes.
    const malicious = `evil\x1b[2J\x1b[H\x07\x08name`;
    const fakeOutput = createFakeOutput([
      { workspaceName: malicious, chunk: "hello\n" },
    ]) as unknown as Parameters<typeof generatePlainOutputLines>[0];

    const lines: string[] = [];
    for await (const { line } of generatePlainOutputLines(fakeOutput, {
      prefix: true,
    })) {
      lines.push(line);
    }

    expect(lines).toHaveLength(1);
    expect(lines[0]).not.toContain("\x1b[2J");
    expect(lines[0]).not.toContain("\x1b[H");
    expect(lines[0]).not.toContain("\x07");
    expect(lines[0]).not.toContain("\x08");
    expect(lines[0]).toContain("[evilname]");
  });

  test("normal workspace names are preserved in prefix", async () => {
    const fakeOutput = createFakeOutput([
      { workspaceName: "my-workspace", chunk: "hello\n" },
    ]) as unknown as Parameters<typeof generatePlainOutputLines>[0];

    const lines: string[] = [];
    for await (const { line } of generatePlainOutputLines(fakeOutput, {
      prefix: true,
    })) {
      lines.push(line);
    }

    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("[my-workspace] hello");
  });
});

describe("generatePlainOutputLines line buffering", () => {
  const collect = async (chunks: FakeChunk[], prefix = false) => {
    const fakeOutput = createFakeOutput(chunks) as unknown as Parameters<
      typeof generatePlainOutputLines
    >[0];
    const lines: string[] = [];
    for await (const { line } of generatePlainOutputLines(fakeOutput, {
      prefix,
    })) {
      lines.push(line);
    }
    return lines;
  };

  test("a line split across chunks is emitted once, not as a growing partial", async () => {
    const lines = await collect([
      { workspaceName: "ws", chunk: "hello wor" },
      { workspaceName: "ws", chunk: "ld\n" },
    ]);

    // Previously this yielded "hello wor" then "hello world" (the partial
    // re-emitted). Now the incomplete line is held until the newline arrives.
    expect(lines.map((l) => l.replaceAll("\x1b[0m", ""))).toEqual([
      "hello world",
    ]);
  });

  test("flushes a trailing line with no final newline exactly once", async () => {
    const lines = await collect([
      { workspaceName: "ws", chunk: "line-1\nno-newline-tail" },
    ]);

    expect(lines.map((l) => l.replaceAll("\x1b[0m", ""))).toEqual([
      "line-1",
      "no-newline-tail",
    ]);
  });

  test("a long newline-less stream does not re-emit growing partials", async () => {
    // Four chunks, no newlines: the buggy version yielded "a","ab","abc","abcd"
    // (quadratic). Now nothing is yielded until the end-of-stream flush emits
    // the single accumulated line once.
    const lines = await collect([
      { workspaceName: "ws", chunk: "a" },
      { workspaceName: "ws", chunk: "b" },
      { workspaceName: "ws", chunk: "c" },
      { workspaceName: "ws", chunk: "d" },
    ]);

    expect(lines.map((l) => l.replaceAll("\x1b[0m", ""))).toEqual(["abcd"]);
  });

  test("independent workspaces buffer and flush separately", async () => {
    const lines = await collect([
      { workspaceName: "a", chunk: "a-partial" },
      { workspaceName: "b", chunk: "b-line\n" },
      { workspaceName: "a", chunk: "-rest\n" },
    ]);

    expect(lines.map((l) => l.replaceAll("\x1b[0m", ""))).toEqual([
      "b-line",
      "a-partial-rest",
    ]);
  });
});

describe("generateGroupedOutputLines line buffering", () => {
  test("flushes a trailing partial line before the end event", async () => {
    const fakeOutput = createFakeCompletionOutput([
      { workspaceName: "ws", chunk: "done-no-newline" },
    ]) as unknown as Parameters<typeof generateGroupedOutputLines>[0];

    const events = [];
    for await (const event of generateGroupedOutputLines(fakeOutput, {})) {
      events.push(event);
    }

    const lineEvents = events.filter((e) => e.type === "line");
    expect(
      lineEvents.map(
        (e) => e.type === "line" && e.line.replaceAll("\x1b[0m", ""),
      ),
    ).toEqual(["done-no-newline"]);
    expect(events.at(-1)?.type).toBe("end");
  });
});

describe("generatePlainOutputLines drop notice", () => {
  test("emits an inline drop notice before the chunk when output was dropped", async () => {
    const fakeOutput = createFakeOutput([
      { workspaceName: "ws", chunk: "kept-tail\n", droppedBytesBefore: 4096 },
    ]) as unknown as Parameters<typeof generatePlainOutputLines>[0];

    const lines: string[] = [];
    for await (const { line } of generatePlainOutputLines(fakeOutput, {})) {
      lines.push(line);
    }

    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain("output buffer limit reached");
    expect(lines[0]).toContain("4.0 KB");
    expect(lines[1]).toContain("kept-tail");
  });

  test("no notice when nothing was dropped", async () => {
    const fakeOutput = createFakeOutput([
      { workspaceName: "ws", chunk: "hello\n" },
    ]) as unknown as Parameters<typeof generatePlainOutputLines>[0];

    const lines: string[] = [];
    for await (const { line } of generatePlainOutputLines(fakeOutput, {})) {
      lines.push(line);
    }

    expect(lines).toHaveLength(1);
    expect(lines[0]).not.toContain("output buffer limit reached");
  });

  test("prefixed notice carries the workspace prefix", async () => {
    const fakeOutput = createFakeOutput([
      { workspaceName: "app", chunk: "tail\n", droppedBytesBefore: 2048 },
    ]) as unknown as Parameters<typeof generatePlainOutputLines>[0];

    const lines: string[] = [];
    for await (const { line } of generatePlainOutputLines(fakeOutput, {
      prefix: true,
    })) {
      lines.push(line);
    }

    expect(lines[0]).toContain("[app]");
    expect(lines[0]).toContain("output buffer limit reached");
  });
});

describe("generateGroupedOutputLines drop notice", () => {
  test("emits a drop-notice line inline and an end event", async () => {
    const fakeOutput = createFakeCompletionOutput(
      [{ workspaceName: "ws", chunk: "tail\n", droppedBytesBefore: 1048576 }],
      1048576,
    ) as unknown as Parameters<typeof generateGroupedOutputLines>[0];

    const events = [];
    for await (const event of generateGroupedOutputLines(fakeOutput, {})) {
      events.push(event);
    }

    const lineEvents = events.filter((e) => e.type === "line");
    expect(lineEvents[0].type === "line" && lineEvents[0].line).toContain(
      "output buffer limit reached",
    );
    expect(lineEvents[0].type === "line" && lineEvents[0].line).toContain(
      "1.0 MB",
    );
    expect(lineEvents[1].type === "line" && lineEvents[1].line).toContain(
      "tail",
    );
    expect(events.at(-1)?.type).toBe("end");
  });
});
