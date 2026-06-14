import type { PackageManagerAdapter } from "../packageManager/adapter";
import type { Workspace } from "../workspaces";
import { computeExternalDependencyChanges } from "./externalDependencyChanges";
import {
  getFileAffectedWorkspaces,
  type AffectedWorkspaceResult,
  type FileAffectedWorkspacesOptions,
} from "./fileAffectedWorkspaces";
import {
  getGitAffectedFiles,
  type GetGitAffectedFilesOptions,
  type GitAffectedFile,
} from "./gitAffectedFiles";

export type GitAffectedWorkspacesOptions = {
  /** Project root, used for both git resolution and workspace path normalization. */
  rootDirectory: string;
  /** Package manager adapter that owns lockfile reads + per-workspace version lookups. */
  adapter: PackageManagerAdapter;
  workspacesOptions: Omit<
    FileAffectedWorkspacesOptions,
    "rootDirectory" | "changedFilePaths" | "externalDepChangesByWorkspace"
  > & {
    /**
     * All workspaces in the project. Required for external dep
     * version tracking. Pass an empty array (or omit and pass
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

export const getGitAffectedWorkspaces = async ({
  rootDirectory,
  adapter,
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
          adapter,
          baseLock: await adapter.lockfile.loadVersionsAtGitRef({
            rootDirectory,
            ref: gitOptions.baseRef,
          }),
          headLock:
            gitOptions.headRef === "HEAD"
              ? adapter.lockfile.loadCurrentVersions({ rootDirectory })
              : await adapter.lockfile.loadVersionsAtGitRef({
                  rootDirectory,
                  ref: gitOptions.headRef,
                }),
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
