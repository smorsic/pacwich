import path from "path";
import { defineConfig } from "@rsbuild/core";
import { pluginNodePolyfill } from "@rsbuild/plugin-node-polyfill";
import { pluginReact } from "@rsbuild/plugin-react";

const fsShim = path.resolve(__dirname, "src/cli/fsShim.ts");
const osShim = path.resolve(__dirname, "src/cli/osShim.ts");
const stubs = path.resolve(__dirname, "src/cli/stubs.ts");

export default defineConfig({
  plugins: [
    pluginReact(),
    // Polyfills path/os/util/buffer/url/stream/vm etc. We turn off the
    // `process` global so bare `process` resolves to our own shim
    // (src/cli/processShim.ts), which provides stdout/exit/env.
    pluginNodePolyfill({
      globals: { process: false, Buffer: true },
      protocolImports: true,
    }),
  ],
  source: {
    entry: { index: "./src/index.tsx" },
  },
  resolve: {
    alias: {
      // The "memory filesystem": redirect the CLI's fs access to memfs.
      fs: fsShim,
      "node:fs": fsShim,
      // The stock os polyfill omits constants.signals (read at CLI load).
      os: osShim,
      "node:os": osShim,
      // Node built-ins / loaders the CLI imports but never runs on the
      // read-only list-workspaces path. See src/cli/stubs.ts.
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
  html: {
    title: "pacwich web-cli sandbox",
  },
  server: {
    port: 3300,
  },
  output: {
    target: "web",
  },
});
