import {
  type WorkspaceConfig,
  type RootConfig,
  WORKSPACE_CONFIG_PACKAGE_JSON_KEY,
  ROOT_CONFIG_PACKAGE_JSON_KEY,
} from "bw-common/config";

export const exampleRootConfigSimple1: RootConfig = {
  defaults: {
    parallelMax: 4,
    shell: "system",
    includeRootWorkspace: false,
  },
  workspacePatternConfigs: [
    {
      patterns: ["path:libraries/frontend/**/*"],
      config: {
        tags: ["frontend", "library"],
      },
    },
  ],
};

export const exampleRootConfigSimple2: RootConfig = {
  defaults: {
    parallelMax: "50%",
    shell: "system",
    includeRootWorkspace: true,
  },
};

export const exampleWorkspaceConfigSimple: WorkspaceConfig = {
  alias: "myApp",
  tags: ["my-tag"],
  scripts: {
    start: {
      order: 10,
    },
    test: {
      order: 20,
    },
  },
  rules: {
    workspaceDependencies: {
      allowPatterns: [
        "my-workspace-a",
        "tag:my-tag",
        "path:my-path/**/*",
        "not:tag:my-excluded-tag",
      ],
    },
  },
};

export const exampleWorkspaceConfigArray: WorkspaceConfig = {
  alias: ["myApp", "my-app"],
};

export const createPackageJsonExample = (
  config: object,
  target: "workspace" | "root",
) => {
  return {
    name:
      target === "workspace" ? "@my-organization/my-application" : "my-project",
    description: target === "workspace" ? "My app" : "My project root",
    ...(target === "root"
      ? {
          workspaces: ["packages/*"],
        }
      : { version: "1.0.0" }),
    [target === "workspace"
      ? WORKSPACE_CONFIG_PACKAGE_JSON_KEY
      : ROOT_CONFIG_PACKAGE_JSON_KEY]: config,
  };
};

export const createTsFileExample = (
  config: object,
  target: "workspace" | "root",
) => {
  return `
import { ${target === "workspace" ? "defineWorkspaceConfig" : "defineRootConfig"} } from "bun-workspaces/config";

export default ${target === "workspace" ? "defineWorkspaceConfig" : "defineRootConfig"}(${JSON.stringify(
    config,
    null,
    2,
  ).replace(/"((\w|\s|\d)+)"(?=: )/g, "$1")});
`.trim();
};

export const MERGE_WORKSPACE_CONFIG_EXAMPLE = `
import { mergeWorkspaceConfig } from "bun-workspaces/config";

export default mergeWorkspaceConfig(
  { alias: "a", tags: ["x"] },
  { alias: "b", scripts: { build: { order: 1 } } },
  // Factory function receives the accumulated config up to that point
  (prevConfig) => ({ tags: ["y"] }),
);
`.trim();

export const MERGE_ROOT_CONFIG_EXAMPLE = `
import { mergeRootConfig } from "bun-workspaces/config";

export default mergeRootConfig(
  { defaults: { parallelMax: 4 } },
  { defaults: { shell: "system" } },
  // Factory function receives the accumulated config up to that point
  (prevConfig) => ({ defaults: { includeRootWorkspace: true } }),
);
`.trim();

export const WORKSPACE_PATTERN_CONFIGS_EXAMPLE = `
// bw.root.ts

import { defineRootConfig } from "bun-workspaces/config";

export default defineRootConfig({
  workspacePatternConfigs: [
    { 
      // Any matching workspaces under this path
      // will have their local config merged with this one
      patterns: ["path:libraries/frontend/**/*"],
      config: {
        tags: ["frontend"],
      },
    },
    {
      patterns: ["path:libraries/backend/**/*"],
      config: {
        tags: ["backend"],
      },
    },
    {
      // This tag can be matched thanks to the first entry,
      // merging the accumulated config with this one
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
      // You can use the raw workspace data and
      // accumulated config for each workspace via callback
      config: (workspace, prevConfig) => ({
        rules: {
          workspaceDependencies: workspace.name.startsWith("@some-scope/")
          ? {
              denyPatterns: ["@some-other-scope/*"],
            }
          : {
              allowPatterns: ["@some-scope/*"],
            }
        },
      }),
    }
  ],
});
`.trim();
