import { defineProjectConfig } from "pacwich_local/config";

export default defineProjectConfig({
  packageManager: "bun",
  defaults: {
    shell: "bun",
  },
  verify: {
    workspaceDependencies: {
      ignoreInputFiles: ["**/*/pacwich.workspace.ts"],
    },
  },
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
        verify: {
          workspaceDependencies: {
            ignoreImportsFromWorkspacePatterns: ["pacwich_local"],
          },
        },
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
              "pacwich_local",
            ],
            denyPatterns: [],
          },
        },
      },
    },
    {
      // documentation-website embeds web-cli's portable componentry directly
      // on its /web-cli page, rather than each maintaining its own copy.
      patterns: ["path:workspaces/web/documentation-website"],
      config: {
        rules: {
          workspaceDependencies: {
            allowPatterns: ["@pacwich/web-cli"],
          },
        },
      },
    },
  ],
});
