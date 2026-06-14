import { getWorkspaceScriptMetadataConfig } from "@pacwich/common/runScript";

export const checkIsRecursiveScript = (
  workspaceName: string,
  scriptName: string,
) => {
  const parentWorkspace =
    process.env[getWorkspaceScriptMetadataConfig("workspaceName").envVarName];
  const parentScript =
    process.env[getWorkspaceScriptMetadataConfig("scriptName").envVarName];
  if (!parentWorkspace || !parentScript) {
    return false;
  }
  if (parentWorkspace === workspaceName && parentScript === scriptName) {
    return true;
  }
};
