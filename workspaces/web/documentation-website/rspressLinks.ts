import fs from "fs";
import path from "path";
import { type NavItem, type SidebarGroup, type Sidebar } from "@rspress/core";
import packageJson from "../../packages/pacwich/package.json";

export const DOMAIN = "https://pacwich.dev";
export const NPM_PACKAGE_URL = "https://www.npmjs.com/package/pacwich";
export const GITHUB_REPO_URL = packageJson.repository.url.replace(".git", "");
export const BLOG_URL = process.env.BLOG_URL || "https://smorsic.io/blog";
export const CHANGELOG_URL = `${GITHUB_REPO_URL}/releases`;
export const LICENSE_URL = GITHUB_REPO_URL + "/blob/main/LICENSE.md";

// Inline an SVG file as a nav-item `tag` string. Comments are stripped
// because rspress v2's Tag component checks for comma-separated arrays
// before checking for SVG strings, so any comma in the SVG (commonly a
// vendor comment like "Fonticons, Inc.") sends it down the wrong path.
const navIconSvg = (relativePath: string) =>
  fs
    .readFileSync(
      path.resolve(__dirname, "src/pages/public/images/svg", relativePath),
      "utf8",
    )
    .replace(/<!--[\s\S]*?-->/g, "");

export const HEADER_NAV_LINKS: NavItem[] = [
  {
    text: "Intro",
    link: "/intro/overview",
    position: "left",
    items: [
      {
        text: "Overview",
        link: "/intro/overview",
        activeMatch: "/intro/overview$",
      },
      {
        text: "Getting Started",
        link: "/intro/getting-started",
        activeMatch: "/intro/getting-started$",
      },
      {
        text: "bun-workspaces Migration Guide",
        link: "/intro/bun-workspaces-migration",
        activeMatch: "/intro/bun-workspaces-migration$",
      },
    ],
  },
  {
    text: "CLI",
    link: "/cli",
    position: "left",
    activeMatch: "/cli|web-cli",
    tag: navIconSvg("cli-nav-icon.svg"),
    items: [
      // ! Reenable when supported
      // {
      //   text: "Web CLI (Demo)",
      //   link: "/web-cli",
      //   activeMatch: "/web-cli$",
      // },
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
    tag: navIconSvg("api-nav-icon.svg"),
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
    tag: navIconSvg("config-nav-icon.svg"),
    items: [
      {
        text: "Overview",
        link: "/config",
        activeMatch: "/config$",
      },
      {
        text: "Project Configuration",
        link: "/config/project",
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
        text: "Environment Variables",
        link: "/config/env-vars",
      },
      {
        text: "Warnings",
        link: "/config/warnings",
      },
    ],
  },
  {
    text: "Concepts",
    link: "/concepts/glossary",
    position: "left",
    activeMatch: "/concepts",
    tag: navIconSvg("concepts-nav-icon.svg"),
    items: [
      {
        text: "Glossary",
        link: "/concepts/glossary",
      },
      {
        text: "Verify",
        link: "/concepts/verify",
      },
      {
        text: "Inputs",
        link: "/concepts/inputs",
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
    tag: navIconSvg("ai-nav-icon.svg"),
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
        text: "Skills",
        link: "/ai/skills",
        activeMatch: "/ai/skills",
      },
      {
        text: "MCP Server",
        link: "/ai/mcp",
        activeMatch: "/ai/mcp",
      },
      {
        text: "/llms.txt",
        link: "/ai/llms-txt",
        activeMatch: "/ai/llms-txt",
      },
    ],
  },
  {
    text: "More",
    position: "left",
    tag: navIconSvg("more-nav-icon.svg"),
    items: [
      {
        text: "Security",
        link: "/security",
      },
      {
        text: "Roadmap",
        link: "/roadmap",
      },
      {
        text: "Lore",
        link: "/lore",
      },
      {
        text: "How Are These Docs Maintained?",
        link: "/how",
      },
      {
        text: "Blog",
        link: BLOG_URL,
      },
      {
        text: "Changelog",
        link: CHANGELOG_URL,
      },
      {
        text: "License",
        link: LICENSE_URL,
      },
    ],
  },
  {
    text: "Blog",
    position: "right",
    link: BLOG_URL,
    tag: navIconSvg("blog-nav-icon.svg"),
  },
];

const SIDEBAR_GROUPS = {
  intro: {
    path: "/intro",
    group: {
      text: "Introduction",
      items: [
        {
          text: "Overview",
          link: "/intro/overview",
        },
        {
          text: "Getting Started",
          link: "/intro/getting-started",
        },
        {
          text: "Migrating from bun-workspaces",
          link: "/intro/bun-workspaces-migration",
        },
      ],
    },
  },
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
          text: "Global Options",
          link: "/cli/global-options",
        },
        {
          text: "Commands",
          link: "/cli/commands",
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
          ],
        },
        {
          text: "Project Configuration",
          link: "/config/project",
          items: [
            {
              text: "Project Config File",
              link: "/config/project",
            },
            {
              text: "More: Workspace Pattern Configs",
              link: "/config/workspace-pattern-configs",
            },
          ],
        },
        {
          text: "Environment Variables",
          link: "/config/env-vars",
        },
        {
          text: "Warnings",
          link: "/config/warnings",
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
          text: "Verify",
          link: "/concepts/verify",
        },
        {
          text: "Workspaces",
          items: [
            {
              text: "Inputs",
              link: "/concepts/inputs",
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
          text: "Integrations",
          items: [
            {
              text: "AGENTS.md",
              link: "/ai/agents",
            },
            {
              text: "Skills",
              link: "/ai/skills",
            },
            {
              text: "/llms.txt",
              link: "/ai/llms-txt",
            },
            {
              text: "MCP Server",
              link: "/ai/mcp",
            },
          ],
        },
      ],
    },
  },
  more: {
    path: "/",
    group: {
      text: "More",
      items: [
        {
          text: "Security",
          link: "/security",
        },
        {
          text: "Roadmap",
          link: "/roadmap",
        },
        {
          text: "Lore",
          link: "/lore",
        },
        {
          text: "How Are These Docs Maintained?",
          link: "/how",
        },
        {
          text: "Blog",
          link: BLOG_URL,
        },
        {
          text: "Changelog",
          link: CHANGELOG_URL,
        },
        {
          text: "License",
          link: LICENSE_URL,
        },
      ],
    },
  },
} as const satisfies Record<string, { path: string; group: SidebarGroup }>;

const createScopedSidebar = (): Sidebar =>
  Object.entries(SIDEBAR_GROUPS).reduce(
    (acc, [key, { path }]) => {
      acc[path] = Object.entries(SIDEBAR_GROUPS).map(
        ([innerKey, { path: groupPath, group: groupData }]) => {
          return {
            link: groupPath,
            ...(key !== innerKey && { collapsed: true }),
            ...groupData,
          };
        },
      );
      return acc;
    },
    { "/": [] } as Sidebar,
  );

const createComboSidebar = () => {
  const result: Sidebar = {
    "/": Object.values(SIDEBAR_GROUPS).map<SidebarGroup>((group) => {
      return {
        collapsed: true,
        ...group.group,
      };
    }),
  };
  return result;
};

/**
 *  @todo
 * Scoped sidebar collapses the top level groups not selected,
 * but at time of writing is too awkward thanks to Rspress
 * storing previously expanded menus that are then re-expanded
 * when the user navigates away and back.
 */
export const createSidebar = (behavior: "scoped" | "combo") =>
  behavior === "scoped" ? createScopedSidebar() : createComboSidebar();
