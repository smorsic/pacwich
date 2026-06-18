import fs from "fs";
import path from "path";
import { pluginSvgr } from "@rsbuild/plugin-svgr";
import { defineConfig } from "@rspress/core";
import { pluginClientRedirects } from "@rspress/plugin-client-redirects";
import { pluginSitemap } from "@rspress/plugin-sitemap";
import packageJson from "../../packages/pacwich/package.json";
import {
  HEADER_NAV_LINKS,
  GITHUB_REPO_URL,
  CHANGELOG_URL,
  LICENSE_URL,
  DOMAIN,
  NPM_PACKAGE_URL,
  BLOG_URL,
  createSidebar,
} from "./rspressLinks";

const TITLE =
  "pacwich: Monorepo tooling for Bun, npm, and pnpm workspaces | Documentation";
const DESCRIPTION =
  "Monorepo tooling that works on top of Bun, npm, and pnpm workspaces, with a CLI and TypeScript API.";

const LD_JSON = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "pacwich",
  alternateName: "pacwich",
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
  thumbnailUrl: `${DOMAIN}/images/png/bwunster-bg-title_128x128x6.png`,
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
    description: "Developers of TypeScript or JavaScript monorepos.",
  },
  softwareVersion: packageJson.version,
};

const BWUNSTER_ASCII = fs.readFileSync(
  path.resolve(__dirname, "../../../bwunster.txt"),
  "utf8",
);

export default defineConfig({
  root: "src/pages",
  themeDir: path.join(__dirname, "src/theme"),
  title: TITLE,
  globalStyles: path.resolve("src/theme/css/global.css"),
  description: DESCRIPTION,
  icon: "/favicon.ico",
  logo: "/images/png/bwunster_64x70.png",
  logoText: `pacwich`,
  search: {
    searchHooks: path.join(__dirname, "src/search/search.tsx"),
  },
  llms: {
    remarkSplitMdxOptions: {
      excludes: [
        [["CliInstall"], "@/lib/cli/CliInstall"],
        [["ApiInstall"], "@/lib/api/ApiInstall"],
      ],
    },
  },
  plugins: [
    pluginClientRedirects({
      redirects: [
        {
          from: "/concepts/script-runtime-metadata",
          to: "/concepts/workspace-script-metadata",
        },
        {
          from: "/concepts$",
          to: "/concepts/glossary",
        },
      ],
    }),
    pluginSitemap({
      siteUrl: new URL(packageJson.homepage).origin,
      defaultChangeFreq: "weekly",
      defaultPriority: "0.8",
    }),
  ],
  route: {
    cleanUrls: true,
  },
  builderConfig: {
    dev: {},
    tools: {
      rspack: {
        ignoreWarnings: [
          // mismatched value stringification across builds
          /Conflicting values for 'import\.meta\.env\.SSR'/,
        ],
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
            BWUNSTER_ASCII: ${JSON.stringify(BWUNSTER_ASCII)},
            PACWICH_WEB_SERVICE_BASE_URL: ${JSON.stringify(process.env.PACWICH_WEB_SERVICE_BASE_URL ?? "http://localhost:8080")},
            PACWICH_DOCS_ENV: ${JSON.stringify(process.env.PACWICH_DOCS_ENV ?? "production")},
            BLOG_URL: ${JSON.stringify(BLOG_URL)},
          },
        })`,
      },
    },
    html: {
      tags: [
        ...(process.env.PACWICH_DOCS_ENV === "development"
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
            process.env.PACWICH_DOCS_ENV === "development" ? 2 : 0,
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
            content: `${DOMAIN}/images/png/og.png`,
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
            href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;600;700&family=Jersey+10&family=Lexend:wght@100..900&display=swap",
          },
        },
        {
          tag: "script",
          children: `
          if(!localStorage.getItem('pacwich-doc-theme-initialized')) {
            localStorage.setItem('rspress-theme-appearance', 'dark');
            localStorage.setItem('pacwich-doc-theme-initialized', 'true');
          }
          `.replace(/\s+/g, ""),
        },
      ],
    },
  },
  themeConfig: {
    llmsUI: false,
    enableScrollToTop: true,
    darkMode: true,
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
        content: "https://github.com/sponsors/smorsic",
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
        content: "https://www.npmjs.com/package/pacwich",
      },
    ],
    nav: HEADER_NAV_LINKS,
    sidebar: createSidebar("combo"),
  },
});
