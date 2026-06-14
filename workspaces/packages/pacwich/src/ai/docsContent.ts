import type { DocSliceKey } from "@pacwich/common/docs";
import {
  DOC_API,
  DOC_CLI,
  DOC_CONCEPTS,
  DOC_CONFIG,
  DOC_OVERVIEW,
} from "../internal/generated/aiDocs/docs";

/**
 * Maps each public doc slice to its generated content constant. Bridges the
 * channel-agnostic slice registry (`@pacwich/common/docs`) to the build-time
 * generated text in `internal/generated/aiDocs/docs.ts`, so runtime channels
 * (MCP resources, skills generator) resolve slice content by key.
 */
export const DOC_CONTENT_BY_SLICE: Record<DocSliceKey, string> = {
  overview: DOC_OVERVIEW,
  concepts: DOC_CONCEPTS,
  cli: DOC_CLI,
  api: DOC_API,
  config: DOC_CONFIG,
};
