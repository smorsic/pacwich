import {
  type WorkspaceConfig,
  type ProjectConfig,
  WORKSPACE_CONFIG_PACKAGE_JSON_KEY,
  PROJECT_CONFIG_PACKAGE_JSON_KEY,
} from "@pacwich/common/config";

export const exampleProjectConfigSimple1: ProjectConfig = {
  defaults: {
    parallelMax: 4,
    affectedBaseRef: "my-branch",
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

export const exampleProjectConfigSimple2: ProjectConfig = {
  defaults: {
    parallelMax: "50%",
    shell: "bun",
    includeRootWorkspace: true,
    affectedBaseRef: "my-branch",
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
      : PROJECT_CONFIG_PACKAGE_JSON_KEY]: config,
  };
};

export const createTsFileExample = (
  config: object,
  target: "workspace" | "root",
) => {
  return `
import { ${target === "workspace" ? "defineWorkspaceConfig" : "defineProjectConfig"} } from "pacwich/config";

export default ${target === "workspace" ? "defineWorkspaceConfig" : "defineProjectConfig"}(${JSON.stringify(
    config,
    null,
    2,
  ).replace(/"((\w|\s|\d)+)"(?=: )/g, "$1")});
`.trim();
};

export const MERGE_WORKSPACE_CONFIG_EXAMPLE = `
import { mergeWorkspaceConfig } from "pacwich/config";

export default mergeWorkspaceConfig(
  {
    alias: "a",
    tags: ["x"],
    defaultInputs: { files: ["src/**/*.ts", "package.json"] },
    scripts: {
      build: { order: 1, inputs: { files: ["src/**/*.ts"] } },
      test: { order: 2 },
    },
    rules: { workspaceDependencies: { allowPatterns: ["tag:lib"] } },
    verify: { workspaceDependencies: { ignoreInputFiles: ["scripts/**/*"] } },
  },
  {
    alias: "b", // concatenated with "a"
    tags: ["x", "y"], // "x" deduplicated
    // whole object replaces the first config's defaultInputs
    defaultInputs: { files: ["src/**/*.ts", "!src/**/*.test.ts"] },
    scripts: {
      // build.order kept from the first config, but inputs is replaced
      // as a whole object ("src/**/*.ts" is gone unless restated)
      build: { inputs: { files: ["src/index.ts"] } },
    },
    rules: { workspaceDependencies: { denyPatterns: ["tag:app"] } },
    verify: {
      workspaceDependencies: {
        ignoreInputFiles: ["scripts/**/*", "legacy/**/*"], // concat + dedupe
        ignoreImportsFromWorkspacePatterns: ["tag:internal"],
      },
    },
  },
  // factory form reads the accumulated config so far
  (prevConfig) => ({
    tags: prevConfig.tags?.includes("y") ? ["frontend"] : [],
  }),
);

// result: {
//   alias: ["a", "b"],
//   tags: ["x", "y", "frontend"],
//   defaultInputs: { files: ["src/**/*.ts", "!src/**/*.test.ts"] },
//   scripts: {
//     build: { order: 1, inputs: { files: ["src/index.ts"] } },
//     test: { order: 2 },
//   },
//   rules: {
//     workspaceDependencies: {
//       allowPatterns: ["tag:lib"],
//       denyPatterns: ["tag:app"],
//     },
//   },
//   verify: {
//     workspaceDependencies: {
//       ignoreInputFiles: ["scripts/**/*", "legacy/**/*"],
//       ignoreImportsFromWorkspacePatterns: ["tag:internal"],
//     },
//   },
// }
`.trim();

export const MERGE_PROJECT_CONFIG_EXAMPLE = `
import { mergeProjectConfig } from "pacwich/config";

export default mergeProjectConfig(
  {
    packageManager: "bun",
    defaults: { parallelMax: 4, shell: "system" },
    workspacePatternConfigs: [
      { patterns: ["path:packages/apps/**/*"], config: { tags: ["app"] } },
    ],
    verify: {
      workspaceDependencies: {
        ignoreInputFiles: ["scripts/codegen/**/*"],
        ignoreImportsFromWorkspacePatterns: ["tag:legacy"],
      },
    },
  },
  {
    // fields under defaults merge individually: parallelMax overridden, shell kept
    defaults: { parallelMax: 8 },
    // appended after the first config's entries
    workspacePatternConfigs: [
      { patterns: ["tag:app"], config: { tags: ["deployable"] } },
    ],
    verify: {
      workspaceDependencies: {
        // "scripts/codegen/**/*" deduplicated, "legacy/**/*.ts" appended
        ignoreInputFiles: ["scripts/codegen/**/*", "legacy/**/*.ts"],
      },
    },
  },
  // factory form reads the accumulated config so far
  (prevConfig) => ({
    defaults: { includeRootWorkspace: prevConfig.packageManager === "bun" },
  }),
);

// result: {
//   packageManager: "bun",
//   defaults: { parallelMax: 8, shell: "system", includeRootWorkspace: true },
//   workspacePatternConfigs: [<app entry>, <deployable entry>],
//   verify: {
//     workspaceDependencies: {
//       ignoreInputFiles: ["scripts/codegen/**/*", "legacy/**/*.ts"],
//       ignoreImportsFromWorkspacePatterns: ["tag:legacy"],
//     },
//   },
// }
`.trim();

export const WORKSPACE_PATTERN_CONFIGS_EXAMPLE = `
// pacwich.root.ts

import { defineProjectConfig } from "pacwich/config";

export default defineProjectConfig({
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

export const INPUTS_FILES_EXAMPLE = `
// /path/to/your/project/workspace/pacwich.workspace.ts

import { defineWorkspaceConfig } from "pacwich/config";

export default defineWorkspaceConfig({
  // workspace's defaults
  "defaultInputs": {
    "files": [
      "src/**/*.ts", 
      "!src/**/*.test.ts", // ignore test files
      "/tsconfig.json" // relative to project root
    ],
  },
  // per-script
  "scripts": {
    "test": {
      "inputs": {
        "files": [
          "src/**/*.ts"
        ],
      },
    },
  },
});
`.trim();

export const INPUTS_WORKSPACE_PATTERNS_EXAMPLE = `
// /path/to/your/project/workspace/pacwich.workspace.ts

import { defineWorkspaceConfig } from "pacwich/config";

export default defineWorkspaceConfig({
  // workspace's defaults
  "defaultInputs": {
    "workspacePatterns": ["tag:my-tag"],
  },
  // per-script
  "scripts": {
    "build": {
      "inputs": {
        "workspacePatterns": ["path:my-path/**/*"],
      },
    },
  },
});
`.trim();

export const INPUTS_EXTERNAL_DEPENDENCIES_EXAMPLE = ` 
// /path/to/your/project/workspace/pacwich.workspace.ts

import { defineWorkspaceConfig } from "pacwich/config";

export default defineWorkspaceConfig({
  // workspace's defaults
  "defaultInputs": {
    "externalDependencies": ["lodash"],
  },
  // per-script
  "scripts": {
    "build": {
      "inputs": {
        "externalDependencies": ["lodash", "react"],
      },
    },
  },
});
`.trim();
