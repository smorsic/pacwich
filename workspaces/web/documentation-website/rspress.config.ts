import fs from "fs";
import path from "path";
import { createMockSubprocessRspackPlugin } from "@pacwich/web-cli/web-cli-runtime/mockSubprocessRspackPlugin";
import { rspack } from "@rsbuild/core";
import { pluginNodePolyfill } from "@rsbuild/plugin-node-polyfill";
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

// The web CLI (/web-cli) runs the real pacwich CLI in-browser over memfs —
// browser-only machinery that must NOT leak into rspress's SSR ("node")
// compilation pass, which other pages (CliInstall.tsx, PmTabs.tsx,
// runScriptJson.ts) use to render real pacwich data server-side. Scoped
// below to builderConfig.environments.web (the client-only bundle) instead
// of the top level, which would apply to every environment.
const WEB_CLI_RUNTIME_DIR = path.resolve(
  __dirname,
  "../web-cli/src/web-cli-runtime",
);
const fsShim = path.join(WEB_CLI_RUNTIME_DIR, "fsShim.ts");
const osShim = path.join(WEB_CLI_RUNTIME_DIR, "osShim.ts");
const stubs = path.join(WEB_CLI_RUNTIME_DIR, "stubs.ts");
const mockSubprocessPlugin = createMockSubprocessRspackPlugin(rspack);

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
  // /web-cli uses memfs/xterm/the in-browser CLI — it can't be server
  // rendered, so it falls back to pure client hydration while every other
  // route stays fully SSG'd.
  ssg: {
    experimentalExcludeRoutePaths: ["/web-cli"],
  },
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
          from: ["/config/inputs", "/config/workspace-inputs"],
          to: "/concepts/inputs",
        },
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
    // Scoped to the client/browser bundle only — see the comment above
    // WEB_CLI_RUNTIME_DIR. Left untouched: environments.node (SSR) and
    // environments.node_md (llms.txt), both of which need real fs/child_process
    // for CliInstall.tsx/PmTabs.tsx/runScriptJson.ts's real pacwich usage.
    environments: {
      web: {
        plugins: [
          pluginNodePolyfill({
            globals: { process: false, Buffer: true },
            protocolImports: true,
            // The plugin's own isServer check (which normally skips
            // polyfilling for a Node-target build) doesn't correctly detect
            // this as a client build when registered inside
            // builderConfig.environments.web instead of at the config root
            // — force it on, since this environment IS the client bundle.
            force: true,
          }),
        ],
        resolve: {
          alias: {
            fs: fsShim,
            "node:fs": fsShim,
            os: osShim,
            "node:os": osShim,
            child_process: stubs,
            "node:child_process": stubs,
            readline: stubs,
            "node:readline": stubs,
            module: stubs,
            "node:module": stubs,
            "stream/consumers": stubs,
            "node:stream/consumers": stubs,
            jiti: stubs,
          },
        },
        tools: {
          rspack: (_config, { appendPlugins }) => {
            appendPlugins(mockSubprocessPlugin);
          },
        },
      },
    },
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
      // Defined as individual `process.env.X` paths, not a single `process`
      // key replacing the whole identifier — the latter clobbered every
      // `process.on`/`.exit`/`.stdout` reference site-wide (including inside
      // the bundled pacwich CLI powering /web-cli), since Rsbuild's define
      // does a literal AST substitution of whatever key you give it.
      define: {
        "process.env.YEAR": JSON.stringify(new Date().getFullYear()),
        "process.env.BUILD_ID": JSON.stringify(
          process.env.BUILD_ID ?? "(no build ID)",
        ),
        "process.env.BWUNSTER_ASCII": JSON.stringify(BWUNSTER_ASCII),
        "process.env.PACWICH_DOCS_ENV": JSON.stringify(
          process.env.PACWICH_DOCS_ENV ?? "production",
        ),
        "process.env.BLOG_URL": JSON.stringify(BLOG_URL),
      },
    },
    html: {
      tags: [
        // Safety net, runs before any bundled JS: a bare `process.env.X`
        // reference anywhere on the site (outside the specific paths listed
        // in source.define above) would otherwise throw "process is not
        // defined" in the browser — e.g. @pacwich/common/version reading
        // process.env._IS_PACWICH_LOCAL_SOURCE. Only installs if nothing has
        // defined `process` yet, so it never shadows the real Node process
        // during SSR, and /web-cli's own runPacwichCli.ts still installs its
        // fuller shim on top when a command actually runs.
        {
          tag: "script",
          children:
            "if(typeof window.process==='undefined'){window.process={env:{}};}",
        },
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
