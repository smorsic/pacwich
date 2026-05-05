import fs from "fs";
import path from "path";
import { pluginSvgr } from "@rsbuild/plugin-svgr";
import { pluginClientRedirects } from "@rspress/plugin-client-redirects";
import { defineConfig } from "rspress/config";
import packageJson from "../../packages/bun-workspaces/package.json";
import { TAG_ICONS } from "./tagIcons";

const REQUIRED_BUN_VERSION = packageJson._bwInternal.bunVersion.libraryConsumer;

const DOMAIN = "https://bunworkspaces.com";
const GITHUB_REPO_URL = packageJson.repository.url.replace(".git", "");
const CHANGELOG_URL = `${GITHUB_REPO_URL}/releases`;
const LICENSE_URL = GITHUB_REPO_URL + "/blob/main/LICENSE.md";
const NPM_PACKAGE_URL = "https://www.npmjs.com/package/bun-workspaces";

const TITLE =
  "bun-workspaces — Enhanced Bun monorepo management | Documentation";
const DESCRIPTION =
  "A tool for managing monorepos using native Bun workspaces, helping you develop JavaScript and TypeScript projects with the bun-workspaces CLI and API.";

const LD_JSON = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "bun-workspaces",
  alternateName: "bw",
  applicationCategory: "DeveloperApplication",
  applicationSubCategory: "CLI",
  operatingSystem: "Cross-platform",
  url: DOMAIN,
  releaseNotes: CHANGELOG_URL,
  description: DESCRIPTION,
  abstract: DESCRIPTION,
  sameAs: [GITHUB_REPO_URL, NPM_PACKAGE_URL],
  downloadUrl: NPM_PACKAGE_URL,
  license: LICENSE_URL,
  thumbnailUrl: `${DOMAIN}/images/png/bwunster-bg-square_300x300.png`,
  accessMode: "textual",
  author: {
    "@type": "Person",
    name: "Scott Morse",
  },
  publisher: {
    "@type": "Organization",
    name: "Smorsic Labs, LLC",
    url: "https://smorsic.io",
  },
  audience: {
    "@type": "Audience",
    audienceType: "Software developers",
    description:
      "Developers using the Bun runtime for TypeScript or JavaScript and its workspace feature for monorepo development.",
  },
  about: {
    "@type": "Thing",
    name: "Bun workspaces",
    sameAs: "https://bun.sh/docs/pm/workspaces",
    description:
      "Native workspace feature in the Bun JavaScript runtime used for managing multi-package monorepos.",
  },
  softwareVersion: packageJson.version,
};

const BWUNSTER_ASCII = fs.readFileSync(
  path.resolve(__dirname, "../../../bwunster.txt"),
  "utf8",
);

const BW_BLOG_URL = process.env.BW_BLOG_URL || "https://bunworkspaces.com/blog";

export default defineConfig({
  root: "src/pages",
  themeDir: path.join(__dirname, "src/theme"),
  title: TITLE,
  globalStyles: path.resolve("src/theme/css/global.css"),
  description: DESCRIPTION,
  icon: "/favicon.ico",
  logo: "/images/png/bwunster_64x70.png",
  logoText: `bun-workspaces`,
  search: {
    searchHooks: path.join(__dirname, "src/search/search.tsx"),
  },
  plugins: [
    pluginClientRedirects({
      redirects: [
        {
          from: "/concepts/script-runtime-metadata",
          to: "/concepts/workspace-script-metadata",
        },
      ],
    }),
    // TODO: This worked briefly with mismatched versions. This will likely not work again until rspress v2 is out of beta.
    // * In the meantime, manage src/pages/public/sitemap.xml manually.
    // * And however, be mindful that trailing slashes vs. non-trailing slashes
    // * are important to the Google Search Console. This site works best with non-trailing links
    // * and sitemap.xml references.
    // pluginSitemap({
    //   siteUrl: new URL(packageJson.homepage).origin,
    //   defaultChangeFreq: "weekly",
    //   defaultPriority: "0.8",
    // }),
  ],
  route: {
    cleanUrls: true,
  },
  builderConfig: {
    dev: {},
    tools: {
      rspack: {
        // bun-workspaces uses a dynamic require() for loading TS/JS config files
        // at runtime — it is never executed in the browser bundle context
        ignoreWarnings: [/Critical dependency/],
      },
    },
    plugins: [pluginSvgr()],
    output: {
      cleanDistPath: true,
    },
    source: {
      define: {
        process: `({ 
          env: {
            YEAR: ${JSON.stringify(new Date().getFullYear())},
            BUILD_ID: ${JSON.stringify(process.env.BUILD_ID ?? "(no build ID)")},
            REQUIRED_BUN_VERSION: ${JSON.stringify(REQUIRED_BUN_VERSION)},
            BWUNSTER_ASCII: ${JSON.stringify(BWUNSTER_ASCII)},
            BW_WEB_SERVICE_BASE_URL: ${JSON.stringify(process.env.BW_WEB_SERVICE_BASE_URL ?? "http://localhost:8080")},
            BW_DOC_ENV: ${JSON.stringify(process.env.BW_DOC_ENV ?? "production")},
            BW_BLOG_URL: ${JSON.stringify(BW_BLOG_URL)},
          },
          on: function(){}
        })`,
      },
    },
    html: {
      tags: [
        ...(process.env.BW_DOC_ENV === "development"
          ? [
              {
                tag: "meta",
                attrs: {
                  name: "robots",
                  content: "noindex, nofollow",
                },
              },
            ]
          : []),
        {
          tag: "script",
          attrs: {
            type: "application/ld+json",
          },
          children: JSON.stringify(
            LD_JSON,
            null,
            process.env.BW_DOC_ENV === "development" ? 2 : 0,
          ),
        },
        {
          tag: "meta",
          attrs: {
            name: "og:title",
            content: TITLE,
          },
        },
        {
          tag: "meta",
          attrs: {
            name: "og:type",
            content: "website",
          },
        },
        {
          tag: "meta",
          attrs: {
            name: "og:description",
            content: DESCRIPTION,
          },
        },
        {
          tag: "meta",
          attrs: {
            name: "og:url",
            content: DOMAIN,
          },
        },
        {
          tag: "meta",
          attrs: {
            name: "og:image",
            content: `${DOMAIN}/images/png/bwunster-og-title_1200x630.png`,
          },
        },
        {
          tag: "link",
          attrs: {
            rel: "preconnect",
            href: "https://fonts.googleapis.com",
          },
        },
        {
          tag: "link",
          attrs: {
            rel: "preconnect",
            href: "https://fonts.gstatic.com",
          },
        },
        {
          tag: "link",
          attrs: {
            rel: "stylesheet",
            // ! TODO Remove unused
            href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;600;700&family=Jersey+10&family=Lexend:wght@100..900&display=swap",
          },
        },
        {
          tag: "script",
          children: `
          if(!localStorage.getItem('bw-doc-theme-initialized')) {
            window.RSPRESS_THEME = 'dark';
            localStorage.setItem('bw-doc-theme-initialized', 'true');
          }
          `.replace(/\s+/g, ""),
        },
      ],
    },
  },
  themeConfig: {
    enableScrollToTop: true,
    socialLinks: [
      {
        icon: {
          svg: fs.readFileSync(
            path.resolve(
              __dirname,
              "src/pages/public/images/external/gh-sponsors.svg",
            ),
            "utf8",
          ),
        },
        mode: "link",
        content: "https://github.com/sponsors/bun-workspaces",
      },
      {
        icon: "github",
        mode: "link",
        content: GITHUB_REPO_URL,
      },
      {
        icon: {
          svg: fs.readFileSync(
            path.resolve(
              __dirname,
              "src/pages/public/images/external/npm-logo.svg",
            ),
            "utf8",
          ),
        },
        mode: "link",
        content: "https://www.npmjs.com/package/bun-workspaces",
      },
    ],
    nav: [
      {
        text: "CLI",
        link: "/cli",
        position: "left",
        activeMatch: "/cli|web-cli",
        tag: TAG_ICONS.cli,
        items: [
          {
            text: "Web CLI (Demo)",
            link: "/web-cli",
            activeMatch: "/web-cli$",
          },
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
            text: "General",
            link: "/config",
          },
          {
            text: "Root Configuration",
            link: "/config/root",
          },
          {
            text: "Workspace Configuration",
            link: "/config/workspace",
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
        link: "/ai/mcp",
        position: "left",
        activeMatch: "/ai",
        tag: TAG_ICONS.ai,
        items: [
          {
            text: "MCP",
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
    ],
  },
});
