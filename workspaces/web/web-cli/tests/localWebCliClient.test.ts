/**
 * Tests for the local web CLI client (`localWebCliClient.ts`). Run under bun
 * with the same fs/subprocess mocking as `runCli.test.ts` (see the shared
 * `tests/setup.ts` preload), since `invokeWebCli` is backed by the real
 * `runPacwichCliArgv`.
 */
import { expect, test } from "bun:test";
import type { InvokeCliResponseChunk } from "../src/web-cli-runtime";

test("invokeWebCli streams incremental chunks then a final isDone chunk", async () => {
  const { localWebCliClient } = await import("../src/web-cli-runtime");

  const chunks: InvokeCliResponseChunk[] = [];
  for await (const chunk of localWebCliClient.invokeWebCli({
    argv: ["list-workspaces", "--name-only"],
    terminalWidth: 80,
    terminalHeight: 30,
  })) {
    chunks.push(chunk);
  }

  expect(chunks.length).toBeGreaterThan(1);

  const dataChunks = chunks.slice(0, -1);
  for (const chunk of dataChunks) {
    expect(chunk.isDone).toBe(false);
    expect(chunk.exitCode).toBeNull();
    expect(chunk.errors).toEqual([]);
    expect(chunk.warnings).toEqual([]);
  }
  const combined = dataChunks.map((c) => c.terminalOutput).join("");
  expect(combined).toContain("@demo/shared-utils");

  const lastChunk = chunks[chunks.length - 1];
  expect(lastChunk.isDone).toBe(true);
  expect(lastChunk.exitCode).toBe(0);
});

test("invokeWebCli reports a guard-blocked command as a clean final chunk", async () => {
  const { localWebCliClient } = await import("../src/web-cli-runtime");

  const chunks: InvokeCliResponseChunk[] = [];
  for await (const chunk of localWebCliClient.invokeWebCli({
    argv: ["list-workspaces", "--cwd", "/elsewhere"],
    terminalWidth: 80,
    terminalHeight: 30,
  })) {
    chunks.push(chunk);
  }

  const stderrText = chunks
    .filter((c) => c.streamName === "stderr")
    .map((c) => c.terminalOutput)
    .join("");
  expect(stderrText).toMatch(/--cwd.*fixed/i);
  expect(stderrText).not.toMatch(/\bat\b.*\.ts:|MiddlewareHandlerFailed/);

  const lastChunk = chunks[chunks.length - 1];
  expect(lastChunk.isDone).toBe(true);
  expect(lastChunk.exitCode).toBe(2);
});
