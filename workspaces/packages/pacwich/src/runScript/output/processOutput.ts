import {
  PacwichError,
  type AsyncIterableQueue,
  type SimpleAsyncIterable,
  createAsyncIterableQueue,
  defineErrors,
} from "../../internal/core";

export type ByteStream = SimpleAsyncIterable<Uint8Array<ArrayBufferLike>>;

/** A single chunk of a script's output stream, tagged with the producing script's metadata. */
export type ProcessOutputChunk<
  Chunk = unknown,
  Metadata extends object = object,
> = {
  /** The metadata for the script that produced the output chunk */
  metadata: Metadata;
  /** The output chunk */
  chunk: Chunk;
  /**
   * Bytes dropped from the in-memory buffer immediately before this chunk,
   * because retained output exceeded the configured output buffer cap.
   * Absent (or `0`) when no output was dropped before this chunk. Consumers
   * can render an inline truncation marker when present.
   */
  droppedBytesBefore?: number;
};

export type ByteChunk<Metadata extends object = object> = ProcessOutputChunk<
  Uint8Array<ArrayBufferLike>,
  Metadata
>;

export type TextChunk<Metadata extends object = object> = ProcessOutputChunk<
  string,
  Metadata
>;

export type BytesOutput<Metadata extends object = object> = SimpleAsyncIterable<
  ByteChunk<Metadata>
>;

export type TextOutput<Metadata extends object = object> = SimpleAsyncIterable<
  TextChunk<Metadata>
>;

export interface ProcessOutput<Metadata extends object = object> {
  /** The metadata tagging every chunk this process produces. */
  readonly metadata: Metadata;
  /**
   * Cumulative bytes dropped from this process's output buffer to stay within
   * the configured cap. Always `0` for an unbounded buffer.
   */
  readonly droppedBytes: number;
  bytes(): BytesOutput<Metadata>;
  text(): TextOutput<Metadata>;
}

const ERRORS = defineErrors(PacwichError, "OutputStreamStarted");

class _ProcessOutput<
  Metadata extends object = object,
> implements ProcessOutput<Metadata> {
  constructor(
    stream: ByteStream,
    metadata: Metadata,
    maxBufferedBytes?: number,
  ) {
    this.#inputStream = stream;
    this.#metadata = metadata;
    this.#byteChunkQueue =
      maxBufferedBytes !== undefined && Number.isFinite(maxBufferedBytes)
        ? createAsyncIterableQueue<Uint8Array<ArrayBufferLike>>({
            maxBufferedBytes,
            measureItem: (chunk) => chunk.byteLength,
          })
        : createAsyncIterableQueue<Uint8Array<ArrayBufferLike>>();

    this.#done = new Promise((resolve, reject) => {
      this.#onDone = (error) => {
        if (this.#isDone) return;
        this.#isDone = true;
        this.#byteChunkQueue.close();
        this.#onDone = null;

        if (!this.isCancelled && error) {
          reject(error);
        } else {
          resolve();
        }
      };
    });

    (async () => {
      // Drain the stream immediately to prevent pipe buffer overflow from subprocesses,
      // the queue acting as a() forwarded async iterable in a way.
      try {
        for await (const chunk of stream) {
          if (this.#isCancelled) break;
          this.#byteChunkQueue.push(chunk.slice());
        }
      } catch (error) {
        this.#error = error as Error;
      } finally {
        this.#onDone?.(this.#error);
      }
    })();
  }

  get metadata(): Metadata {
    return this.#metadata;
  }

  get done(): Promise<void> {
    return this.#done;
  }

  get isCancelled(): boolean {
    return this.#isCancelled;
  }

  get droppedBytes(): number {
    return this.#byteChunkQueue.droppedBytes;
  }

  bytes(): BytesOutput<Metadata> {
    this.#onStart();

    const metadata = this.#metadata;
    const byteChunkQueue = this.#byteChunkQueue;

    return (async function* () {
      let lastDropped = 0;
      for await (const chunk of byteChunkQueue) {
        const droppedBytesBefore = byteChunkQueue.droppedBytes - lastDropped;
        lastDropped = byteChunkQueue.droppedBytes;
        yield droppedBytesBefore > 0
          ? { metadata, chunk, droppedBytesBefore }
          : { metadata, chunk };
      }
    })();
  }

  text(): TextOutput<Metadata> {
    this.#onStart();

    const metadata = this.#metadata;
    const byteChunkQueue = this.#byteChunkQueue;

    return (async function* () {
      const decoder = new TextDecoder();
      let lastDropped = 0;
      for await (const byteChunk of byteChunkQueue) {
        const droppedBytesBefore = byteChunkQueue.droppedBytes - lastDropped;
        lastDropped = byteChunkQueue.droppedBytes;
        const chunk = decoder.decode(byteChunk, { stream: true });
        yield droppedBytesBefore > 0
          ? { metadata, chunk, droppedBytesBefore }
          : { metadata, chunk };
      }

      // flush any remaining data in the decoder
      const danglingChunk = decoder.decode();
      if (danglingChunk) yield { metadata, chunk: danglingChunk };
    })();
  }

  async cancel(reason?: unknown) {
    this.#isCancelled = true;
    this.#onDone?.();
    await (this.#inputStream as ReadableStream).cancel?.(reason);
  }

  get isDone(): boolean {
    return this.#isDone;
  }

  get error(): Error | null {
    return this.#error;
  }

  #onStart(): void {
    if (this.#isStarted) {
      throw new ERRORS.OutputStreamStarted(
        "Only one stream can be opened via .bytes() or .text(). This stream has already been opened.",
      );
    }
    this.#isStarted = true;
  }

  #isStarted = false;
  #done: Promise<void>;
  #error: Error | null = null;
  #onDone: ((error?: Error | null) => void) | null = null;
  #isDone = false;
  #isCancelled = false;
  #inputStream: ByteStream;
  #byteChunkQueue!: AsyncIterableQueue<Uint8Array<ArrayBufferLike>>;
  #metadata: Metadata;
}

export const createProcessOutput = <Metadata extends object = object>(
  stream: ByteStream,
  metadata: Metadata,
  maxBufferedBytes?: number,
): ProcessOutput<Metadata> =>
  new _ProcessOutput(stream, metadata, maxBufferedBytes);
