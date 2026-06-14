import { Link } from "@rspress/core/theme-original";
const LINKS = {
  glossary: "/concepts/glossary",
  workspaceAliases: "/concepts/workspace-aliases",
  workspacePatterns: "/concepts/workspace-patterns",
  workspaceDependencies: "/concepts/workspace-dependencies",
  parallelScripts: "/concepts/parallel-scripts",
  rootWorkspace: "/concepts/root-workspace",
  workspaceScriptMetadata: "/concepts/workspace-script-metadata",
  scriptExecutionOrder: "/concepts/script-execution-order",
  inlineScripts: "/concepts/inline-scripts",
} as const;

export interface ConceptsHeaderProps {
  activeHref: keyof typeof LINKS | "home";
  divider?: boolean;
}

export const ConceptsHeader = ({
  activeHref,
  divider,
}: ConceptsHeaderProps) => {
  return (
    <div className="sub-header">
      <div className="sub-header-links">
        <Link
          href={LINKS.glossary}
          className={activeHref === "glossary" ? "active" : ""}
        >
          Glossary
        </Link>
        <Link
          href={LINKS.workspaceAliases}
          className={activeHref === "workspaceAliases" ? "active" : ""}
        >
          Workspace Aliases
        </Link>
        <Link
          href={LINKS.workspacePatterns}
          className={activeHref === "workspacePatterns" ? "active" : ""}
        >
          Workspace Patterns
        </Link>
        <Link
          href={LINKS.workspaceDependencies}
          className={activeHref === "workspaceDependencies" ? "active" : ""}
        >
          Workspace Dependencies
        </Link>
        <Link
          href={LINKS.rootWorkspace}
          className={activeHref === "rootWorkspace" ? "active" : ""}
        >
          Root Workspace
        </Link>
        <Link
          href={LINKS.inlineScripts}
          className={activeHref === "inlineScripts" ? "active" : ""}
        >
          Inline Scripts
        </Link>
        <Link
          href={LINKS.parallelScripts}
          className={activeHref === "parallelScripts" ? "active" : ""}
        >
          Parallel Scripts
        </Link>
        <Link
          href={LINKS.workspaceScriptMetadata}
          className={activeHref === "workspaceScriptMetadata" ? "active" : ""}
        >
          Workspace Script Metadata
        </Link>
        <Link
          href={LINKS.scriptExecutionOrder}
          className={activeHref === "scriptExecutionOrder" ? "active" : ""}
        >
          Script Execution Order
        </Link>
      </div>
      {divider && <hr />}
    </div>
  );
};
