import { createAsyncIterableQueue } from "../../../src/internal/core";
import { describe, test, expect } from "../../util/testFramework";

const flushMicrotasks = async (count = 5) => {
  for (let i = 0; i < count; i++) {
    await Promise.resolve();
  }
};

/** Drain a queue that has already been closed into an array. */
const drain = async <T>(queue: AsyncIterable<T>): Promise<T[]> => {
  const out: T[] = [];
  for await (const item of queue) out.push(item);
  return out;
};

const measureBytes = (item: Uint8Array) => item.byteLength;
const bytesOf = (n: number) => new Uint8Array(n);

describe("createAsyncIterableQueue (unbounded, default)", () => {
  test("empty queue closes with no items", async () => {
    const queue = createAsyncIterableQueue<number>();
    queue.close();
    expect(await drain(queue)).toEqual([]);
    expect(queue.droppedBytes).toBe(0);
  });

  test("single item", async () => {
    const queue = createAsyncIterableQueue<number>();
    queue.push(1);
    queue.close();
    expect(await drain(queue)).toEqual([1]);
  });

  test("multiple items preserve order", async () => {
    const queue = createAsyncIterableQueue<number>();
    queue.push(1);
    queue.push(2);
    queue.push(3);
    queue.close();
    expect(await drain(queue)).toEqual([1, 2, 3]);
  });

  test("never drops even with large backlog", async () => {
    const queue = createAsyncIterableQueue<Uint8Array>();
    for (let i = 0; i < 100; i++) queue.push(bytesOf(1024));
    queue.close();
    const items = await drain(queue);
    expect(items.length).toBe(100);
    expect(queue.droppedBytes).toBe(0);
  });

  test("push after close is ignored", async () => {
    const queue = createAsyncIterableQueue<number>();
    queue.close();
    queue.push(1);
    expect(await drain(queue)).toEqual([]);
  });
});

describe("createAsyncIterableQueue (bounded)", () => {
  test("throws when maxBufferedBytes set without measureItem", () => {
    expect(() =>
      createAsyncIterableQueue<Uint8Array>({ maxBufferedBytes: 10 }),
    ).toThrow(/measureItem/);
  });

  test("retains everything when under the cap", async () => {
    const queue = createAsyncIterableQueue<Uint8Array>({
      maxBufferedBytes: 100,
      measureItem: measureBytes,
    });
    queue.push(bytesOf(10));
    queue.push(bytesOf(20));
    queue.close();
    const items = await drain(queue);
    expect(items.map((i) => i.byteLength)).toEqual([10, 20]);
    expect(queue.droppedBytes).toBe(0);
  });

  test("retains everything exactly at the cap", async () => {
    const queue = createAsyncIterableQueue<Uint8Array>({
      maxBufferedBytes: 30,
      measureItem: measureBytes,
    });
    queue.push(bytesOf(10));
    queue.push(bytesOf(20));
    queue.close();
    const items = await drain(queue);
    expect(items.map((i) => i.byteLength)).toEqual([10, 20]);
    expect(queue.droppedBytes).toBe(0);
  });

  test("drops oldest buffered items, keeps the tail", async () => {
    const queue = createAsyncIterableQueue<Uint8Array>({
      maxBufferedBytes: 30,
      measureItem: measureBytes,
    });
    // 4 x 10 bytes, cap 30 -> the first (oldest) is evicted.
    queue.push(bytesOf(10));
    queue.push(bytesOf(10));
    queue.push(bytesOf(10));
    queue.push(bytesOf(10));
    queue.close();
    const items = await drain(queue);
    expect(items.length).toBe(3);
    expect(queue.droppedBytes).toBe(10);
  });

  test("drops multiple oldest items to fit a larger incoming item", async () => {
    const queue = createAsyncIterableQueue<Uint8Array>({
      maxBufferedBytes: 30,
      measureItem: measureBytes,
    });
    queue.push(bytesOf(10));
    queue.push(bytesOf(10));
    queue.push(bytesOf(10)); // buffered = 30
    queue.push(bytesOf(25)); // needs buffered <= 5, so all three 10s are evicted
    queue.close();
    const items = await drain(queue);
    expect(items.map((i) => i.byteLength)).toEqual([25]);
    expect(queue.droppedBytes).toBe(30);
  });

  test("drops only as many oldest items as needed", async () => {
    const queue = createAsyncIterableQueue<Uint8Array>({
      maxBufferedBytes: 30,
      measureItem: measureBytes,
    });
    queue.push(bytesOf(10));
    queue.push(bytesOf(10));
    queue.push(bytesOf(10)); // buffered = 30
    queue.push(bytesOf(10)); // evict just one oldest to fit
    queue.close();
    const items = await drain(queue);
    expect(items.map((i) => i.byteLength)).toEqual([10, 10, 10]);
    expect(queue.droppedBytes).toBe(10);
  });

  test("a single item larger than the cap is retained (soft bound)", async () => {
    const queue = createAsyncIterableQueue<Uint8Array>({
      maxBufferedBytes: 10,
      measureItem: measureBytes,
    });
    queue.push(bytesOf(100));
    queue.close();
    const items = await drain(queue);
    expect(items.map((i) => i.byteLength)).toEqual([100]);
    expect(queue.droppedBytes).toBe(0);
  });

  test("oversized item then a normal push evicts the oversized one", async () => {
    const queue = createAsyncIterableQueue<Uint8Array>({
      maxBufferedBytes: 10,
      measureItem: measureBytes,
    });
    queue.push(bytesOf(100));
    queue.push(bytesOf(5));
    queue.close();
    const items = await drain(queue);
    expect(items.map((i) => i.byteLength)).toEqual([5]);
    expect(queue.droppedBytes).toBe(100);
  });

  test("no drops when a consumer keeps up (direct handoff)", async () => {
    const queue = createAsyncIterableQueue<Uint8Array>({
      maxBufferedBytes: 10,
      measureItem: measureBytes,
    });
    const received: number[] = [];
    const consumer = (async () => {
      for await (const item of queue) received.push(item.byteLength);
    })();

    // Give the consumer a chance to park on next().
    await flushMicrotasks();
    // Each push hands off directly to the waiting consumer, so nothing buffers.
    queue.push(bytesOf(100));
    await flushMicrotasks();
    queue.push(bytesOf(100));
    await flushMicrotasks();
    queue.close();
    await consumer;

    expect(received).toEqual([100, 100]);
    expect(queue.droppedBytes).toBe(0);
  });

  test("close marker is never dropped", async () => {
    const queue = createAsyncIterableQueue<Uint8Array>({
      maxBufferedBytes: 10,
      measureItem: measureBytes,
    });
    queue.push(bytesOf(10));
    queue.close();
    queue.push(bytesOf(10)); // ignored after close
    const items = await drain(queue);
    expect(items.length).toBe(1);
  });
});
