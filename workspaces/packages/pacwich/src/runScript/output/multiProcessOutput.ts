import {
  mergeAsyncIterables,
  type SimpleAsyncIterable,
} from "../../internal/core";
import {
  type ProcessOutput,
  type BytesOutput,
  type TextChunk,
  type TextOutput,
} from "./processOutput";

/**
 * A text event from {@link MultiProcessOutput.textWithCompletion}: either a
 * decoded chunk, or an `end` marker emitted when one underlying process's
 * stream is fully drained. The `end` marker is produced in-band as that
 * process's iterator completes, so it is guaranteed to follow all of that
 * process's `chunk` events.
 */
export type TextStreamEvent<Metadata extends object = object> =
  | {
      type: "chunk";
      metadata: Metadata;
      chunk: string;
      /**
       * Bytes dropped from the buffer immediately before this chunk (output
       * buffer cap). Absent/`0` when no output was dropped before it.
       */
      droppedBytesBefore?: number;
    }
  | {
      type: "end";
      metadata: Metadata;
      /** Cumulative bytes this process dropped to stay within the buffer cap. */
      droppedBytes: number;
    };

export type TextCompletionOutput<Metadata extends object = object> =
  SimpleAsyncIterable<TextStreamEvent<Metadata>>;

/**
 * The merged output of one or more script processes. Open exactly one
 * stream via `bytes()`, `text()`, or `textWithCompletion()` and consume it
 * with `for await`.
 */
export interface MultiProcessOutput<Metadata extends object = object> {
  bytes(): BytesOutput<Metadata>;
  text(): TextOutput<Metadata>;
  /**
   * Like {@link text}, but additionally yields an `end` event for each
   * underlying process the moment its stream is fully drained. Consumers that
   * need a reliable per-process "no more output" signal (e.g. the grouped TUI
   * deciding when a finished workspace can leave the live view) must use this
   * rather than the process's exit event, which can race ahead of the tail of
   * its output.
   */
  textWithCompletion(): TextCompletionOutput<Metadata>;
}

class _MultiProcessOutput<
  Metadata extends object = object,
> implements MultiProcessOutput<Metadata> {
  constructor(private readonly processes: ProcessOutput<Metadata>[]) {}

  bytes(): BytesOutput<Metadata> {
    return mergeAsyncIterables(
      this.processes.map((process) => process.bytes()),
    );
  }

  text(): TextOutput<Metadata> {
    return mergeAsyncIterables(this.processes.map((process) => process.text()));
  }

  textWithCompletion(): TextCompletionOutput<Metadata> {
    const processes = this.processes;
    return {
      // Mirrors `mergeAsyncIterables` but surfaces each iterator's completion
      // as an in-band `end` event instead of silently dropping it. `end`
      // carries the process's own metadata so it is available even for a
      // stream that produced no chunks (e.g. a skipped or silent script).
      async *[Symbol.asyncIterator]() {
        const iterators = processes.map((process) =>
          process.text()[Symbol.asyncIterator](),
        );
        const metadatas = processes.map((process) => process.metadata);

        type NextState = {
          index: number;
          result: IteratorResult<TextChunk<Metadata>>;
        };

        const callNext = (index: number) =>
          iterators[index]
            .next()
            .then((result): NextState => ({ index, result }));

        const nextCalls = iterators.map((_, i) => callNext(i));

        let activeCount = iterators.length;
        while (activeCount > 0) {
          const { index, result } = await Promise.race(nextCalls);
          if (result.done) {
            activeCount--;
            // eslint-disable-next-line @typescript-eslint/no-empty-function
            nextCalls[index] = new Promise<never>(() => {});
            yield {
              type: "end",
              metadata: metadatas[index],
              droppedBytes: processes[index].droppedBytes,
            };
            continue;
          }

          nextCalls[index] = callNext(index);

          yield {
            type: "chunk",
            metadata: result.value.metadata,
            chunk: result.value.chunk,
            droppedBytesBefore: result.value.droppedBytesBefore,
          };
        }
      },
    };
  }
}

export const createMultiProcessOutput = <Metadata extends object = object>(
  processes: ProcessOutput<Metadata>[],
): MultiProcessOutput<Metadata> => new _MultiProcessOutput(processes);
