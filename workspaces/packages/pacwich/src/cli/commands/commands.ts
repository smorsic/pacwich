import { addSkills } from "./addSkills";
import type {
  GlobalCommandContext,
  ProjectCommandContext,
} from "./commandHandlerUtils";
import {
  listScripts,
  workspaceInfo,
  scriptInfo,
  listWorkspaces,
  doctor,
  listTags,
  tagInfo,
} from "./handleSimpleCommands";
import { listAffected } from "./listAffected";
import { mcpServer } from "./mcp";
import { runAffected, runScript } from "./runScript";
import { verify } from "./verify";

export const defineGlobalCommands = (context: GlobalCommandContext) => {
  mcpServer(context);
  doctor(context);
  addSkills(context);
};

export const defineProjectCommands = (context: ProjectCommandContext) => {
  listWorkspaces(context);
  listScripts(context);
  workspaceInfo(context);
  scriptInfo(context);
  listTags(context);
  tagInfo(context);
  runScript(context);
  listAffected(context);
  runAffected(context);
  verify(context);
};
