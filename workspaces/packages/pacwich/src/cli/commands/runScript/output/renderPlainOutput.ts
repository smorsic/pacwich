import { stripANSI } from "../../../../internal/core";
import type {
  RunScriptAcrossWorkspacesOutput,
  RunWorkspaceScriptMetadata,
} from "../../../../project";
import type { OutputStreamName } from "../../../../runScript";
import type { WriteOutputOptions } from "../../../createCli";
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
 * incomplete line in `buffers[workspaceName]` until a later chunk completes it.
 * Mutates `buffers`. Shared by the plain/prefixed and grouped line generators
 * so all three styles buffer at identical line granularity.
 */
function* bufferChunkLines(
  chunk: string,
  workspaceName: string,
  buffers: Record<string, string>,
  formatLine: (line: string) => string,
): Generator<string> {
  const prior = buffers[workspaceName] ?? "";

  const content = prior + chunk;
  const lines = content.split("\n");

  for (const line of lines) {
    if (line) yield formatLine(line);
  }

  buffers[workspaceName] = content.endsWith("\n")
    ? ""
    : (lines[lines.length - 1] ?? "");
}

export async function* generatePlainOutputLines(
  output: RunScriptAcrossWorkspacesOutput,
  { stripDisruptiveControls = true, prefix = false }: RenderPlainOutputOptions,
) {
  const workspaceLineBuffers: Record<string, string> = {};

  for await (const { metadata, chunk } of output.text()) {
    const workspaceName = metadata.workspace.name;
    const sanitizedChunk = sanitizeChunk(chunk, stripDisruptiveControls);

    const formatLine = (line: string) =>
      `\x1b[0m${prefix ? `[${stripANSI(workspaceName)}] ${line}` : line}`;

    for (const line of bufferChunkLines(
      sanitizedChunk,
      workspaceName,
      workspaceLineBuffers,
      formatLine,
    )) {
      yield { line, metadata };
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

  for await (const event of output.textWithCompletion()) {
    if (event.type === "end") {
      yield { type: "end", metadata: event.metadata };
      continue;
    }

    const workspaceName = event.metadata.workspace.name;
    const sanitizedChunk = sanitizeChunk(event.chunk, stripDisruptiveControls);

    const formatLine = (line: string) => `\x1b[0m${line}`;

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
