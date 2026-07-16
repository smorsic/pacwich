/**
 * Single source of truth for pacwich's public AI-doc "slices" and the
 * navigation layer rendered around them. The doc *content* lives in
 * `md/ai/context/*.md` (channel-agnostic); this module holds the per-slice
 * *metadata* (descriptions, roles, reference tokens) plus pure renderers for
 * the channel-specific "read overview first" / "see also" navigation.
 *
 * Consumed by all three split channels:
 * - MCP resources (`src/ai/mcp/resources.ts`, `pacwichMcpServer.ts`)
 * - the `agents/*` split (`scripts/createPublicAgentDocs.ts`)
 * - the skills generator (`src/ai/skills/generateSkills.ts`)
 *
 * The combined `AGENTS.md` is NOT a split channel and gets no footers.
 */

export type DocSliceKey = "overview" | "concepts" | "cli" | "api" | "config";

/** The `md/ai/context/*` basename / `AgentDocFileName` for a slice. */
export type DocSliceSourceName =
  "overview" | "concepts" | "cliExamples" | "apiExamples" | "config";

export interface DocSlice {
  key: DocSliceKey;
  /** Source markdown basename; also the build-time `AgentDocFileName`. */
  sourceName: DocSliceSourceName;
  /** "entry" = the orientation slice recommended first; others are "topic". */
  role: "entry" | "topic";
  title: string;
  /** Shared by the MCP resource description and the skill `description`. */
  description: string;
  /** Skill `when_to_use` trigger text. */
  whenToUse: string;
  mcpUri: string;
  mcpName: string;
  /** Filename within the `agents/` split dir. */
  agentsFileName: string;
  /** Skill name / directory under `.claude/skills/`. */
  skillName: string;
}

export const DOC_SLICES: readonly DocSlice[] = [
  {
    key: "overview",
    sourceName: "overview",
    role: "entry",
    title: "Overview",
    description: "What pacwich is, its domain model, and core concepts.",
    whenToUse:
      "Start here for orientation whenever working in a pacwich monorepo, before the other pacwich-* skills.",
    mcpUri: "pacwich://docs/overview",
    mcpName: "pacwich overview",
    agentsFileName: "OVERVIEW.md",
    skillName: "pacwich-overview",
  },
  {
    key: "concepts",
    sourceName: "concepts",
    role: "topic",
    title: "Concepts",
    description:
      "Workspace patterns, workspace script metadata, and how to run scripts via the CLI.",
    whenToUse:
      "When selecting workspaces by pattern (name/alias/path/tag) or reasoning about scripts and affected resolution.",
    mcpUri: "pacwich://docs/concepts",
    mcpName: "pacwich concepts",
    agentsFileName: "CONCEPTS.md",
    skillName: "pacwich-concepts",
  },
  {
    key: "cli",
    sourceName: "cliExamples",
    role: "topic",
    title: "CLI reference",
    description:
      "Full CLI command reference with examples, including run-script and all global options.",
    whenToUse: "When constructing or debugging pacwich CLI invocations.",
    mcpUri: "pacwich://docs/cli",
    mcpName: "pacwich CLI reference",
    agentsFileName: "CLI.md",
    skillName: "pacwich-cli",
  },
  {
    key: "api",
    sourceName: "apiExamples",
    role: "topic",
    title: "TypeScript API reference",
    description:
      "TypeScript API examples for createFileSystemProject and the Project/Workspace interfaces.",
    whenToUse:
      "When calling the pacwich TypeScript API (createFileSystemProject, Project/Workspace interfaces).",
    mcpUri: "pacwich://docs/api",
    mcpName: "pacwich TypeScript API reference",
    agentsFileName: "API.md",
    skillName: "pacwich-api",
  },
  {
    key: "config",
    sourceName: "config",
    role: "topic",
    title: "Config reference",
    description:
      "Project config (pacwich.project.jsonc) and workspace config (pacwich.workspace.jsonc) schema and options.",
    whenToUse:
      "When authoring or editing pacwich.project.* or pacwich.workspace.* config files.",
    mcpUri: "pacwich://docs/config",
    mcpName: "pacwich config reference",
    agentsFileName: "CONFIG.md",
    skillName: "pacwich-config",
  },
] as const;

export const ENTRY_SLICE: DocSlice =
  DOC_SLICES.find((slice) => slice.role === "entry") ?? DOC_SLICES[0];

export const getDocSlice = (key: DocSliceKey): DocSlice =>
  DOC_SLICES.find((slice) => slice.key === key)!;

const FOOTER_RULE = "\n\n---\n\n";

/** Bullet list of resource URIs for the MCP server instructions. */
export const renderMcpResourceList = (): string =>
  DOC_SLICES.map((slice) => `- ${slice.mcpUri}`).join("\n");

/** "See also" block appended to the MCP overview resource text. */
export const renderMcpOverviewSeeAlso = (): string =>
  FOOTER_RULE +
  "More pacwich docs:\n" +
  DOC_SLICES.filter((slice) => slice.role !== "entry")
    .map((slice) => `- ${slice.mcpUri} — ${slice.description}`)
    .join("\n");

/** Orientation backlink appended to each MCP topic resource text. */
export const renderMcpTopicBacklink = (): string =>
  `${FOOTER_RULE}See ${ENTRY_SLICE.mcpUri} for orientation.`;

/** Pointer block appended to the `agents/` OVERVIEW split file. */
export const renderAgentsOverviewPointer = (): string =>
  FOOTER_RULE +
  "## pacwich docs map\n\n" +
  "This is the overview. For detail, see the sibling files:\n" +
  DOC_SLICES.filter((slice) => slice.role !== "entry")
    .map((slice) => `- ${slice.agentsFileName} — ${slice.description}`)
    .join("\n") +
  "\n\nWhen `@`-linking these from CLAUDE.md, link this file first.";

/** Orientation backlink appended to each `agents/` topic split file. */
export const renderAgentsTopicBacklink = (): string =>
  `${FOOTER_RULE}See ${ENTRY_SLICE.agentsFileName} for orientation.`;

/**
 * Uniform version stamp appended by every channel that emits per-slice or
 * combined doc text (MCP resources, `agents/*` split, both `AGENTS.md` files).
 * Skills carry their own richer stamp (with a re-run hint) emitted by
 * `generateSkills`.
 */
export const renderVersionStamp = (version: string): string =>
  `<!--pacwich v${version}-->`;

/** "See also" footer appended to a generated skill body. */
export const renderSkillSeeAlso = (slice: DocSlice): string => {
  const others = DOC_SLICES.filter((s) => s.skillName !== slice.skillName).map(
    (s) => s.skillName,
  );
  const orientation =
    slice.role === "entry"
      ? ""
      : `\nFor orientation, see the ${ENTRY_SLICE.skillName} skill.`;
  return `${FOOTER_RULE}See also: ${others.join(", ")}.${orientation}`;
};
