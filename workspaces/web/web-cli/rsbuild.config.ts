import { defineConfig, rspack } from "@rsbuild/core";
import { pluginNodePolyfill } from "@rsbuild/plugin-node-polyfill";
import { pluginReact } from "@rsbuild/plugin-react";
import {
  createMockSubprocessPlugin,
  nodePolyfillOptions,
  webCliAliases,
} from "./src/bundler";

// The local preview server for @pacwich/web-cli. The docs website applies the
// same three pieces (see src/bundler) inside its rspress `builderConfig`.
export default defineConfig({
  plugins: [pluginReact(), pluginNodePolyfill(nodePolyfillOptions)],
  source: {
    entry: { index: "./src/preview/index.tsx" },
  },
  resolve: {
    alias: webCliAliases,
  },
  tools: {
    rspack: (_config, { appendPlugins }) => {
      appendPlugins(createMockSubprocessPlugin(rspack));
    },
  },
  html: {
    title: "pacwich web CLI (preview)",
  },
  server: {
    port: 3301,
  },
  output: {
    target: "web",
  },
});
