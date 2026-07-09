import path from "path";
import { ROOT_WORKSPACE_SELECTOR } from "@pacwich/common/project";
import { validateJSTypes, validateRuntime } from "../../internal/core";
import { logger } from "../../internal/logger";
import {
  resolvePackageManagerAdapter,
  type PackageManagerAdapter,
  type PackageManagerName,
} from "../../packageManager/adapter";
import { validatePackageManagerVersion } from "../../packageManager/validatePackageManagerVersion";
import { sortWorkspaces, type Workspace } from "../../workspaces";
import { matchWorkspacesByPatterns } from "../../workspaces/workspacePattern";
import type {
  Project,
  ProjectConfigs,
  ScriptDetails,
  TagDetails,
} from "../project";

const warnedDeprecatedMapMethods = new Set<string>();

const warnDeprecatedOnce = (
  oldName: "mapScriptsToWorkspaces" | "mapTagsToWorkspaces",
  newName: "scriptMap" | "tagMap",
) => {
  if (warnedDeprecatedMapMethods.has(oldName)) return;
  warnedDeprecatedMapMethods.add(oldName);
  logger.warn("DeprecatedProjectMapMethod", { oldName, newName });
};

/** For tests */
export const __resetDeprecatedMapWarnings = () => {
  warnedDeprecatedMapMethods.clear();
};

export const resolveWorkspacePath = (project: Project, workspace: Workspace) =>
  path.resolve(project.rootDirectory, workspace.path);

export const resolveRootWorkspaceSelector = (
  workspacePattern: string,
  project: Project,
) =>
  workspacePattern === ROOT_WORKSPACE_SELECTOR
    ? project.rootWorkspace
    : project.findWorkspaceByNameOrAlias(workspacePattern);

export type ProjectBaseConstructorOptions = {
  packageManager: PackageManagerName;
  /** Skip the bun-runtime version check (used by MemoryProject, which has no FS coupling). */
  ignoreBunVersion?: boolean;
};

export abstract class ProjectBase implements Project {
  public abstract readonly name: string;
  public abstract readonly rootDirectory: string;
  public abstract readonly rootWorkspace: Workspace;
  public abstract readonly workspaces: Workspace[];
  public abstract readonly sourceType: "fileSystem" | "memory";
  public abstract readonly config: ProjectConfigs;

  constructor({ packageManager }: ProjectBaseConstructorOptions) {
    const runtimeError = validateRuntime();
    if (runtimeError) {
      logger.warn("UnsupportedRuntime", { message: runtimeError.message });
    }

    const pmVersionError = validatePackageManagerVersion(packageManager);
    if (pmVersionError) {
      logger.warn("UnsupportedPackageManagerVersion", {
        message: pmVersionError.message,
      });
    }

    this.#adapter = resolvePackageManagerAdapter(packageManager);
  }

  public get packageManager(): PackageManagerName {
    return this.#adapter.name;
  }

  listWorkspacesWithScript(scriptName: string): Workspace[] {
    validateJSTypes(
      { scriptName: { value: scriptName, typeofName: "string" } },
      { throw: true },
    );
    return this.workspaces.filter((workspace) =>
      workspace.scripts.includes(scriptName),
    );
  }

  get scriptMap(): Record<string, ScriptDetails> {
    const scripts = new Set<string>();
    this.workspaces.forEach((workspace) => {
      workspace.scripts.forEach((script) => scripts.add(script));
    });
    return Array.from(scripts)
      .sort((a, b) => a.localeCompare(b))
      .map((name) => ({
        name,
        workspaces: this.listWorkspacesWithScript(name),
      }))
      .reduce(
        (acc, { name, workspaces }) => ({
          ...acc,
          [name]: { name, workspaces },
        }),
        {} as Record<string, ScriptDetails>,
      );
  }

  get tagMap(): Record<string, TagDetails> {
    const tags = new Set<string>();
    this.workspaces.forEach((workspace) => {
      workspace.tags.forEach((tag) => tags.add(tag));
    });
    return Array.from(tags)
      .sort((a, b) => a.localeCompare(b))
      .reduce(
        (acc, tag) => ({
          ...acc,
          [tag]: { workspaces: this.listWorkspacesWithTag(tag) },
        }),
        {} as Record<string, TagDetails>,
      );
  }

  /** @deprecated Use {@link Project.scriptMap} instead. */
  mapScriptsToWorkspaces(): Record<string, ScriptDetails> {
    warnDeprecatedOnce("mapScriptsToWorkspaces", "scriptMap");
    return this.scriptMap;
  }

  /** @deprecated Use {@link Project.tagMap} instead. */
  mapTagsToWorkspaces(): Record<string, TagDetails> {
    warnDeprecatedOnce("mapTagsToWorkspaces", "tagMap");
    return this.tagMap;
  }

  findWorkspaceByName(workspaceName: string): Workspace | null {
    validateJSTypes(
      { workspaceName: { value: workspaceName, typeofName: "string" } },
      { throw: true },
    );
    return (
      this.workspaces.find((workspace) => workspace.name === workspaceName) ??
      null
    );
  }

  findWorkspaceByAlias(alias: string): Workspace | null {
    validateJSTypes(
      { alias: { value: alias, typeofName: "string" } },
      { throw: true },
    );
    return (
      this.workspaces.find((workspace) => workspace.aliases.includes(alias)) ??
      null
    );
  }

  findWorkspaceByNameOrAlias(nameOrAlias: string): Workspace | null {
    validateJSTypes(
      { nameOrAlias: { value: nameOrAlias, typeofName: "string" } },
      { throw: true },
    );
    return (
      this.findWorkspaceByName(nameOrAlias) ||
      this.findWorkspaceByAlias(nameOrAlias)
    );
  }

  listWorkspacesWithTag(tag: string): Workspace[] {
    return this.workspaces.filter((workspace) => workspace.tags.includes(tag));
  }

  findWorkspacesByPattern(...workspacePatterns: string[]): Workspace[] {
    const matched = matchWorkspacesByPatterns(
      workspacePatterns,
      this.workspaces,
      this.rootWorkspace,
    );

    // Preserve historical ordering: root workspace first, then sorted others.
    const rootName = this.rootWorkspace.name;
    const rootMatch = matched.find((workspace) => workspace.name === rootName);
    const rest = sortWorkspaces(
      matched.filter((workspace) => workspace.name !== rootName),
    );

    return rootMatch ? [rootMatch, ...rest] : rest;
  }

  readonly #adapter: PackageManagerAdapter;

  get __adapter(): PackageManagerAdapter {
    return this.#adapter;
  }
}
