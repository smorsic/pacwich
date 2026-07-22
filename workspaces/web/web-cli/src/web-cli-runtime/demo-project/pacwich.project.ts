import { defineProjectConfig } from "pacwich/config";

export default defineProjectConfig({
  defaults: {
    // use the Bun shell (cross-platform bash-like shell)
    // for inline script commands
    shell: "bun",
  },
  workspacePatternConfigs: [
    {
      // Assign all workspaces tags dynamically with config factory
      patterns: ["*"],
      config: (workspace) => {
        const lastSegment =
          workspace.path.split("/").pop() ?? "";
        const tags: string[] = [];

        if (workspace.path.startsWith("libraries/"))
          tags.push("library");

        if (/^apps\/[^/]+\/shared-/.test(workspace.path)) {
          tags.push("app-share");
        } else if (workspace.path.startsWith("apps/")) {
          tags.push("app");
          tags.push(
            workspace.path.startsWith("apps/my-app-a/")
              ? "app-a"
              : "app-b",
          );
        }

        if (lastSegment.startsWith("frontend-"))
          tags.push("frontend");
        if (lastSegment.startsWith("backend-"))
          tags.push("backend");
        if (lastSegment.startsWith("shared-"))
          tags.push("shared");
        if (/^apps\/[^/]+\/shared-/.test(workspace.path))
          tags.push("app-share");

        return {
          tags,
          rules: {
            workspaceDependencies: {
              allowPatterns: ["tag:shared", "tag:library"],
            },
          },
        };
      },
    },
    // Define rules for workspace code sharing based on tags
    {
      patterns: ["tag:app"],
      config: {
        rules: {
          workspaceDependencies: {
            allowPatterns: ["tag:app-share"],
          },
        },
      },
    },
    {
      patterns: ["tag:app-a"],
      config: {
        rules: {
          workspaceDependencies: {
            denyPatterns: ["tag:app-b"],
          },
        },
      },
    },
    {
      patterns: ["tag:app-b"],
      config: {
        rules: {
          workspaceDependencies: {
            denyPatterns: ["tag:app-a"],
          },
        },
      },
    },
    {
      patterns: ["tag:frontend"],
      config: {
        rules: {
          workspaceDependencies: {
            denyPatterns: ["tag:backend"],
          },
        },
      },
    },
    {
      patterns: ["tag:backend"],
      config: {
        rules: {
          workspaceDependencies: {
            denyPatterns: ["tag:frontend"],
          },
        },
      },
    },
  ],
});
