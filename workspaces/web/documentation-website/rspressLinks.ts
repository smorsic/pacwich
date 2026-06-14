import { type NavItem, type SidebarGroup } from "rspress/core";
import packageJson from "../../packages/bun-workspaces/package.json";
import { TAG_ICONS } from "./tagIcons";

export const DOMAIN = "https://bunworkspaces.com";
export const NPM_PACKAGE_URL = "https://www.npmjs.com/package/bun-workspaces";
export const GITHUB_REPO_URL =
  "https://github.com/smorsic/bun-workspaces_deprecated";
export const BW_BLOG_URL = "https://smorsic.io/blog";
export const CHANGELOG_URL = `${GITHUB_REPO_URL}/releases`;
export const LICENSE_URL = GITHUB_REPO_URL + "/blob/main/LICENSE.md";

export const HEADER_NAV_LINKS: NavItem[] = [
  {
    text: "CLI",
    link: "/cli",
    position: "left",
    activeMatch: "/cli|web-cli",
    tag: TAG_ICONS.cli,
    items: [
      {
        text: "Quick Start",
        link: "/cli",
        activeMatch: "/cli$",
      },
      {
        text: "Global Options",
        link: "/cli/global-options",
      },
      {
        text: "Commands",
        link: "/cli/commands",
      },
    ],
  },
  {
    text: "API",
    link: "/api",
    position: "left",
    activeMatch: "/api",
    tag: TAG_ICONS.api,
    items: [
      {
        text: "Quick Start",
        link: "/api",
        activeMatch: "/api$",
      },
      {
        text: "Reference",
        link: "/api/reference",
      },
    ],
  },
  {
    text: "Config",
    link: "/config",
    position: "left",
    activeMatch: "/config",
    tag: TAG_ICONS.config,
    items: [
      {
        text: "Overview",
        link: "/config",
        activeMatch: "/config$",
      },
      {
        text: "Project Root Configuration",
        link: "/config/root",
      },
      {
        text: "Workspace Configuration",
        link: "/config/workspace",
      },
      {
        text: "Workspace Pattern Configs",
        link: "/config/workspace-pattern-configs",
      },
      {
        text: "Inputs",
        link: "/config/workspace-inputs",
      },
      {
        text: "Environment Variables",
        link: "/config/env-vars",
      },
    ],
  },
  {
    text: "Concepts",
    link: "/concepts/glossary",
    position: "left",
    activeMatch: "/concepts",
    tag: TAG_ICONS.concepts,
    items: [
      {
        text: "Glossary",
        link: "/concepts/glossary",
      },
      {
        text: "Workspace Aliases",
        link: "/concepts/workspace-aliases",
      },
      {
        text: "Workspace Patterns",
        link: "/concepts/workspace-patterns",
      },
      {
        text: "Workspace Dependencies",
        link: "/concepts/workspace-dependencies",
      },
      {
        text: "Root Workspace",
        link: "/concepts/root-workspace",
      },
      {
        text: "Affected Workspaces",
        link: "/concepts/affected",
      },
      {
        text: "Inline Scripts",
        link: "/concepts/inline-scripts",
      },
      {
        text: "Parallel Scripts",
        link: "/concepts/parallel-scripts",
      },
      {
        text: "Workspace Script Metadata",
        link: "/concepts/workspace-script-metadata",
      },
      {
        text: "Script Execution Order",
        link: "/concepts/script-execution-order",
      },
    ],
  },
  {
    text: "AI",
    link: "/ai",
    position: "left",
    tag: TAG_ICONS.ai,
    items: [
      {
        text: "Overview",
        link: "/ai",
        activeMatch: "/ai$",
      },
      {
        text: "AGENTS.md",
        link: "/ai/agents",
        activeMatch: "/ai/agents",
      },
      {
        text: "MCP Server",
        link: "/ai/mcp",
      },
    ],
  },
  {
    text: "More",
    position: "left",
    tag: TAG_ICONS.more,
    items: [
      {
        text: "Blog",
        link: BW_BLOG_URL,
      },
      {
        text: "Roadmap",
        link: "/roadmap",
      },
      {
        text: "Changelog",
        link: CHANGELOG_URL,
      },
      {
        text: "Bwunster Lore",
        link: "/lore",
      },
    ],
  },
  {
    text: "Blog",
    position: "right",
    link: BW_BLOG_URL,
    tag: TAG_ICONS.blog,
  },
];

const SIDEBAR_GROUPS = {
  cli: {
    path: "/cli",
    group: {
      text: "CLI",
      items: [
        {
          text: "Quick Start",
          link: "/cli",
        },
        {
          text: "Reference",
          collapsible: false,
          items: [
            {
              text: "Global Options",
              link: "/cli/global-options",
            },
            {
              text: "Commands",
              link: "/cli/commands",
              collapsed: false,
              items: [
                {
                  text: "list-workspaces (ls)",
                  link: "/cli/commands#list-workspaces",
                },
                {
                  text: "workspace-info (info)",
                  link: "/cli/commands#workspace-info",
                },
                {
                  text: "list-scripts (ls-scripts)",
                  link: "/cli/commands#list-scripts",
                },
                {
                  text: "script-info",
                  link: "/cli/commands#script-info",
                },
                {
                  text: "list-tags (ls-tags)",
                  link: "/cli/commands#list-tags",
                },
                {
                  text: "tag-info",
                  link: "/cli/commands#tag-info",
                },
                {
                  text: "run-script (run)",
                  link: "/cli/commands#run-script",
                },
                {
                  text: "list-affected (ls-affected)",
                  link: "/cli/commands#list-affected",
                },
                {
                  text: "run-affected",
                  link: "/cli/commands#run-affected",
                },
                {
                  text: "mcp-server",
                  link: "/cli/commands#mcp-server",
                },
                {
                  text: "doctor",
                  link: "/cli/commands#doctor",
                },
              ],
            },
          ],
        },
      ],
    },
  },
  api: {
    path: "/api",
    group: {
      text: "TS/JS API",
      items: [
        {
          text: "Quick Start",
          link: "/api",
        },
        {
          text: "Reference",
          link: "/api/reference",
          collapsed: false,
          items: [
            {
              text: "Workspace",
              link: "/api/reference#workspace",
            },
            {
              text: "Project",
              link: "/api/reference#project",
            },
            {
              text: "FileSystemProject",
              link: "/api/reference#filesystemproject",
            },
            {
              text: "createFileSystemProject",
              link: "/api/reference#createfilesystemproject",
            },
            {
              text: "createMemoryProject",
              link: "/api/reference#creatememoryproject",
            },
            {
              text: "setLogLevel",
              link: "/api/reference#setloglevel",
            },
          ],
        },
      ],
    },
  },
  config: {
    path: "/config",
    group: {
      text: "Configuration",
      items: [
        {
          text: "Overview",
          link: "/config",
        },
        {
          text: "Workspace Configuration",
          link: "/config/workspace",
          items: [
            {
              text: "Workspace Config File",
              link: "/config/workspace",
            },
            {
              text: "More: Inputs",
              link: "/config/workspace-inputs",
            },
          ],
        },
        {
          text: "Project Configuration",
          link: "/config/root",
          items: [
            {
              text: "Root Config File",
              link: "/config/root",
            },
            {
              text: "More: Workspace Pattern Configs",
              link: "/config/workspace-pattern-configs",
            },
            {
              text: "Environment Variables",
              link: "/config/env-vars",
            },
          ],
        },
      ],
    },
  },
  concepts: {
    path: "/concepts",
    group: {
      text: "Concepts",
      items: [
        {
          text: "Glossary",
          link: "/concepts/glossary",
        },
        {
          text: "Workspaces",
          items: [
            {
              text: "Workspace Aliases",
              link: "/concepts/workspace-aliases",
            },
            {
              text: "Workspace Patterns",
              link: "/concepts/workspace-patterns",
            },
            {
              text: "Workspace Dependencies",
              link: "/concepts/workspace-dependencies",
            },
            {
              text: "Root Workspace",
              link: "/concepts/root-workspace",
            },
            {
              text: "Affected Workspaces",
              link: "/concepts/affected",
            },
          ],
        },
        {
          text: "Scripts",
          items: [
            {
              text: "Inline Scripts",
              link: "/concepts/inline-scripts",
            },
            {
              text: "Parallel Scripts",
              link: "/concepts/parallel-scripts",
            },
            {
              text: "Workspace Script Metadata",
              link: "/concepts/workspace-script-metadata",
            },
            {
              text: "Script Execution Order",
              link: "/concepts/script-execution-order",
            },
          ],
        },
      ],
    },
  },
  ai: {
    path: "/ai",
    group: {
      text: "AI",
      items: [
        {
          text: "Overview",
          link: "/ai",
        },
        {
          text: "AGENTS.md",
          link: "/ai/agents",
        },
        {
          text: "MCP Server",
          link: "/ai/mcp",
        },
      ],
    },
  },
} as const satisfies Record<string, { path: string; group: SidebarGroup }>;

type SidebarGroupKey = keyof typeof SIDEBAR_GROUPS;

export const createSidebar = (groupKey: SidebarGroupKey) => ({
  [SIDEBAR_GROUPS[groupKey].path]: Object.entries(SIDEBAR_GROUPS).map(
    ([key, { path, group }]) => ({
      link: path,
      collapsed: key !== groupKey,
      ...group,
    }),
  ),
});
