import fs from "fs";
import path from "path";
import { pluginSvgr } from "@rsbuild/plugin-svgr";
import { pluginClientRedirects } from "@rspress/plugin-client-redirects";
import { defineConfig } from "rspress/config";
import packageJson from "../../packages/bun-workspaces/package.json";
import {
  HEADER_NAV_LINKS,
  GITHUB_REPO_URL,
  CHANGELOG_URL,
  LICENSE_URL,
  DOMAIN,
  NPM_PACKAGE_URL,
  BW_BLOG_URL,
  createSidebar,
} from "./rspressLinks";

const REQUIRED_BUN_VERSION = packageJson._bwInternal.bunVersion.libraryConsumer;

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
    nav: HEADER_NAV_LINKS,
    sidebar: {
      ...createSidebar("cli"),
      ...createSidebar("api"),
      ...createSidebar("config"),
      ...createSidebar("concepts"),
    },
  },
});
