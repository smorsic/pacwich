import { defineProjectConfig } from "pacwich/config";

export default defineProjectConfig({
  packageManager: "bun",
  workspacePatternConfigs: [
    {
      patterns: ["path:workspaces/libraries/**/*"],
      config: {
        tags: ["library"],
      },
    },
    {
      patterns: ["path:workspaces/meta", "path:workspaces/meta/**/*"],
      config: {
        tags: ["meta"],
      },
    },
    {
      patterns: ["path:workspaces/packages/**/*"],
      config: {
        tags: ["package", "deployable"],
      },
    },
    {
      patterns: ["path:workspaces/sandboxes/**/*"],
      config: {
        tags: ["sandbox", "internal"],
      },
    },
    {
      patterns: ["path:workspaces/web/**/*"],
      config: {
        tags: ["web", "deployable"],
        rules: {
          workspaceDependencies: {
            // `@pacwich/web-cli` runs the real `pacwich` CLI in the browser, so
            // it depends on `pacwich`; the docs site depends on
            // `@pacwich/web-cli` to render the Web CLI page.
            allowPatterns: ["path:workspaces/web/**/*", "pacwich"],
            denyPatterns: [],
          },
        },
      },
    },
    {
      patterns: ["tag:deployable"],
      config: {
        rules: {
          workspaceDependencies: {
            allowPatterns: ["@pacwich/common", "@pacwich/meta"],
            denyPatterns: [],
          },
        },
      },
    },
  ],
});
