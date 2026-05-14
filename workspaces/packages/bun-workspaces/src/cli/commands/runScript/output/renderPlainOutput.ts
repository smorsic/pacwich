import { sanitizeOutput } from "../../../../internal/core";
import type { RunScriptAcrossWorkspacesOutput } from "../../../../project";
import type { WriteOutputOptions } from "../../../createCli";
import { sanitizeChunk } from "./sanitizeChunk";

export type RenderPlainOutputOptions = {
  stripDisruptiveControls?: boolean;
  prefix?: boolean;
};

export async function* generatePlainOutputLines(
  output: RunScriptAcrossWorkspacesOutput,
  { stripDisruptiveControls = true, prefix = false }: RenderPlainOutputOptions,
) {
  const workspaceLineBuffers: Record<string, string> = {};

  const formatLine = (line: string, workspaceName: string) => {
    const prefixedLine = prefix
      ? `[${sanitizeOutput(workspaceName)}] ${line}`
      : line;
    return `\x1b[0m${prefixedLine}`;
  };

  for await (const { metadata, chunk } of output.text()) {
    const workspaceName = metadata.workspace.name;
    const sanitizedChunk = sanitizeChunk(chunk, stripDisruptiveControls);

    const prior = workspaceLineBuffers[workspaceName] ?? "";

    const content = prior + sanitizedChunk;
    const lines = content.split("\n");

    for (const line of lines) {
      if (line) yield { line: formatLine(line, workspaceName), metadata };
    }

    workspaceLineBuffers[workspaceName] = content.endsWith("\n")
      ? ""
      : (lines[lines.length - 1] ?? "");
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
