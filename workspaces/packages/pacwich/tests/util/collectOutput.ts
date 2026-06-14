import type { OutputStreamName } from "../../src/runScript";

/** A drained stdout chunk: its trimmed text plus the producing script's metadata. */
export type CollectedChunk<Metadata extends object> = {
  text: string;
  metadata: Metadata;
};

/**
 * Drain an `output.text()` stream into an array of trimmed, non-empty
 * stdout chunks (stderr and whitespace-only chunks are dropped).
 *
 * Use this instead of asserting inside a `for await` loop. A bare
 * `for await (...) { expect(...) }` makes no assertion at all when the
 * stream yields zero chunks, so a silently-empty stream passes
 * vacuously. Collecting first lets the caller assert on the whole array
 * (`toEqual` / `toContainEqual` / `toHaveLength`), which fails loudly if
 * nothing was produced.
 */
export const collectStdout = async <
  Metadata extends { streamName: OutputStreamName },
>(output: {
  text(): AsyncIterable<{ metadata: Metadata; chunk: string }>;
}): Promise<CollectedChunk<Metadata>[]> => {
  const chunks: CollectedChunk<Metadata>[] = [];
  for await (const { metadata, chunk } of output.text()) {
    const text = chunk.trim();
    if (!text || metadata.streamName !== "stdout") continue;
    chunks.push({ text, metadata });
  }
  return chunks;
};
