import { describe, expect, test } from "bun:test";
import { generatePlainOutputLines } from "../../../../../src/cli/commands/runScript/output/renderPlainOutput";

/**
 * Build a minimal stand-in for RunScriptAcrossWorkspacesOutput exposing only
 * the `text()` async iterator that `generatePlainOutputLines` consumes.
 */
const createFakeOutput = (
  chunks: { workspaceName: string; chunk: string }[],
) => ({
  text: async function* () {
    for (const { workspaceName, chunk } of chunks) {
      yield {
        metadata: {
          workspace: { name: workspaceName },
          streamName: "stdout" as const,
        },
        chunk,
      };
    }
  },
});

describe("generatePlainOutputLines workspace-name prefix", () => {
  test("strips ANSI sequences and C0 controls from workspace name in prefix", async () => {
    // ANSI (clear-screen + cursor home) plus BEL and backspace — covers both
    // what Bun.stripANSI catches and the broader control-char strip.
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
