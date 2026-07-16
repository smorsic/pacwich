import { addSkills } from "./addSkills";
import { affected } from "./affected";
import type {
  GlobalCommandContext,
  ProjectCommandContext,
} from "./commandHandlerUtils";
import { completion, completionInstall } from "./completion";
import { config } from "./config";
import { configDebug } from "./configDebug";
import {
  listScripts,
  workspaceInfo,
  scriptInfo,
  listWorkspaces,
  doctor,
  listTags,
  tagInfo,
} from "./handleSimpleCommands";
import { affectedList, listAffectedDeprecated } from "./listAffected";
import { mcpServer } from "./mcp";
import {
  affectedRun,
  runAffectedDeprecated,
  runInteractive,
  runScript,
} from "./runScript";
import { verify } from "./verify";

export const defineGlobalCommands = (context: GlobalCommandContext) => {
  mcpServer(context);
  doctor(context);
  addSkills(context);
  completion(context);
  completionInstall(context);
};

export const defineProjectCommands = (context: ProjectCommandContext) => {
  listWorkspaces(context);
  listScripts(context);
  workspaceInfo(context);
  scriptInfo(context);
  listTags(context);
  tagInfo(context);
  runScript(context);
  listAffectedDeprecated(context);
  runAffectedDeprecated(context);
  affected(context);
  affectedList(context);
  affectedRun(context);
  runInteractive(context);
  verify(context);
  config(context);
  configDebug(context);
};
