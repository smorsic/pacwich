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

  test("unbounded buffer retains everything and reports droppedBytes 0", async () => {
    const stream = createAsyncIterableQueue<Uint8Array<ArrayBufferLike>>();
    const processOutput = createProcessOutput(stream, { name: "p" });

    for (let i = 0; i < 5; i++) stream.push(new Uint8Array(10).fill(i));
    stream.close();
    await flushMicrotasks();

    const chunks: Uint8Array[] = [];
    for await (const { chunk, droppedBytesBefore } of processOutput.bytes()) {
      chunks.push(chunk);
      expect(droppedBytesBefore ?? 0).toBe(0);
    }

    expect(chunks.length).toBe(5);
    expect(processOutput.droppedBytes).toBe(0);
  });

  test("bounded buffer drops oldest, keeps tail, annotates the gap inline", async () => {
    const stream = createAsyncIterableQueue<Uint8Array<ArrayBufferLike>>();
    // cap 25, five 10-byte chunks numbered 0..4. Draining pushes them all in;
    // eviction keeps the two most-recent (chunks 3 and 4), dropping 30 bytes.
    const processOutput = createProcessOutput(stream, { name: "p" }, 25);

    for (let i = 0; i < 5; i++) stream.push(new Uint8Array(10).fill(i));
    stream.close();
    await flushMicrotasks();

    const chunks: { chunk: Uint8Array; droppedBytesBefore?: number }[] = [];
    for await (const { chunk, droppedBytesBefore } of processOutput.bytes()) {
      chunks.push({ chunk, droppedBytesBefore });
    }

    // Retained tail: chunks 3 and 4.
    expect(chunks.map(({ chunk }) => chunk[0])).toEqual([3, 4]);
    // The gap (chunks 0,1,2 = 30 bytes) is annotated before the first retained chunk.
    expect(chunks[0].droppedBytesBefore).toBe(30);
    expect(chunks[1].droppedBytesBefore ?? 0).toBe(0);
    expect(processOutput.droppedBytes).toBe(30);
  });

  test("bounded buffer conserves bytes: retained + dropped == produced", async () => {
    const stream = createAsyncIterableQueue<Uint8Array<ArrayBufferLike>>();
    const processOutput = createProcessOutput(stream, { name: "p" }, 25);

    const produced = 5 * 10;
    for (let i = 0; i < 5; i++) stream.push(new Uint8Array(10).fill(i));
    stream.close();
    await flushMicrotasks();

    let retained = 0;
    for await (const { chunk } of processOutput.bytes())
      retained += chunk.length;

    expect(retained + processOutput.droppedBytes).toBe(produced);
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
