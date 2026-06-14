export interface WorkspaceScriptMetadata {
  projectPath: string;
  projectName: string;
  workspacePath: string;
  workspaceRelativePath: string;
  workspaceName: string;
  scriptName: string;
}

const WORKSPACE_SCRIPT_METADATA_CONFIG = {
  projectPath: {
    inlineName: "<projectPath>",
    envVarName: "PACWICH_PROJECT_PATH",
  },
  projectName: {
    inlineName: "<projectName>",
    envVarName: "PACWICH_PROJECT_NAME",
  },
  workspacePath: {
    inlineName: "<workspacePath>",
    envVarName: "PACWICH_WORKSPACE_PATH",
  },
  workspaceRelativePath: {
    inlineName: "<workspaceRelativePath>",
    envVarName: "PACWICH_WORKSPACE_RELATIVE_PATH",
  },
  scriptName: {
    inlineName: "<scriptName>",
    envVarName: "PACWICH_SCRIPT_NAME",
  },
  workspaceName: {
    inlineName: "<workspaceName>",
    envVarName: "PACWICH_WORKSPACE_NAME",
  },
} as const;

/** A metadata key readable via `getWorkspaceScriptMetadata` (e.g. `"workspaceName"`, `"projectPath"`). */
export type WorkspaceScriptMetadataKey =
  keyof typeof WORKSPACE_SCRIPT_METADATA_CONFIG;

export const validateWorkspaceScriptMetadataKey = (key: string) => {
  if (!(key in WORKSPACE_SCRIPT_METADATA_CONFIG)) {
    throw new Error(`Invalid workspace script metadata key: ${key}`);
  }
};

export const getWorkspaceScriptMetadataConfig = (
  key: WorkspaceScriptMetadataKey,
) => {
  validateWorkspaceScriptMetadataKey(key);
  return WORKSPACE_SCRIPT_METADATA_CONFIG[key];
};
