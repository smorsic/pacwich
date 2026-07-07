import {
  type WorkspaceInputsConfig,
  type ProjectConfig,
  type WorkspaceConfig,
} from "@pacwich/common/config";
import {
  PARALLEL_MAX_VALUES,
  SCRIPT_SHELL_OPTIONS,
} from "@pacwich/common/parameters";
import { type RequiredDeep } from "@pacwich/common/types";
import { formatSimpleTypeToDisplay, type ValueToDisplay } from "./displayType";

const rootDisplay: ValueToDisplay<RequiredDeep<ProjectConfig>> = {
  packageManager: {
    comment: "The package manager to use for the project",
    primitive: true,
    types: ["string"],
  },
  defaults: {
    cliScriptOutputStyle: {
      comment: "The default output style for CLI scripts",
      primitive: true,
      types: ["string"],
    },
    parallelMax: {
      comment: "The default maximum number of scripts that can run in parallel",
      primitive: true,
      types: ["number", "string"],
    },
    shell: {
      comment: "The default shell to use for inline scripts",
      primitive: true,
      types: ["string"],
    },
    includeRootWorkspace: {
      comment: "Whether to include the root workspace in the workspace list",
      primitive: true,
      types: ["boolean"],
    },
    affectedBaseRef: {
      comment:
        "The default git base ref for affected workspaces (default: main)",
      primitive: true,
      types: ["string"],
    },
    maxOutputBufferBytes: {
      value: 'number | "16MB" | "unbounded"',
      comment:
        "Max bytes of script output buffered in memory per stream (default: 16MB)",
    },
  },
  verify: {
    workspaceDependencies: {
      ignoreInputFiles: {
        comment:
          "Ignore these input files for verification of workspace dependencies",
        array: true,
        item: { primitive: true, types: ["string"] },
      },
    },
  },
  workspacePatternConfigs: {
    array: true,
    comment: "Apply workspace configs in bulk by using workspace patterns",
    item: {
      patterns: {
        array: true,
        item: { primitive: true, types: ["string"] },
      },
      config: {
        value: "WorkspaceConfig | WorkspacePatternConfigFactory",
      },
    },
  },
};

export const PROJECT_CONFIG_TYPE =
  "type ProjectConfig = " +
  formatSimpleTypeToDisplay(rootDisplay)
    .replace(
      "parallelMax?: number | string",
      "parallelMax?: number | `${number}%` | " +
        PARALLEL_MAX_VALUES.map((value) => `"${value}"`).join(" | "),
    )
    .replace(
      "shell?: string",
      "shell?: " +
        SCRIPT_SHELL_OPTIONS.map((value) => `"${value}"`).join(" | ") +
        ' | "default"',
    );

const inputsConfigDisplay = {
  comment: "Inputs for affected workspace resolution",
  files: {
    comment: "Default is all git-trackable files in the workspace directory",
    array: true,
    item: { primitive: true, types: ["string"] },
  },
  workspacePatterns: {
    comment: "Workspaces to treat like dependencies",
    array: true,
    item: { primitive: true, types: ["string"] },
  },
  externalDependencies: {
    comment:
      'Dependency names (e.g. "react") to treat as dependencies (default: all)',
    array: true,
    item: { primitive: true, types: ["string"] },
  },
} as ValueToDisplay<RequiredDeep<WorkspaceInputsConfig>>;

const workspaceDisplay: ValueToDisplay<RequiredDeep<WorkspaceConfig>> = {
  alias: {
    value: "string | string[]",
    comment: "Must be unique across other aliases and workspace names",
  },
  tags: {
    array: true,
    comment: "Tags can be used to group workspaces together",
    item: {
      primitive: true,
      types: ["string"],
    },
  },
  defaultInputs: inputsConfigDisplay,
  scripts: {
    "[script: string]": {
      order: {
        primitive: true,
        types: ["number"],
        comment: "Optional sorting order for running scripts",
      },
      inputs: inputsConfigDisplay,
    },
  },
  rules: {
    workspaceDependencies: {
      allowPatterns: {
        comment:
          "Use workspace patterns to match workspaces to allow as dependencies",
        array: true,
        item: { primitive: true, types: ["string"] },
      },
      denyPatterns: {
        comment:
          "Workspace patterns to forbid as dependencies.\nWhen combined with allowPatterns, filters within that allowed subset.",
        array: true,
        item: { primitive: true, types: ["string"] },
      },
    },
  },
};

export const WORKSPACE_CONFIG_TYPE =
  formatSimpleTypeToDisplay(workspaceDisplay);
