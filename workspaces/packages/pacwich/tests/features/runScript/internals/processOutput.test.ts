import { createAsyncIterableQueue } from "../../../../src/internal/core";
import { createProcessOutput } from "../../../../src/runScript/output/processOutput";
import { describe, test, expect } from "../../../util/testFramework";

const flushMicrotasks = async (count = 5) => {
  for (let i = 0; i < count; i++) {
    await Promise.resolve();
  }
};

describe("ProcessOutput", () => {
  test(".bytes() works when input stream has already finished draining", async () => {
    const stream = createAsyncIterableQueue<Uint8Array<ArrayBufferLike>>();
    const processOutput = createProcessOutput(stream, { name: "p" });

    const message = new TextEncoder().encode("hello");
    stream.push(message);
    stream.close();

    await flushMicrotasks();

    const chunks: Uint8Array[] = [];
    for await (const { chunk } of processOutput.bytes()) {
      chunks.push(chunk);
    }

    expect(chunks.length).toBe(1);
    expect(new TextDecoder().decode(chunks[0])).toBe("hello");
  });

  test(".text() works when input stream has already finished draining", async () => {
    const stream = createAsyncIterableQueue<Uint8Array<ArrayBufferLike>>();
    const processOutput = createProcessOutput(stream, { name: "p" });

    stream.push(new TextEncoder().encode("hello"));
    stream.close();

    await flushMicrotasks();

    const chunks: string[] = [];
    for await (const { chunk } of processOutput.text()) {
      chunks.push(chunk);
    }

    expect(chunks.join("")).toBe("hello");
  });

  test("calling .bytes() twice throws OutputStreamStarted", async () => {
    const stream = createAsyncIterableQueue<Uint8Array<ArrayBufferLike>>();
    const processOutput = createProcessOutput(stream, { name: "p" });

    processOutput.bytes();
    expect(() => processOutput.bytes()).toThrow(
      /Only one stream can be opened/,
    );

    stream.close();
  });
});
