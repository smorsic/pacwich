import path from "path";
import { rspack } from "@rsbuild/core";
import { pluginNodePolyfill } from "@rsbuild/plugin-node-polyfill";
import { defineConfig } from "@rspress/core";

const fsShim = path.resolve(__dirname, "src/cli/fsShim.ts");
const osShim = path.resolve(__dirname, "src/cli/osShim.ts");
const stubs = path.resolve(__dirname, "src/cli/stubs.ts");
const mockSubprocess = path.resolve(__dirname, "src/cli/mockSubprocess.ts");

// pacwich funnels every spawn (scripts + git) through the single
// `createSubprocess()` in `runScript/subprocesses.ts`. Swap that one module for
// our browser mock. It's imported from a few dirs — `./subprocesses` (from
// runScript/) and `../runScript/subprocesses` (from affected/, inputs/) — so we
// resolve the request against its importer and match the absolute target,
// catching every importer without rewriting any unrelated `subprocesses` file.
const mockSubprocessPlugin = new rspack.NormalModuleReplacementPlugin(
  /(^|[\\/])subprocesses(\.ts)?$/,
  (resource: { request: string; context?: string }) => {
    const resolved = path.resolve(resource.context ?? "", resource.request);
    if (/[\\/]runScript[\\/]subprocesses(\.ts)?$/.test(resolved)) {
      resource.request = mockSubprocess;
    }
  },
);

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
      // `process` global so bare `process` resolves to our own shim
      // (src/cli/processShim.ts), which provides stdout/exit/env.
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
    tools: {
      rspack: (_config, { appendPlugins }) => {
        appendPlugins(mockSubprocessPlugin);
      },
    },
  },
});
