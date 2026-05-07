import {
  type WorkspaceInputsConfig,
  type RootConfig,
  type WorkspaceConfig,
} from "bw-common/config";
import {
  PARALLEL_MAX_VALUES,
  SCRIPT_SHELL_OPTIONS,
} from "bw-common/parameters";
import { type RequiredDeep } from "bw-common/types";
import { formatSimpleTypeToDisplay, type ValueToDisplay } from "./displayType";

const rootDisplay: ValueToDisplay<RequiredDeep<RootConfig>> = {
  defaults: {
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
        "The default git base ref for affected workspace resolution (default: main)",
      primitive: true,
      types: ["string"],
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

export const ROOT_CONFIG_TYPE =
  "type RootConfig = " +
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
    comment: "Default is all git-tracked files in the workspace directory",
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
