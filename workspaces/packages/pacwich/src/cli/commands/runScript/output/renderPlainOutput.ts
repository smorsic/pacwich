import { stripANSI } from "../../../../internal/core";
import type {
  RunScriptAcrossWorkspacesOutput,
  RunWorkspaceScriptMetadata,
} from "../../../../project";
import type { OutputStreamName } from "../../../../runScript";
import type { WriteOutputOptions } from "../../../createCli";
import { formatDroppedOutputNotice } from "./droppedOutputNotice";
import { sanitizeChunk } from "./sanitizeChunk";

/** The metadata tagging each chunk/event of a grouped run's merged output. */
type GroupedOutputMetadata = RunWorkspaceScriptMetadata & {
  streamName: OutputStreamName;
};

export type RenderPlainOutputOptions = {
  stripDisruptiveControls?: boolean;
  prefix?: boolean;
};

/**
 * Splits a sanitized chunk into complete formatted lines, keeping the trailing
 * incomplete line in `buffers[workspaceName]` until a later chunk completes it
 * (or {@link flushChunkLineBuffer} emits it when the stream ends). Mutates
 * `buffers`. Shared by the plain/prefixed and grouped line generators so all
 * three styles buffer at identical line granularity.
 *
 * Only completed lines are yielded: the final `split("\n")` segment is always
 * the incomplete trailing line (or `""` when `content` ended in a newline), so
 * it is held back rather than emitted. Emitting it here too would re-yield the
 * same partial line on every subsequent chunk (duplicating output, and going
 * quadratic for a long stream with no newlines).
 */
function* bufferChunkLines(
  chunk: string,
  workspaceName: string,
  buffers: Record<string, string>,
  formatLine: (line: string) => string,
): Generator<string> {
  const content = (buffers[workspaceName] ?? "") + chunk;
  const lines = content.split("\n");

  for (const line of lines.slice(0, -1)) {
    if (line) yield formatLine(line);
  }

  buffers[workspaceName] = lines[lines.length - 1] ?? "";
}

/**
 * Emit any held-back trailing line for `workspaceName` (output that ended
 * without a final newline) and clear it. Call when a stream is fully drained
 * so the last unterminated line is not lost.
 */
function* flushChunkLineBuffer(
  workspaceName: string,
  buffers: Record<string, string>,
  formatLine: (line: string) => string,
): Generator<string> {
  const remainder = buffers[workspaceName];
  if (remainder) {
    buffers[workspaceName] = "";
    yield formatLine(remainder);
  }
}

export async function* generatePlainOutputLines(
  output: RunScriptAcrossWorkspacesOutput,
  { stripDisruptiveControls = true, prefix = false }: RenderPlainOutputOptions,
) {
  const workspaceLineBuffers: Record<string, string> = {};
  const workspaceMetadata: Record<string, GroupedOutputMetadata> = {};

  const formatLine = (workspaceName: string, line: string) =>
    `\x1b[0m${prefix ? `[${stripANSI(workspaceName)}] ${line}` : line}`;

  for await (const { metadata, chunk, droppedBytesBefore } of output.text()) {
    const workspaceName = metadata.workspace.name;
    workspaceMetadata[workspaceName] = metadata;

    if (droppedBytesBefore) {
      // Output was dropped here: the buffered partial line is no longer
      // contiguous with what follows, so clear it (don't glue across the gap)
      // and note the drop inline before the retained output resumes.
      workspaceLineBuffers[workspaceName] = "";
      yield {
        line: formatLine(
          workspaceName,
          formatDroppedOutputNotice(droppedBytesBefore),
        ),
        metadata,
      };
    }

    const sanitizedChunk = sanitizeChunk(chunk, stripDisruptiveControls);

    for (const line of bufferChunkLines(
      sanitizedChunk,
      workspaceName,
      workspaceLineBuffers,
      (line) => formatLine(workspaceName, line),
    )) {
      yield { line, metadata };
    }
  }

  // Flush trailing lines for any workspace whose output ended without a final
  // newline, so the last line is not dropped.
  for (const workspaceName of Object.keys(workspaceLineBuffers)) {
    for (const line of flushChunkLineBuffer(
      workspaceName,
      workspaceLineBuffers,
      (line) => formatLine(workspaceName, line),
    )) {
      yield { line, metadata: workspaceMetadata[workspaceName] };
    }
  }
}

/**
 * An event from {@link generateGroupedOutputLines}: a complete `line` of a
 * workspace's output, or an `end` marker for one of a workspace's streams
 * (stdout/stderr) once it is fully drained. The grouped TUI uses `end` to know
 * when a finished workspace's output is complete and can be flushed out of the
 * live view, which the workspace's exit event alone cannot tell it (the exit
 * event can arrive before the tail of the output).
 */
export type GroupedOutputEvent<Metadata extends object = object> =
  | { type: "line"; line: string; metadata: Metadata }
  | { type: "end"; metadata: Metadata };

/**
 * Like {@link generatePlainOutputLines} (always unprefixed), but consumes the
 * completion-aware stream so it can additionally yield a per-stream `end`
 * marker. A workspace's output is fully drained once both its `stdout` and
 * `stderr` streams have ended.
 */
export async function* generateGroupedOutputLines(
  output: RunScriptAcrossWorkspacesOutput,
  { stripDisruptiveControls = true }: { stripDisruptiveControls?: boolean },
): AsyncGenerator<GroupedOutputEvent<GroupedOutputMetadata>> {
  const workspaceLineBuffers: Record<string, string> = {};

  const formatLine = (line: string) => `\x1b[0m${line}`;

  for await (const event of output.textWithCompletion()) {
    const workspaceName = event.metadata.workspace.name;

    if (event.type === "end") {
      // Flush any held-back trailing line before signaling the stream drained,
      // so output without a final newline is not lost.
      for (const line of flushChunkLineBuffer(
        workspaceName,
        workspaceLineBuffers,
        formatLine,
      )) {
        yield { type: "line", line, metadata: event.metadata };
      }
      yield { type: "end", metadata: event.metadata };
      continue;
    }

    if (event.droppedBytesBefore) {
      workspaceLineBuffers[workspaceName] = "";
      yield {
        type: "line",
        line: formatLine(formatDroppedOutputNotice(event.droppedBytesBefore)),
        metadata: event.metadata,
      };
    }

    const sanitizedChunk = sanitizeChunk(event.chunk, stripDisruptiveControls);

    for (const line of bufferChunkLines(
      sanitizedChunk,
      workspaceName,
      workspaceLineBuffers,
      formatLine,
    )) {
      yield { type: "line", line, metadata: event.metadata };
    }
  }
}

export const renderPlainOutput = async (
  output: RunScriptAcrossWorkspacesOutput,
  outputWriters: Required<WriteOutputOptions>,
  { stripDisruptiveControls = true, prefix = false }: RenderPlainOutputOptions,
) => {
  for await (const { line, metadata } of generatePlainOutputLines(output, {
    stripDisruptiveControls,
    prefix,
  })) {
    outputWriters[metadata.streamName](line + "\n");
  }
};
