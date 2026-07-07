import type { SimpleAsyncIterable } from "../types";

export type AsyncQueueItem<T> = { type: "value"; value: T } | { type: "done" };

/** Options controlling the retained-item bound of an async iterable queue. */
export type AsyncIterableQueueOptions<T> = {
  /**
   * Maximum measured size (via {@link AsyncIterableQueueOptions.measureItem})
   * of unconsumed items to retain. When a `push` would exceed this, the oldest
   * buffered items are dropped (their size accumulated into `droppedBytes`)
   * until the incoming item fits. `undefined` or a non-finite value leaves the
   * queue unbounded (the default, zero measurement overhead). Requires
   * `measureItem` when finite.
   *
   * Only buffered (unconsumed) items count. When a consumer keeps up, items
   * hand off directly and never accumulate, so nothing is ever dropped.
   */
  maxBufferedBytes?: number;
  /** Measures a single item's contribution to the buffered-byte total. */
  measureItem?: (item: T) => number;
};

/** An async iterable that can be pushed to, closed, and (optionally) size-bounded. */
export type AsyncIterableQueue<T> = SimpleAsyncIterable<T> & {
  push: (value: T) => void;
  close: () => void;
  closed: Promise<void>;
  /**
   * Cumulative measured size of items dropped to stay within
   * `maxBufferedBytes`. Always `0` for an unbounded queue.
   */
  readonly droppedBytes: number;
};

export const createAsyncIterableQueue = <T>(
  options: AsyncIterableQueueOptions<T> = {},
): AsyncIterableQueue<T> => {
  const { maxBufferedBytes, measureItem } = options;
  const isBounded =
    maxBufferedBytes !== undefined && Number.isFinite(maxBufferedBytes);

  if (isBounded && !measureItem) {
    throw new Error(
      "createAsyncIterableQueue requires a `measureItem` function when `maxBufferedBytes` is set.",
    );
  }

  const measure = measureItem ?? (() => 0);

  let resolveClose: () => void = () => {
    void 0;
  };
  const closePromise = new Promise<void>((resolve) => {
    resolveClose = resolve;
  });
  let pendingResolveIdle: ((value: IteratorResult<T>) => void) | null = null;
  const items: AsyncQueueItem<T>[] = [];
  let isDone = false;
  let bufferedBytes = 0;
  let droppedBytes = 0;

  const push = (value: T) => {
    if (isDone) return;
    if (pendingResolveIdle) {
      const resolveIdle = pendingResolveIdle;
      pendingResolveIdle = null;
      resolveIdle({ value, done: false });
      return;
    }

    if (isBounded) {
      const size = measure(value);
      // Evict oldest buffered values until the incoming item fits. A single
      // item larger than the whole cap is still retained (soft bound), then
      // evicted by the next push.
      while (
        bufferedBytes + size > maxBufferedBytes! &&
        items.length > 0 &&
        items[0].type === "value"
      ) {
        const evicted = items.shift() as { type: "value"; value: T };
        const evictedSize = measure(evicted.value);
        bufferedBytes -= evictedSize;
        droppedBytes += evictedSize;
      }
      items.push({ type: "value", value });
      bufferedBytes += size;
      return;
    }

    items.push({ type: "value", value });
  };

  const close = () => {
    if (isDone) return;
    isDone = true;
    if (pendingResolveIdle) {
      const resolveIdle = pendingResolveIdle;
      pendingResolveIdle = null;
      resolveIdle({ value: undefined as unknown as T, done: true });
    } else {
      items.push({ type: "done" });
    }
    resolveClose();
  };

  const asyncIterator: AsyncIterator<T> = {
    next: () => {
      if (items.length > 0) {
        const item = items.shift()!;
        if (item.type === "done") {
          isDone = true;
          return Promise.resolve({
            value: undefined as unknown as T,
            done: true,
          });
        }
        if (isBounded) bufferedBytes -= measure(item.value);
        return Promise.resolve({ value: item.value, done: false });
      }

      if (isDone) {
        return Promise.resolve({
          value: undefined,
          done: true,
        });
      }

      return new Promise<IteratorResult<T>>((resolve) => {
        pendingResolveIdle = resolve;
      });
    },
  };

  const iterator: AsyncIterableQueue<T> = {
    [Symbol.asyncIterator]: () => asyncIterator,
    push,
    close,
    closed: closePromise,
    get droppedBytes() {
      return droppedBytes;
    },
  };

  return iterator;
};
