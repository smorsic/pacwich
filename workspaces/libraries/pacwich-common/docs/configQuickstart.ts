export const PROJECT_CONFIG_QUICKSTART = `
// pacwich.project.ts - placed in your project root directory

// Also supported: pacwich.project.js, pacwich.project.json, pacwich.project.jsonc,
// or a "pacwich-root" key in package.json

import { defineRootConfig } from "pacwich/config";

export default defineRootConfig({
  defaults: {
    // default value for --parallel option
    parallelMax: 4,
    // default value for --shell option
    shell: "system",
    // default value for global --include-root-workspace option
    includeRootWorkspace: false,
  },

  // Configure the verify feature
  verify: {
    workspaceDependencies: {
      // Exclude paths from import/export scanning across the project
      ignoreInputFiles: ["**/*.d.ts"],
      // Ignore imports from specific workspaces
      ignoreImportsFromWorkspacePatterns: ["tag:internal"],
    },
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
// pacwich.workspace.ts - placed in a workspace directory

// Also supported: pacwich.workspace.js, pacwich.workspace.json, pacwich.workspace.jsonc,
// or a "pacwich" key in package.json

import { defineWorkspaceConfig } from "pacwich/config";

export default defineWorkspaceConfig({
  // Shorthand name. use array for multiple
  // Must be unique across workspace names and other aliases
  alias: "my-web-app", 

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

  // Configure the verify feature for this workspace
  // This is additive with any project-level verify configuration
  verify: {
    workspaceDependencies: {
      // Exclude paths from import/export scanning, relative to the workspace path
      // Use a leading / for project-relative paths
      ignoreInputFiles: ["**/*.d.ts"],
      // Ignore imports from specific workspaces
      ignoreImportsFromWorkspacePatterns: ["tag:internal"],
    },
  },

  scripts: {
    // lower order runs first in sequenced script execution
    build: {
      // Optional, for setting the default script execution order
      order: 1,
      // Optional, for configuring affected workspace resolution inputs
      // Applies to the build script only
      inputs: { files: ["src/**/*.ts"] },
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
