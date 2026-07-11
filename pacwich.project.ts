import { defineProjectConfig } from "pacwich/config";

export default defineProjectConfig({
  packageManager: "bun",
  workspacePatternConfigs: [
    {
      patterns: ["path:workspaces/ide/**/*"],
      config: {
        tags: ["ide", "deployable"],
      },
    },
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
            allowPatterns: ["@pacwich/common", "@pacwich/meta"],
            denyPatterns: [],
          },
        },
      },
    },
    {
      patterns: ["tag:ide"],
      config: {
        rules: {
          workspaceDependencies: {
            // The extension bundles pacwich's own TS API (createFileSystemProject)
            // for informational features rather than shelling out to the CLI.
            allowPatterns: ["pacwich"],
          },
        },
      },
    },
  ],
});
