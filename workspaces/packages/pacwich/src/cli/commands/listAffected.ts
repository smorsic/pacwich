import path from "path";
import { stripANSI } from "../../internal/core";
import { logger } from "../../internal/logger";
import type {
  AffectedDependency,
  AffectedWorkspaceResult,
  AffectedWorkspacesMetadata,
  DetermineAffectedWorkspacesOptions,
  ExternalDependencyChange,
} from "../../project";
import {
  commandOutputLogger,
  createJsonLines,
  handleProjectCommand,
  splitWhitespaceArg,
  type ProjectCommandContext,
} from "./commandHandlerUtils";

const SHORT_SHA_LENGTH = 7;

const shortSha = (sha: string): string => sha.slice(0, SHORT_SHA_LENGTH);

const formatGitHeader = (
  metadata: AffectedWorkspacesMetadata,
): string | null => {
  if (metadata.diffSource !== "git" || !metadata.git) return null;
  const { baseRef, headRef, baseSha, headSha } = metadata.git;
  return [
    `Git base ref: \x1b[1m${baseRef}\x1b[0m (${shortSha(baseSha)})`,
    `Git head ref: \x1b[1m${headRef}\x1b[0m (${shortSha(headSha)})`,
  ].join("\n");
};

const formatDependencyChain = (dependency: AffectedDependency): string => {
  const segments = dependency.chain.map((entry, index) => {
    const safeName = stripANSI(entry.workspaceName);
    if (index === 0 || !entry.edgeSource) return safeName;
    return `\x1b[90m--[${entry.edgeSource}]->\x1b[0m ${safeName}`;
  });
  return segments.join(" ");
};

const formatSourceMarker = (change: ExternalDependencyChange): string =>
  change.source === "devDependencies" ? " (dev)" : "";

const formatExternalDepEntryShort = (
  change: ExternalDependencyChange,
): string => `${stripANSI(change.name)}${formatSourceMarker(change)}`;

const formatExternalDepEntryDetailed = (
  change: ExternalDependencyChange,
): string => {
  const versions =
    change.baseVersion === null && change.headVersion === null
      ? "lockfile changed; precise diff unavailable"
      : `${stripANSI(change.baseVersion ?? "(absent)")} -> ${stripANSI(change.headVersion ?? "(absent)")}`;
  return `${stripANSI(change.name)}${formatSourceMarker(change)} \x1b[90m[${versions}]\x1b[0m`;
};

const createWorkspaceSummaryLines = (
  result: AffectedWorkspaceResult,
): string[] => {
  const { workspace, affectedReasons } = result;
  const lines: string[] = [
    `\x1b[1mWorkspace: ${stripANSI(workspace.name)}\x1b[0m`,
    `Path: ${stripANSI(workspace.path)}`,
  ];
  lines.push(
    `\x1b[96mChanged input files:\x1b[0m ${affectedReasons.changedFiles.length}`,
  );
  if (affectedReasons.dependencies.length) {
    lines.push(
      `\x1b[96mAffected dependencies:\x1b[0m ${affectedReasons.dependencies
        .map(({ dependencyName }) => stripANSI(dependencyName))
        .join(", ")}`,
    );
  } else {
    lines.push(`\x1b[96mAffected dependencies:\x1b[0m (none)`);
  }
  if (affectedReasons.externalDependencies.length) {
    lines.push(
      `\x1b[96mChanged external dependencies:\x1b[0m ${affectedReasons.externalDependencies
        .map(formatExternalDepEntryShort)
        .join(", ")}`,
    );
  } else {
    lines.push(`\x1b[96mChanged external dependencies:\x1b[0m (none)`);
  }
  return lines;
};

const createWorkspaceDetailedLines = (
  result: AffectedWorkspaceResult,
): string[] => {
  const { workspace, affectedReasons } = result;
  const lines: string[] = [
    `\x1b[1mWorkspace: ${stripANSI(workspace.name)}\x1b[0m`,
    `Path: ${stripANSI(workspace.path)}`,
  ];
  if (affectedReasons.changedFiles.length) {
    lines.push("\x1b[96mChanged input files:\x1b[0m");
    for (const file of affectedReasons.changedFiles) {
      const reasons = file.gitReasons
        ?.filter((reason) => reason !== "diff")
        .join(", ");
      lines.push(
        ` - ${stripANSI(path.relative(workspace.path, file.projectFilePath))} \x1b[90m(input: ${JSON.stringify(file.inputMatch)})${reasons ? ` [${reasons}]` : ""}\x1b[0m`,
      );
    }
  } else {
    lines.push("\x1b[96mChanged input files:\x1b[0m (none)");
  }
  if (affectedReasons.dependencies.length) {
    lines.push("\x1b[96mAffected dependencies:\x1b[0m");
    for (const dependency of affectedReasons.dependencies) {
      lines.push(` - ${stripANSI(dependency.dependencyName)}`);
      lines.push(`   chain: ${formatDependencyChain(dependency)}`);
    }
  } else {
    lines.push("\x1b[96mAffected dependencies:\x1b[0m (none)");
  }
  if (affectedReasons.externalDependencies.length) {
    lines.push("\x1b[96mChanged external dependencies:\x1b[0m");
    for (const change of affectedReasons.externalDependencies) {
      lines.push(` - ${formatExternalDepEntryDetailed(change)}`);
    }
  } else {
    lines.push("\x1b[96mChanged external dependencies:\x1b[0m (none)");
  }
  return lines;
};

export type ListAffectedCliOptions = {
  base: string | undefined;
  head: string | undefined;
  files: string | undefined;
  script: string | undefined;
  ignoreUntracked: boolean;
  ignoreUnstaged: boolean;
  ignoreStaged: boolean;
  ignoreUncommitted: boolean;
  ignoreWorkspaceDeps: boolean;
  ignoreExternalDeps: boolean;
  explain: boolean;
  detailed: boolean;
  json: boolean;
  pretty: boolean;
};

/**
 * Shared implementation behind both `list-affected` (deprecated) and
 * `affected list`.
 */
export const handleListAffected = async (
  { project }: Pick<ProjectCommandContext, "project">,
  options: ListAffectedCliOptions,
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
          changedFiles: splitWhitespaceArg(options.files),
          script: options.script,
          ignoreWorkspaceDependencies: options.ignoreWorkspaceDeps || undefined,
          ignoreExternalDependencies: options.ignoreExternalDeps || undefined,
        }
      : {
          diffSource: "git",
          script: options.script,
          ignoreWorkspaceDependencies: options.ignoreWorkspaceDeps || undefined,
          ignoreExternalDependencies: options.ignoreExternalDeps || undefined,
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
        affectedResults
          .map(({ workspace }) => stripANSI(workspace.name))
          .join("\n"),
      );
    } else {
      logger.info("No affected workspaces");
    }
    return;
  }

  const lines: string[] = [""];
  const gitHeader = formatGitHeader(result.metadata);
  if (gitHeader) lines.push(gitHeader, "");

  if (!affectedResults.length) {
    lines.push("No affected workspaces");
  } else {
    const renderWorkspace = options.detailed
      ? createWorkspaceDetailedLines
      : createWorkspaceSummaryLines;
    for (const workspaceResult of affectedResults) {
      lines.push(...renderWorkspace(workspaceResult), "");
    }

    if (!options.detailed) {
      // gray
      lines.push("\x1b[90mPass --detailed for more info\x1b[0m");
    }
  }

  commandOutputLogger.info(lines.join("\n"));
};

export const listAffectedDeprecated = handleProjectCommand(
  "listAffected",
  async (context, options: ListAffectedCliOptions) => {
    logger.warn("DeprecatedListAffectedCliCommand", {});
    await handleListAffected(context, options);
  },
);

export const affectedList = handleProjectCommand(
  "affectedList",
  handleListAffected,
);
