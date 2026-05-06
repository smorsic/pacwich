import { logger } from "../../internal/logger";
import type {
  AffectedDependency,
  AffectedWorkspaceResult,
  AffectedWorkspacesMetadata,
  DetermineAffectedWorkspacesOptions,
} from "../../project";
import {
  commandOutputLogger,
  createJsonLines,
  handleProjectCommand,
  splitWorkspacePatterns,
} from "./commandHandlerUtils";

const SHORT_SHA_LENGTH = 7;

const shortSha = (sha: string): string => sha.slice(0, SHORT_SHA_LENGTH);

const formatGitHeader = (
  metadata: AffectedWorkspacesMetadata,
): string | null => {
  if (metadata.diffSource !== "git" || !metadata.git) return null;
  const { baseRef, headRef, baseSha, headSha } = metadata.git;
  return [
    `Base: ${baseRef} (${shortSha(baseSha)})`,
    `Head: ${headRef} (${shortSha(headSha)})`,
  ].join("\n");
};

const formatDependencyChain = (dependency: AffectedDependency): string => {
  const segments = dependency.chain.map((entry, index) => {
    if (index === 0 || !entry.edgeSource) return entry.workspaceName;
    return `--[${entry.edgeSource}]--> ${entry.workspaceName}`;
  });
  return segments.join(" ");
};

const createWorkspaceSummaryLines = (
  result: AffectedWorkspaceResult,
): string[] => {
  const { workspace, affectedReasons } = result;
  const lines: string[] = [`Workspace: ${workspace.name}`];
  const fileCount = affectedReasons.changedFiles.length;
  lines.push(
    ` - Changed files: ${fileCount}${
      fileCount === 0
        ? ""
        : `\n${affectedReasons.changedFiles
            .map(({ projectFilePath }) => `   - ${projectFilePath}`)
            .join("\n")}`
    }`,
  );
  if (affectedReasons.dependencies.length) {
    lines.push(
      ` - Affected dependencies: ${affectedReasons.dependencies
        .map(({ dependencyName }) => dependencyName)
        .join(", ")}`,
    );
  } else {
    lines.push(` - Affected dependencies: (none)`);
  }
  return lines;
};

const createWorkspaceDetailedLines = (
  result: AffectedWorkspaceResult,
): string[] => {
  const { workspace, affectedReasons } = result;
  const lines: string[] = [`Workspace: ${workspace.name}`];
  if (affectedReasons.changedFiles.length) {
    lines.push(" - Changed files:");
    for (const file of affectedReasons.changedFiles) {
      const reasons = file.gitReasons?.length
        ? ` [${file.gitReasons.join(", ")}]`
        : "";
      lines.push(
        `   - ${file.projectFilePath} (matched by ${JSON.stringify(file.inputMatch)})${reasons}`,
      );
    }
  } else {
    lines.push(" - Changed files: (none)");
  }
  if (affectedReasons.dependencies.length) {
    lines.push(" - Affected dependencies:");
    for (const dependency of affectedReasons.dependencies) {
      lines.push(`   - ${dependency.dependencyName}`);
      lines.push(`     chain: ${formatDependencyChain(dependency)}`);
    }
  } else {
    lines.push(" - Affected dependencies: (none)");
  }
  return lines;
};

export const listAffected = handleProjectCommand(
  "listAffected",
  async (
    { project },
    options: {
      base: string | undefined;
      head: string | undefined;
      files: string | undefined;
      script: string | undefined;
      ignoreUntracked: boolean;
      ignoreUnstaged: boolean;
      ignoreStaged: boolean;
      ignoreUncommitted: boolean;
      explain: boolean;
      detailed: boolean;
      json: boolean;
      pretty: boolean;
    },
  ) => {
    logger.debug(`Options: ${JSON.stringify(options)}`);

    if (options.files !== undefined && (options.base || options.head)) {
      logger.error(
        "CLI syntax error: --files cannot be used with --base or --head",
      );
      process.exit(1);
      return;
    }

    if (options.detailed && !options.explain) {
      logger.error("CLI syntax error: --detailed requires --explain");
      process.exit(1);
      return;
    }

    const determineOptions: DetermineAffectedWorkspacesOptions =
      options.files !== undefined
        ? {
            diffSource: "fileList",
            changedFiles: splitWorkspacePatterns(options.files),
            script: options.script,
          }
        : {
            diffSource: "git",
            script: options.script,
            diffOptions: {
              baseRef: options.base,
              headRef: options.head,
              ignoreUntracked: options.ignoreUntracked || undefined,
              ignoreUnstaged: options.ignoreUnstaged || undefined,
              ignoreStaged: options.ignoreStaged || undefined,
              ignoreUncommitted: options.ignoreUncommitted || undefined,
            },
          };

    const result = await project.determineAffectedWorkspaces(determineOptions);
    const affectedResults = result.workspaceResults.filter(
      ({ isAffected }) => isAffected,
    );

    if (options.json) {
      const payload = options.explain
        ? result
        : affectedResults.map(({ workspace }) => workspace.name);
      commandOutputLogger.info(createJsonLines(payload, options).join("\n"));
      return;
    }

    if (!options.explain) {
      if (affectedResults.length) {
        commandOutputLogger.info(
          affectedResults.map(({ workspace }) => workspace.name).join("\n"),
        );
      } else {
        logger.info("No affected workspaces");
      }
      return;
    }

    const lines: string[] = [];
    const gitHeader = formatGitHeader(result.metadata);
    if (gitHeader) lines.push(gitHeader, "");

    if (!affectedResults.length) {
      lines.push("No affected workspaces");
    } else {
      const renderWorkspace = options.detailed
        ? createWorkspaceDetailedLines
        : createWorkspaceSummaryLines;
      for (const workspaceResult of affectedResults) {
        lines.push(...renderWorkspace(workspaceResult));
      }
    }

    commandOutputLogger.info(lines.join("\n"));
  },
);
