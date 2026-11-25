import { logger } from "../../internal/logger";
import { resolveRootWorkspaceSelector } from "../../project/implementations/projectBase";
import {
  commandOutputLogger,
  createJsonLines,
  handleProjectCommand,
  splitWhitespaceArg,
} from "./commandHandlerUtils";

export type ConfigDebugCliOptions = {
  project: boolean;
  workspace: string | undefined;
  workspacePatterns: string | undefined;
  pretty: boolean;
};

export const configDebug = handleProjectCommand(
  "configDebug",
  ({ project }, options: ConfigDebugCliOptions) => {
    logger.debug(`Options: ${JSON.stringify(options)}`);

    const scopeCount = [
      options.project,
      options.workspace !== undefined,
      options.workspacePatterns !== undefined,
    ].filter(Boolean).length;
    if (scopeCount > 1) {
      logger.error(
        'CLI syntax error: --project, --workspace, and --workspace-patterns cannot be combined. Run "pacwich config debug" with no flags to see everything.',
      );
      process.exit(1);
      return;
    }

    // print project config and exit
    if (options.project) {
      commandOutputLogger.info(
        createJsonLines(project.config.project, options).join("\n"),
      );
      return;
    }

    // print single workspace config and exit
    if (options.workspace !== undefined) {
      const workspace = resolveRootWorkspaceSelector(
        options.workspace,
        project,
      );
      if (!workspace) {
        logger.error(
          `Workspace ${JSON.stringify(options.workspace)} not found`,
        );
        process.exit(1);
        return;
      }
      commandOutputLogger.info(
        createJsonLines(
          project.config.workspaces[workspace.name],
          options,
        ).join("\n"),
      );
      return;
    }

    // print workspace patterns config and exit
    if (options.workspacePatterns !== undefined) {
      const matched = project.findWorkspacesByPattern(
        ...splitWhitespaceArg(options.workspacePatterns),
      );
      const workspaces = Object.fromEntries(
        matched.map((workspace) => [
          workspace.name,
          project.config.workspaces[workspace.name],
        ]),
      );
      commandOutputLogger.info(createJsonLines(workspaces, options).join("\n"));
      return;
    }

    // print all config and exit
    commandOutputLogger.info(
      createJsonLines(
        {
          project: project.config.project,
          workspaces: project.config.workspaces,
        },
        options,
      ).join("\n"),
    );
  },
);
