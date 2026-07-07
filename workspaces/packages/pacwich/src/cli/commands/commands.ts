import { addSkills } from "./addSkills";
import type {
  GlobalCommandContext,
  ProjectCommandContext,
} from "./commandHandlerUtils";
import { completion } from "./completion";
import {
  listScripts,
  workspaceInfo,
  scriptInfo,
  listWorkspaces,
  doctor,
  listTags,
  tagInfo,
  configInfo,
} from "./handleSimpleCommands";
import { listAffected } from "./listAffected";
import { mcpServer } from "./mcp";
import { runAffected, runInteractive, runScript } from "./runScript";
import { verify } from "./verify";

export const defineGlobalCommands = (context: GlobalCommandContext) => {
  mcpServer(context);
  doctor(context);
  addSkills(context);
  completion(context);
};

export const defineProjectCommands = (context: ProjectCommandContext) => {
  listWorkspaces(context);
  listScripts(context);
  workspaceInfo(context);
  scriptInfo(context);
  listTags(context);
  tagInfo(context);
  configInfo(context);
  runScript(context);
  listAffected(context);
  runAffected(context);
  runInteractive(context);
  verify(context);
};
