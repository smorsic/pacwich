import { getWorkspaceScriptMetadata } from "../../../../../src/runScript/public";

const keys = [
  "projectPath",
  "projectName",
  "workspacePath",
  "workspaceRelativePath",
  "workspaceName",
  "scriptName",
] as const;

const result: Record<string, string> = {};
for (const key of keys) {
  result[key] = getWorkspaceScriptMetadata(key);
}

console.log(JSON.stringify(result));
