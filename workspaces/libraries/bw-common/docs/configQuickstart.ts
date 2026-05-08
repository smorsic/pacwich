export const ROOT_CONFIG_QUICKSTART = `
// bw.root.ts — place in your project root directory
// Also supported: bw.root.js, bw.root.json, bw.root.jsonc, 
// or a "bw-root" key in package.json

import { defineRootConfig } from "bun-workspaces/config";

export default defineRootConfig({
  defaults: {
    // default value for --parallel option
    parallelMax: 4,
    // default value for --shell option
    shell: "system",
    // default value for global --include-root-workspace option
    includeRootWorkspace: false,
  },

  // Apply workspace configs in bulk by workspace pattern, in order.
  // Each entry merges into matching workspaces' accumulated config.
  // Pattern matching reflects aliases and tags added by earlier entries.
  workspacePatternConfigs: [
    {
      patterns: ["path:packages/apps/**/*"],
      config: { tags: ["app"] },
    },
    {
      patterns: ["path:packages/libs/**/*"],
      config: { tags: ["lib"] },
    },
    {
      // "tag:app" matches because the first entry added it
      patterns: ["tag:app"],
      config: {
        // Inputs always override previous entries instead of deep merging
        defaultInputs: { files: ["src/**/*.ts"] },
        scripts: {
          build: { order: 1, inputs: { files: ["src/**/*.ts"] } },
        },
        rules: {
          workspaceDependencies: {
            allowPatterns: ["tag:lib"], // apps may only depend on libs
          },
        },
      },
    },
    {
      patterns: ["tag:app"],
      // Factory form: receives static workspace data and accumulated config
      config: (workspace, prevConfig) => ({
        alias: workspace.name.replace(/^@my-scope\\//, ""),
      }),
    },
  ],
});
`.trim();

export const WORKSPACE_CONFIG_QUICKSTART = `
// bw.workspace.ts — place in a workspace directory

// Also supported: bw.workspace.js, bw.workspace.json, bw.workspace.jsonc, 
// or a "bw" key in package.json

import { defineWorkspaceConfig } from "bun-workspaces/config";

export default defineWorkspaceConfig({
  alias: "my-web-app", // shorthand name; use array for multiple
  tags: ["app", "frontend"],
  // Optional, for configuring affected workspace resolution inputs
  // Applies to all scripts that don't configure their own inputs
  defaultInputs: { 
    // File paths, directory paths, or globs relative to the workspace's path.
    // Default is all git-trackable files in the workspace directory.
    files: ["src/**/*.ts", "!src/**/*.test.ts"],
    // Workspaces to treat like dependencies that aren't package.json dependencies
    workspacePatterns: ["tag:lib"],
    // Dependency names (e.g. "react") to treat as dependencies (default: all)
    externalDependencies: ["react"],
  },
  scripts: {
    // lower order runs first in sequenced script execution
    build: {
      // Optional, for setting the default script execution order
      order: 1, 
      // Optional, for configuring affected workspace resolution inputs
      // Applies to the build script only
      inputs: { files: ["src/**/*.ts"] } 
    },
    test: { order: 2 },
  },
  rules: {
    workspaceDependencies: {
      // Only "my-workspace" or workspaces tagged "lib" are allowed as dependencies
      allowPatterns: ["tag:lib", "my-workspace"],
      // Workspaces tagged "backend" are forbidden as dependencies
      denyPatterns: ["tag:backend"],
    },
  },
});
`.trim();
