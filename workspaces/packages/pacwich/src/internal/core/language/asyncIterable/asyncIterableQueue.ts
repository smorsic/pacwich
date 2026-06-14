import type { SimpleAsyncIterable } from "../types";

export type AsyncQueueItem<T> = { type: "value"; value: T } | { type: "done" };

export const createAsyncIterableQueue = <T>() => {
  let resolveClose: () => void = () => {
    void 0;
  };
  const closePromise = new Promise<void>((resolve) => {
    resolveClose = resolve;
  });
  let pendingResolveIdle: ((value: IteratorResult<T>) => void) | null = null;
  const items: AsyncQueueItem<T>[] = [];
  let isDone = false;

  const push = (value: T) => {
    if (isDone) return;
    if (pendingResolveIdle) {
      const resolveIdle = pendingResolveIdle;
      pendingResolveIdle = null;
      resolveIdle({ value, done: false });
    } else {
      items.push({ type: "value", value });
    }
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

  const iterator: SimpleAsyncIterable<T> & {
    push: (value: T) => void;
    close: () => void;
    closed: Promise<void>;
  } = {
    [Symbol.asyncIterator]: () => asyncIterator,
    push,
    close,
    closed: closePromise,
  };

  return iterator;
};
