import { ROOT_WORKSPACE_SELECTOR } from "bw-common/project";
import { isJSONObject } from "bw-common/types";
import { getDoctorInfo } from "../../doctor";
import { sanitizeOutput } from "../../internal/core";
import { logger } from "../../internal/logger";
import {
  createJsonLines,
  commandOutputLogger,
  createScriptInfoLines,
  createWorkspaceInfoLines,
  handleProjectCommand,
  handleGlobalCommand,
  splitWhitespaceArg,
} from "./commandHandlerUtils";

export const doctor = handleGlobalCommand(
  "doctor",
  (_, options: { json: boolean; pretty: boolean }) => {
    logger.debug(`Options: ${JSON.stringify(options)}`);
    const info = getDoctorInfo();
    if (options.json) {
      commandOutputLogger.info(
        JSON.stringify(info, null, options.pretty ? 2 : undefined),
      );
    } else {
      const createEntryLine = ([key, value]: [
        key: string,
        value: unknown,
      ]): string => {
        const keyName = (
          key[0].toUpperCase() + key.slice(1).replace(/([A-Z])/g, " $1")
        ).replace(/os|cpu/gi, (m) => m.toUpperCase());

        return isJSONObject(value)
          ? keyName +
              ":\n - " +
              Object.entries(value).map(createEntryLine).join("\n - ")
          : `${keyName}: ${value}`;
      };

      commandOutputLogger.info(
        "bun-workspaces\n" +
          Object.entries(info).map(createEntryLine).join("\n"),
      );
    }
  },
);

export const listWorkspaces = handleProjectCommand(
  "listWorkspaces",
  (
    { project },
    positionalWorkspacePatterns: string[] | undefined,
    options: {
      workspacePatterns: string | undefined;
      nameOnly: boolean;
      json: boolean;
      pretty: boolean;
    },
  ) => {
    logger.debug(`Options: ${JSON.stringify(options)}`);

    const lines: string[] = [];

    if (
      positionalWorkspacePatterns?.length &&
      options.workspacePatterns?.length
    ) {
      logger.error(
        "CLI syntax error: Cannot use both inline workspace patterns and --workspace-patterns|-W option",
      );
      process.exit(1);
      return;
    }

    const patterns = positionalWorkspacePatterns?.length
      ? positionalWorkspacePatterns
      : splitWhitespaceArg(options.workspacePatterns ?? "");

    const workspaces = patterns?.length
      ? project.findWorkspacesByPattern(...patterns)
      : project.workspaces;

    if (options.json) {
      lines.push(
        ...createJsonLines(
          options.nameOnly ? workspaces.map(({ name }) => name) : workspaces,
          options,
        ),
      );
    } else {
      workspaces.forEach((workspace) => {
        if (options.nameOnly) {
          lines.push(sanitizeOutput(workspace.name));
        } else {
          lines.push(...createWorkspaceInfoLines(workspace));
        }
      });
    }

    if (!lines.length && !options.nameOnly) {
      logger.info("No workspaces found");
    }

    if (lines.length) commandOutputLogger.info(lines.join("\n"));
  },
);

export const listScripts = handleProjectCommand(
  "listScripts",
  (
    { project },
    options: { nameOnly: boolean; json: boolean; pretty: boolean },
  ) => {
    logger.debug(`Options: ${JSON.stringify(options)}`);

    const scripts = project.mapScriptsToWorkspaces();
    const lines: string[] = [];

    if (!project.workspaces.length && !options.nameOnly) {
      logger.info("No workspaces found");
      return;
    }

    if (!Object.keys(scripts).length && !options.nameOnly) {
      logger.info("No scripts found");
      return;
    }

    if (options.json) {
      lines.push(
        ...createJsonLines(
          options.nameOnly
            ? Object.keys(scripts)
            : Object.values(scripts).map(({ workspaces, ...rest }) => ({
                ...rest,
                workspaces: workspaces.map(({ name }) => name),
              })),
          options,
        ),
      );
    } else {
      Object.values(scripts)
        .sort(({ name: nameA }, { name: nameB }) => nameA.localeCompare(nameB))
        .forEach(({ name, workspaces }) => {
          if (options.nameOnly) {
            lines.push(sanitizeOutput(name));
          } else {
            lines.push(...createScriptInfoLines(name, workspaces));
          }
        });
    }

    if (lines.length) commandOutputLogger.info(lines.join("\n"));
  },
);

export const workspaceInfo = handleProjectCommand(
  "workspaceInfo",
  (
    { project },
    workspaceName: string,
    options: { json: boolean; pretty: boolean },
  ) => {
    logger.debug(`Options: ${JSON.stringify(options)}`);

    const workspace =
      workspaceName === ROOT_WORKSPACE_SELECTOR
        ? project.rootWorkspace
        : project.findWorkspaceByNameOrAlias(workspaceName);
    if (!workspace) {
      logger.error(`Workspace ${JSON.stringify(workspaceName)} not found`);
      process.exit(1);
      return;
    }

    commandOutputLogger.info(
      (options.json
        ? createJsonLines(workspace, options)
        : createWorkspaceInfoLines(workspace)
      ).join("\n"),
    );
  },
);

export const scriptInfo = handleProjectCommand(
  "scriptInfo",
  (
    { project },
    script: string,
    options: { workspacesOnly: boolean; json: boolean; pretty: boolean },
  ) => {
    logger.debug(`Options: ${JSON.stringify(options)}`);

    const scripts = project.mapScriptsToWorkspaces();
    const scriptMetadata = scripts[script];
    if (!scriptMetadata) {
      logger.error(`Script not found: ${JSON.stringify(script)}`);
      process.exit(1);
      return;
    }

    commandOutputLogger.info(
      (options.json
        ? createJsonLines(
            options.workspacesOnly
              ? scriptMetadata.workspaces.map(({ name }) => name)
              : {
                  name: scriptMetadata.name,
                  workspaces: scriptMetadata.workspaces.map(({ name }) => name),
                },
            options,
          )
        : options.workspacesOnly
          ? scriptMetadata.workspaces.map(({ name }) => sanitizeOutput(name))
          : createScriptInfoLines(script, scriptMetadata.workspaces)
      ).join("\n"),
    );
  },
);

export const listTags = handleProjectCommand(
  "listTags",
  (
    { project },
    options: { nameOnly: boolean; json: boolean; pretty: boolean },
  ) => {
    logger.debug(`Options: ${JSON.stringify(options)}`);
    const tagMap = project.mapTagsToWorkspaces();
    const tags = Object.entries(tagMap).map(([tag, workspaces]) => ({
      tag,
      workspaces: workspaces.map(({ name }) => name),
    }));

    const lines: string[] = [];

    if (options.json) {
      lines.push(
        ...createJsonLines(
          options.nameOnly ? tags.map(({ tag }) => tag) : tags,
          options,
        ),
      );
    } else {
      if (!Object.keys(tagMap).length && !options.nameOnly) {
        logger.info("No tags found");
        return;
      }

      tags.forEach(({ tag, workspaces }) => {
        if (options.nameOnly) {
          lines.push(sanitizeOutput(tag));
        } else {
          lines.push(
            `Tag: ${sanitizeOutput(tag)}\n${workspaces.map((name) => ` - ${sanitizeOutput(name)}`).join("\n")}`,
          );
        }
      });
    }

    if (lines.length) commandOutputLogger.info(lines.join("\n"));
  },
);

export const tagInfo = handleProjectCommand(
  "tagInfo",
  ({ project }, tag: string, options: { json: boolean; pretty: boolean }) => {
    logger.debug(`Options: ${JSON.stringify(options)}`);
    const tagMap = project.mapTagsToWorkspaces();
    const tagMetadata = tagMap[tag];

    if (!tagMetadata) {
      logger.error(`Tag not found: ${JSON.stringify(tag)}`);
      process.exit(1);
      return;
    }

    const tagInfo = {
      name: tag,
      workspaces: tagMetadata.map(({ name }) => name),
    };

    commandOutputLogger.info(
      options.json
        ? createJsonLines(tagInfo, options).join("\n")
        : `Tag: ${sanitizeOutput(tagInfo.name)}\n${tagInfo.workspaces.map((name) => ` - ${sanitizeOutput(name)}`).join("\n")}`,
    );
  },
);
