import { type WorkspacePatternTarget } from "@pacwich/common/workspaces";
import { Link } from "@rspress/core/theme-original";
import { SyntaxHighlighter } from "../util/highlight";

export const WORKSPACE_PATTERN_CONTENT: Record<
  WorkspacePatternTarget,
  {
    title: string;
    description: React.ReactNode;
    cliExamples: string[];
  }
> = {
  name: {
    title: "Name",
    description:
      "Match by the workspace name (from package.json). Accepts wildcards.",
    cliExamples: [
      'pacwich ls name:my-workspace "name:my-workspace-*"',
      `pacwich run lint "name:my-workspace-*"`,
    ],
  },
  alias: {
    title: "Alias",
    description: (
      <span>
        Match by the{" "}
        <Link href="/concepts/workspace-aliases" className="inline-link">
          workspace alias
        </Link>
        . Accepts wildcards.
      </span>
    ),
    cliExamples: [
      'pacwich ls "alias:my-alias-*"',
      `pacwich run lint "alias:my-alias-b"`,
    ],
  },
  path: {
    title: "Path",
    description:
      "Match by the relative workspace path, with glob syntax supported.",
    cliExamples: [
      'pacwich ls "path:packages/**/*"',
      `pacwich run lint "path:packages/**/*"`,
    ],
  },
  tag: {
    title: "Tag",
    description: (
      <span>
        Match workspaces that have the given{" "}
        <Link href="/config/workspace#tags" className="inline-link">
          tag
        </Link>
        . Tags are defined in a workspace's{" "}
        <Link href="/config/workspace" className="inline-link">
          configuration file
        </Link>
        .
      </span>
    ),
    cliExamples: [
      'pacwich ls "tag:my-tag"',
      `pacwich run lint "tag:my-tag-pattern-*"`,
    ],
  },
};

export const WORKSPACE_PATTERN_API_EXAMPLE = `
import { createFileSystemProject } from "pacwich";

const project = createFileSystemProject();

project.findWorkspacesByPattern(
  "my-name-or-alias",
  "name:my-workspace-*", 
  "alias:my-alias-*", 
  "path:packages/**/*",
  "tag:my-tag",
);

project.runScriptAcrossWorkspaces({
  workspacePatterns: [
    "my-name-or-alias",
    "name:my-workspace-*",
    "alias:my-alias-*",
    "path:packages/**/*",
    "tag:my-tag",
  ],
  script: "lint",
});
`.trim();

export const WorkspacePatternDoc = ({
  target,
}: {
  target: WorkspacePatternTarget;
}) => {
  return (
    <div className="workspace-pattern-doc">
      <p>{WORKSPACE_PATTERN_CONTENT[target].description}</p>
      <SyntaxHighlighter language="bash">
        {WORKSPACE_PATTERN_CONTENT[target].cliExamples.join("\n")}
      </SyntaxHighlighter>
    </div>
  );
};
