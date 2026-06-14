import type { SimpleAsyncIterable } from "../types";

/** Run multiple async iterables in parallel and yield the results in the order they are completed. */
export const mergeAsyncIterables = <T>(
  iterables: SimpleAsyncIterable<T>[],
): SimpleAsyncIterable<T> => ({
  async *[Symbol.asyncIterator]() {
    const iterators = iterables.map((it) => it[Symbol.asyncIterator]());
    type NextState = { index: number; result: IteratorResult<T> };

    const callNext = (index: number) =>
      iterators[index].next().then((result): NextState => ({ index, result }));

    const nextCalls = iterators.map((_, i) => callNext(i));

    let activeCount = iterators.length;
    while (activeCount > 0) {
      const { index, result } = await Promise.race(nextCalls);
      if (result.done) {
        activeCount--;
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        nextCalls[index] = new Promise<never>(() => {});
        continue;
      }

      nextCalls[index] = callNext(index);

      yield result.value;
    }
  },
});
