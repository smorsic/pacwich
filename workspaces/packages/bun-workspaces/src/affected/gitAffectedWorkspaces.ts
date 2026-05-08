import fs from "fs";
import path from "path";
import {
  parseBunLockPackageVersions,
  type BunLockVersionMap,
} from "../internal/bun/bunLock";
import { BunWorkspacesError } from "../internal/core";
import { logger } from "../internal/logger";
import type { Workspace } from "../workspaces";
import { computeExternalDependencyChanges } from "./externalDependencyChanges";
import {
  getFileAffectedWorkspaces,
  type AffectedWorkspaceResult,
  type FileAffectedWorkspacesOptions,
} from "./fileAffectedWorkspaces";
import {
  getGitAffectedFiles,
  readProjectFileAtGitRef,
  type GetGitAffectedFilesOptions,
  type GitAffectedFile,
} from "./gitAffectedFiles";

export type GitAffectedWorkspacesOptions = {
  /** Project root, used for both git resolution and workspace path normalization. */
  rootDirectory: string;
  workspacesOptions: Omit<
    FileAffectedWorkspacesOptions,
    "rootDirectory" | "changedFilePaths" | "externalDepChangesByWorkspace"
  > & {
    /**
     * All workspaces in the project — required for external dep version
     * tracking. Pass an empty array (or omit and pass
     * `ignoreExternalDependencies`) to disable that path.
     */
    workspaces?: Workspace[];
    /** Whether to skip lockfile-based external dep version tracking */
    ignoreExternalDependencies?: boolean;
  };
  gitOptions: Omit<GetGitAffectedFilesOptions, "rootDirectory">;
};

export type GitFileMetadata = {
  git: GitAffectedFile;
};

export type GitAffectedWorkspaceResult =
  AffectedWorkspaceResult<GitFileMetadata>;

export type GitAffectedWorkspacesResult = {
  affectedWorkspaces: GitAffectedWorkspaceResult[];
  /** The full SHA the `baseRef` resolves to */
  baseSha: string;
  /** The full SHA the `headRef` resolves to */
  headSha: string;
};

const BUN_LOCK_PROJECT_RELATIVE_PATH = "bun.lock";

const readCurrentBunLock = (rootDirectory: string): string | null => {
  const lockPath = path.join(rootDirectory, BUN_LOCK_PROJECT_RELATIVE_PATH);
  try {
    return fs.readFileSync(lockPath, "utf8");
  } catch {
    return null;
  }
};

const loadVersionsAt = async (
  rootDirectory: string,
  ref: string,
): Promise<BunLockVersionMap> => {
  const contents = await readProjectFileAtGitRef({
    rootDirectory,
    ref,
    projectRelativePath: BUN_LOCK_PROJECT_RELATIVE_PATH,
  });
  if (contents === null) return new Map();
  const parsed = parseBunLockPackageVersions(contents);
  if (parsed instanceof BunWorkspacesError) {
    logger.warn(
      `Could not parse bun.lock at ref "${ref}": ${parsed.message}. Treating as empty.`,
    );
    return new Map();
  }
  return parsed;
};

const loadCurrentVersions = (rootDirectory: string): BunLockVersionMap => {
  const contents = readCurrentBunLock(rootDirectory);
  if (contents === null) return new Map();
  const parsed = parseBunLockPackageVersions(contents);
  if (parsed instanceof BunWorkspacesError) {
    logger.warn(
      `Could not parse current bun.lock: ${parsed.message}. Treating as empty.`,
    );
    return new Map();
  }
  return parsed;
};

export const getGitAffectedWorkspaces = async ({
  rootDirectory,
  workspacesOptions,
  gitOptions,
}: GitAffectedWorkspacesOptions): Promise<GitAffectedWorkspacesResult> => {
  const {
    files: gitFiles,
    baseSha,
    headSha,
  } = await getGitAffectedFiles({
    rootDirectory,
    ...gitOptions,
  });

  const gitFileByPath = new Map<string, GitAffectedFile>(
    gitFiles.map((file) => [file.projectFilePath, file]),
  );

  const projectWorkspaces = workspacesOptions.workspaces ?? [];
  const externalDepChangesByWorkspace =
    workspacesOptions.ignoreExternalDependencies || !projectWorkspaces.length
      ? new Map()
      : computeExternalDependencyChanges({
          workspaces: projectWorkspaces,
          baseLock: await loadVersionsAt(rootDirectory, gitOptions.baseRef),
          headLock:
            gitOptions.headRef === "HEAD"
              ? loadCurrentVersions(rootDirectory)
              : await loadVersionsAt(rootDirectory, gitOptions.headRef),
        });

  const {
    workspaces: _omit,
    ignoreExternalDependencies: _omit2,
    ...fileOpts
  } = workspacesOptions;
  const { affectedWorkspaces } = await getFileAffectedWorkspaces({
    rootDirectory,
    ...fileOpts,
    changedFilePaths: gitFiles.map((file) => file.projectFilePath),
    externalDepChangesByWorkspace,
  });

  const annotatedWorkspaces: GitAffectedWorkspaceResult[] =
    affectedWorkspaces.map((result) => ({
      ...result,
      affectedReasons: {
        ...result.affectedReasons,
        changedFiles: result.affectedReasons.changedFiles.map(
          (changedFile) => ({
            ...changedFile,
            fileMetadata: { git: gitFileByPath.get(changedFile.filePath)! },
          }),
        ),
      },
    }));

  return { affectedWorkspaces: annotatedWorkspaces, baseSha, headSha };
};
