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
      },
    },
    {
      patterns: ["tag:deployable"],
      config: {
        rules: {
          workspaceDependencies: {
            allowPatterns: [
              "@pacwich/common",
              "@pacwich/meta",
              "@pacwich/web-common",
            ],
            denyPatterns: [],
          },
        },
      },
    },
  ],
});
