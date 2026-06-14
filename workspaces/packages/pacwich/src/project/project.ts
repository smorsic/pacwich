import type {
  ResolvedProjectConfig,
  ResolvedWorkspaceConfig,
} from "@pacwich/common/config";
import type { PackageManagerName } from "../packageManager/adapter";
import type { Workspace } from "../workspaces";

/** Metadata about a {@link Project}'s script, including the workspaces that have it in their package.json */
export type ScriptDetails = {
  name: string;
  workspaces: Workspace[];
};

/** The workspaces that share a given tag in their {@link Project} configuration */
export type TagDetails = {
  workspaces: Workspace[];
};

/** The resolved configs for a project and its workspaces */
export type ProjectConfigs = {
  /** Resolved project-level config (from `pacwich.project.*` or the `pacwich-project` key in package.json). */
  project: ResolvedProjectConfig;
  /** @deprecated Use `.project` instead */
  root: ResolvedProjectConfig;
  /** A map of workspace names to their resolved config */
  workspaces: Record<string, ResolvedWorkspaceConfig>;
};

/**
 * A project contains a collection of workspaces and is the core of `pacwich`'s functionality.
 *
 * Typically based on a root package.json file's `"workspaces"` field and any matching nested package.json files that are found.
 */
export interface Project {
  /** The name of the project. This is typically the name of the root package.json unless otherwise provided. */
  name: string;
  /** The root directory of the project */
  rootDirectory: string;
  /** The root workspace of the project */
  rootWorkspace: Workspace;
  /** The list of all workspaces in the project */
  workspaces: Workspace[];
  /** The resolved project- and workspace-level configs */
  config: ProjectConfigs;
  /** The means by which the project was created */
  sourceType: "fileSystem" | "memory";
  /** Identifier of the package manager backend driving this project's workspace/lockfile semantics. */
  packageManager: PackageManagerName;
  /** Find a workspace by its package.json name */
  findWorkspaceByName(workspaceName: string): Workspace | null;
  /** Find a workspace by a workspace alias */
  findWorkspaceByAlias(alias: string): Workspace | null;
  /** Find a workspace that matches a workspace's name or an alias if no name matches. */
  findWorkspaceByNameOrAlias(nameOrAlias: string): Workspace | null;
  /** Find a list of workspaces that have a given tag in their configuration */
  listWorkspacesWithTag(tag: string): Workspace[];
  /** Accepts a wildcard pattern for finding a list of workspaces by their name*/
  findWorkspacesByPattern(workspacePattern: string): Workspace[];
  /** Get an array of all workspaces that have a given script in their package.json */
  listWorkspacesWithScript(scriptName: string): Workspace[];
  /**
   * A mapping of all scripts to the workspaces that have them in their
   * package.json. Keys are script names sorted alphabetically.
   */
  scriptMap: Record<string, ScriptDetails>;
  /**
   * A mapping of all tags to the workspaces that have them in their
   * config. Keys are tag names sorted alphabetically.
   */
  tagMap: Record<string, TagDetails>;
  /**
   * @deprecated Use .{@link scriptMap} instead. Will be removed in a
   * future major version.
   */
  mapScriptsToWorkspaces(): Record<string, ScriptDetails>;
  /**
   * @deprecated Use .{@link tagMap} instead. Will be removed in a
   * future major version.
   */
  mapTagsToWorkspaces(): Record<string, TagDetails>;
}
