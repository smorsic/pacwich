import type { WorkspaceInputsConfig } from "bw-common";
import type { AffectedDependencyChainEntry } from "../../../affected/fileAffectedWorkspaces";
import type { GitAffectedFileReason } from "../../../affected/gitAffectedFiles";
import type { Workspace } from "../../../workspaces";
import type { FileSystemProject } from "./fileSystemProject";

export type AffectedWorkspaceResult = {
  workspace: Workspace;
  inputs: WorkspaceInputsConfig;
  isAffected: boolean;
  affectedReasons: {
    changedFiles: {
      filePath: string;
      inputMatch: string;
      /** When `diffSource` is "git" */
      gitReasons?: GitAffectedFileReason[];
    }[];
    dependencies: {
      dependencyName: string;
      chain: AffectedDependencyChainEntry[];
    }[];
  };
};

export type AffectedDiffSource = "git" | "fileList";

export type AffectedWorkspacesResult = {
  metadata: {
    /** The source for changed files */
    diffSource: AffectedDiffSource;
    /** When `diffSource` is "git" */
    git?: {
      baseRef: string;
      headRef: string;
    };
  };
  /** The workspaces and their affected reasons */
  workspaceResults: AffectedWorkspaceResult[];
};

export type BaseAffectedWorkspacesOptions = {
  ignorePackageDependencies?: boolean;
};

export type GitAffectedWorkspacesOptions = BaseAffectedWorkspacesOptions & {
  diffSource: "git";
  diffOptions?: {
    /**
     * The base git ref to compare against.
     *
     * Default is "main" when not provided or
     * when the default is not set by the
     * root config or env var.
     */
    baseRef?: string;
    /**
     * The head git ref to compare against.
     *
     * Default is "HEAD" when not provided.
     */
    headRef?: string;
    /** Exclude untracked files */
    ignoreUntracked?: boolean;
    /** Ignore staged files */
    ignoreStaged?: boolean;
    /** Ignore unstaged files */
    ignoreUnstaged?: boolean;
    /** Exclude any uncommitted files (ignores staged, unstaged, and untracked) */
    ignoreUncommitted?: boolean;
  };
};

export type FileListAffectedWorkspacesOptions =
  BaseAffectedWorkspacesOptions & {
    diffSource: "fileList";
    /**
     * File paths, directories, or glob patterns relative to the project root.
     *
     * Prefix with `!` to exclude.
     */
    changedFiles: string[];
  };

export type GetAffectedWorkspacesOptions =
  | GitAffectedWorkspacesOptions
  | FileListAffectedWorkspacesOptions;

export const isOptionsForDiffSource = <DiffSource extends AffectedDiffSource>(
  options: GetAffectedWorkspacesOptions,
  diffSource: DiffSource,
): options is DiffSource extends "git"
  ? GitAffectedWorkspacesOptions
  : FileListAffectedWorkspacesOptions => options.diffSource === diffSource;

export const getAffectedWorkspaces = async (
  project: FileSystemProject,
  options: GetAffectedWorkspacesOptions,
): Promise<AffectedWorkspacesResult> => {};
