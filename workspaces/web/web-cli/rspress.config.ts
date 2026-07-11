import path from "path";
import { createMockSubprocessRspackPlugin } from "@pacwich/web-common/web-cli-runtime/mockSubprocessRspackPlugin";
import { rspack } from "@rsbuild/core";
import { pluginNodePolyfill } from "@rsbuild/plugin-node-polyfill";
import { defineConfig } from "@rspress/core";

const RUNTIME_DIR = path.resolve(
  __dirname,
  "../../libraries/web-common/web-cli-runtime",
);
const fsShim = path.join(RUNTIME_DIR, "fsShim.ts");
const osShim = path.join(RUNTIME_DIR, "osShim.ts");
const stubs = path.join(RUNTIME_DIR, "stubs.ts");

const mockSubprocessPlugin = createMockSubprocessRspackPlugin(rspack);

export default defineConfig({
  root: "src/pages",
  title: "pacwich Web CLI",
  description: "Run the real pacwich CLI in your browser.",
  globalStyles: path.resolve(__dirname, "src/theme/css/global.css"),
  // The CLI/memfs/xterm machinery is browser-only; disable prerendering
  // rather than fight an SSR pass that would need every Node shim available
  // server-side too.
  ssg: false,
  // No fixed dev server port: portless (see package.json's "dev"/"preview"
  // scripts) assigns one via PORT, which Rsbuild reads automatically.
  builderConfig: {
    plugins: [
      // Polyfills path/os/util/buffer/url/stream/vm etc. We turn off the
      // `process` global so bare `process` resolves to the web-cli-runtime's
      // own shim (processShim.ts, imported by runPacwichCli.ts), which
      // provides stdout/exit/env.
      pluginNodePolyfill({
        globals: { process: false, Buffer: true },
        protocolImports: true,
      }),
    ],
    resolve: {
      alias: {
        // The "memory filesystem": redirect the CLI's fs access to memfs.
        fs: fsShim,
        "node:fs": fsShim,
        // The stock os polyfill omits constants.signals (read at CLI load).
        os: osShim,
        "node:os": osShim,
        // Node built-ins / loaders the CLI imports but never runs on the
        // read-only list-workspaces path. See web-cli-runtime/stubs.ts.
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
    html: {
      tags: [
        // IBM Plex Sans / Lexend, matching documentation-website's actual
        // branding fonts (loaded the same way there — not self-hosted).
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
            href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;600;700&family=Lexend:wght@100..900&display=swap",
          },
        },
      ],
    },
  },
});
