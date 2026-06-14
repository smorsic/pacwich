import {
  DOC_SLICES,
  renderMcpOverviewSeeAlso,
  renderMcpTopicBacklink,
  renderVersionStamp,
} from "@pacwich/common/docs";
import { PACWICH_VERSION } from "@pacwich/common/version";
import { DOC_CONTENT_BY_SLICE } from "../docsContent";
import type { McpServer, ReadResourceResult } from "./core";

const textResource = (uri: string, text: string): ReadResourceResult => ({
  contents: [{ uri, mimeType: "text/markdown", text }],
});

const versionFooter = "\n\n" + renderVersionStamp(PACWICH_VERSION);

export const registerPacwichResources = (server: McpServer): void => {
  server.registerResource(
    {
      uri: "pacwich://docs/all",
      name: "pacwich all docs",
      description: "All pacwich documentation in one resource.",
      mimeType: "text/markdown",
    },
    (uri) =>
      textResource(
        uri,
        DOC_SLICES.map((slice) => DOC_CONTENT_BY_SLICE[slice.key]).join(
          "\n\n",
        ) + versionFooter,
      ),
  );

  // Per-topic resources are registry-driven so descriptions stay in sync with
  // the skills/agents channels. Split-channel navigation footers are appended
  // here (the combined `docs/all` resource above stays clean).
  for (const slice of DOC_SLICES) {
    server.registerResource(
      {
        uri: slice.mcpUri,
        name: slice.mcpName,
        description: slice.description,
        mimeType: "text/markdown",
      },
      (uri) =>
        textResource(
          uri,
          DOC_CONTENT_BY_SLICE[slice.key] +
            (slice.role === "entry"
              ? renderMcpOverviewSeeAlso()
              : renderMcpTopicBacklink()) +
            versionFooter,
        ),
    );
  }
};
