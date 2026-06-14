import toolVersionsJson from "./toolVersions.json" with { type: "json" };

export type ToolVersionData = {
  endUserRequirement: string;
  devLock: string;
};

export const TOOL_VERSIONS = toolVersionsJson satisfies Record<
  string,
  ToolVersionData
>;

export type ToolName = keyof typeof TOOL_VERSIONS;

export const TOOL_NAMES = Object.keys(TOOL_VERSIONS) as ToolName[];

export const getToolVersionData = (toolName: ToolName): ToolVersionData =>
  TOOL_VERSIONS[toolName];

export const getToolEndUserVersion = (toolName: ToolName) =>
  TOOL_VERSIONS[toolName].endUserRequirement;

export const getToolDevLockVersion = (toolName: ToolName) =>
  TOOL_VERSIONS[toolName].devLock;
