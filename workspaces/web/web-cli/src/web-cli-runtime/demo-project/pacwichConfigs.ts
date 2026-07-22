/**
 * Hand-authored pacwich configs for the demo project. Each config is seeded
 * into memfs twice by `demoProject.ts`: a `.jsonc` file pacwich actually
 * parses (the browser CLI never evaluates `.ts` configs) and a `.ts` display
 * twin derived from the same jsonc for the file tree.
 */
import type { WORKSPACE_DIRS } from "../demoProjectBase";

type WorkspaceDir = (typeof WORKSPACE_DIRS)[number]["dir"];

export type DemoWorkspaceConfig = {
  alias: string;
  tags: string[];
};

export const WORKSPACE_CONFIGS: Record<
  WorkspaceDir,
  DemoWorkspaceConfig
> = {
  "apps/my-app-a/frontend-a": {
    alias: "fe-a",
    tags: ["app", "app-a", "frontend"],
  },
  "apps/my-app-a/backend-a": {
    alias: "be-a",
    tags: ["app", "app-a", "backend"],
  },
  "apps/my-app-a/shared-a": {
    alias: "shr-a",
    tags: ["app", "app-a", "app-share", "shared"],
  },
  "apps/my-app-b/shared-b": {
    alias: "shr-b",
    tags: ["app", "app-b", "app-share", "shared"],
  },
  "apps/my-app-b/frontend-b": {
    alias: "fe-b",
    tags: ["app", "app-b", "frontend"],
  },
  "apps/my-app-b/backend-b": {
    alias: "be-b",
    tags: ["app", "app-b", "backend"],
  },
  "libraries/frontend-utils": {
    alias: "fe-utils",
    tags: ["library", "frontend"],
  },
  "libraries/backend-utils": {
    alias: "be-utils",
    tags: ["library", "backend"],
  },
  "libraries/shared-utils": {
    alias: "shr-utils",
    tags: ["library", "shared"],
  },
};

/**
 * The demo project config: defaults plus the tag-based workspace dependency
 * rules. Aliases and tags live in each workspace's own config above.
 */
export const PACWICH_PROJECT_JSONC_SOURCE = `{
  "defaults": {
    // use the Bun shell (cross-platform bash-like shell)
    // for inline script commands
    "shell": "bun"
  },
  // Define rules for workspace code sharing based on the
  // tags each workspace declares in its own config
  "workspacePatternConfigs": [
    {
      // Any workspace may depend on shared code and libraries
      "patterns": ["*"],
      "config": {
        "rules": {
          "workspaceDependencies": {
            "allowPatterns": ["tag:shared", "tag:library"]
          }
        }
      }
    },
    {
      // Apps may also depend on app-scoped shared workspaces
      "patterns": ["tag:app"],
      "config": {
        "rules": {
          "workspaceDependencies": {
            "allowPatterns": ["tag:app-share"]
          }
        }
      }
    },
    {
      // Keep the two apps' code separate from each other
      "patterns": ["tag:app-a"],
      "config": {
        "rules": {
          "workspaceDependencies": {
            "denyPatterns": ["tag:app-b"]
          }
        }
      }
    },
    {
      "patterns": ["tag:app-b"],
      "config": {
        "rules": {
          "workspaceDependencies": {
            "denyPatterns": ["tag:app-a"]
          }
        }
      }
    },
    {
      // Frontend and backend code never mix
      "patterns": ["tag:frontend"],
      "config": {
        "rules": {
          "workspaceDependencies": {
            "denyPatterns": ["tag:backend"]
          }
        }
      }
    },
    {
      "patterns": ["tag:backend"],
      "config": {
        "rules": {
          "workspaceDependencies": {
            "denyPatterns": ["tag:frontend"]
          }
        }
      }
    }
  ]
}`;
