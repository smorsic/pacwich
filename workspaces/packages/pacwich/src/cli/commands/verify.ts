import type { WarningId } from "@pacwich/common/warnings";
import { logger } from "../../internal/logger";
import type { VerifyIssueName } from "../../project";
import {
  commandOutputLogger,
  createJsonLines,
  handleProjectCommand,
} from "./commandHandlerUtils";

type VerifyWarningId = Extract<WarningId, `VerifyIssue.${string}`>;

/** The namespaced `VerifyIssue.*` warning id each finding category emits. */
const WARNING_ID_BY_ISSUE_NAME: Record<VerifyIssueName, VerifyWarningId> = {
  implicitWorkspaceDependency: "VerifyIssue.ImplicitWorkspaceDependency",
  ancestorWorkspaceDependency: "VerifyIssue.AncestorWorkspaceDependency",
};

export const verify = handleProjectCommand(
  "verify",
  async (
    { project },
    positionalWorkspacePatterns: string[] | undefined,
    options: {
      strict: boolean;
      json: boolean;
      pretty: boolean;
    },
  ) => {
    logger.debug(`Options: ${JSON.stringify(options)}`);

    const result = await project.verify({
      strict: options.strict,
      ...(positionalWorkspacePatterns?.length && {
        workspacePatterns: positionalWorkspacePatterns,
      }),
    });

    if (options.json) {
      commandOutputLogger.info(createJsonLines(result, options).join("\n"));
      if (!result.ok) process.exit(1);
      return;
    }

    if (result.errors.length === 0 && result.warnings.length === 0) {
      commandOutputLogger.info("No verify issues found.");
      return;
    }

    for (const issue of result.warnings) {
      logger.warn(WARNING_ID_BY_ISSUE_NAME[issue.name], {
        message: issue.message,
      });
    }
    for (const issue of result.errors) {
      logger.error(issue.message);
    }

    const errorCount = result.errors.length;
    const warningCount = result.warnings.length;
    const parts: string[] = [];
    if (errorCount > 0) {
      parts.push(`${errorCount} error${errorCount === 1 ? "" : "s"}`);
    }
    if (warningCount > 0) {
      parts.push(`${warningCount} warning${warningCount === 1 ? "" : "s"}`);
    }
    const summary = `Verify finished with ${parts.join(", ")}.`;

    if (!options.strict && warningCount > 0 && errorCount === 0) {
      commandOutputLogger.info(
        `${summary}\nRe-run with \x1b[1m--strict\x1b[0m to make warnings fail, or address each warning above.`,
      );
    } else {
      commandOutputLogger.info(summary);
    }

    if (!result.ok) process.exit(1);
  },
);
