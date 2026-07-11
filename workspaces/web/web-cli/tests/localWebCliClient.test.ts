/**
 * Tests for the local HttpClient adapter (`localWebCliClient.ts`) that
 * replaces the old, dead `bw-web-service-shared` HTTP client for the ported
 * UI. Run under bun with the same fs/subprocess mocking as `runCli.test.ts`
 * (see the shared `tests/setup.ts` preload), since `invokeWebCli` is backed
 * by the real `runPacwichCliArgv`.
 */
import type { InvokeCliResponseChunk } from "@pacwich/web-common/web-cli-runtime";
import { expect, test } from "bun:test";

test("health and ready resolve immediately, with no backend to probe", async () => {
  const { localWebCliClient } =
    await import("@pacwich/web-common/web-cli-runtime");

  const health = await localWebCliClient.health();
  const ready = await localWebCliClient.ready();

  expect(health).toEqual({ status: "ok", buildId: "local", env: "local" });
  expect(ready).toEqual({ isReady: true });
});

test("invokeWebCli streams incremental chunks then a final isDone chunk", async () => {
  const { localWebCliClient } =
    await import("@pacwich/web-common/web-cli-runtime");

  const chunks: InvokeCliResponseChunk[] = [];
  for await (const chunk of localWebCliClient.invokeWebCli({
    argv: ["list-workspaces", "--name-only"],
    terminalWidth: 80,
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
  expect(combined).toContain("@demo/utils");

  const lastChunk = chunks[chunks.length - 1];
  expect(lastChunk.isDone).toBe(true);
  expect(lastChunk.exitCode).toBe(0);
});

test("invokeWebCli reports a guard-blocked command as a clean final chunk", async () => {
  const { localWebCliClient } =
    await import("@pacwich/web-common/web-cli-runtime");

  const chunks: InvokeCliResponseChunk[] = [];
  for await (const chunk of localWebCliClient.invokeWebCli({
    argv: ["doctor"],
    terminalWidth: 80,
  })) {
    chunks.push(chunk);
  }

  const stderrText = chunks
    .filter((c) => c.streamName === "stderr")
    .map((c) => c.terminalOutput)
    .join("");
  expect(stderrText).toMatch(/doctor.*isn't available/i);
  expect(stderrText).not.toMatch(/\bat\b.*\.ts:|MiddlewareHandlerFailed/);

  const lastChunk = chunks[chunks.length - 1];
  expect(lastChunk.isDone).toBe(true);
  expect(lastChunk.exitCode).toBe(2);
});
