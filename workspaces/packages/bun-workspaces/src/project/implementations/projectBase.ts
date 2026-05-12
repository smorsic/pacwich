import path from "path";
import { ROOT_WORKSPACE_SELECTOR } from "bw-common/project";
import { validateCurrentBunVersion } from "../../internal/bun";
import { validateJSTypes } from "../../internal/core";
import { logger } from "../../internal/logger";
import { createWorkspaceScriptCommand } from "../../runScript";
import { sortWorkspaces, type Workspace } from "../../workspaces";
import { matchWorkspacesByPatterns } from "../../workspaces/workspacePattern";
import { PROJECT_ERRORS } from "../errors";
import type {
  CreateProjectScriptCommandOptions,
  CreateProjectScriptCommandResult,
  Project,
  ProjectConfig,
  WorkspaceScriptMetadata,
} from "../project";

export const resolveWorkspacePath = (project: Project, workspace: Workspace) =>
  path.resolve(project.rootDirectory, workspace.path);

export const resolveRootWorkspaceSelector = (
  workspacePattern: string,
  project: Project,
) =>
  workspacePattern === ROOT_WORKSPACE_SELECTOR
    ? project.rootWorkspace
    : project.findWorkspaceByNameOrAlias(workspacePattern);

export abstract class ProjectBase implements Project {
  public abstract readonly name: string;
  public abstract readonly rootDirectory: string;
  public abstract readonly rootWorkspace: Workspace;
  public abstract readonly workspaces: Workspace[];
  public abstract readonly sourceType: "fileSystem" | "memory";
  public abstract readonly config: ProjectConfig;

  constructor(_ignoreBunVersion = false) {
    const bunVersionError = validateCurrentBunVersion();
    if (bunVersionError && !_ignoreBunVersion) {
      logger.error(
        bunVersionError.message + " (Features may not work as expected)",
      );
    }
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

  mapScriptsToWorkspaces(): Record<string, WorkspaceScriptMetadata> {
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
        {} as Record<string, WorkspaceScriptMetadata>,
      );
  }

  mapTagsToWorkspaces(): Record<string, Workspace[]> {
    const tags = new Set<string>();
    this.workspaces.forEach((workspace) => {
      workspace.tags.forEach((tag) => tags.add(tag));
    });
    return Array.from(tags)
      .sort((a, b) => a.localeCompare(b))
      .reduce(
        (acc, tag) => ({
          ...acc,
          [tag]: this.listWorkspacesWithTag(tag),
        }),
        {} as Record<string, Workspace[]>,
      );
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

  createScriptCommand(
    options: CreateProjectScriptCommandOptions,
  ): CreateProjectScriptCommandResult {
    validateJSTypes(
      {
        "workspaceNameOrAlias option": {
          value: options.workspaceNameOrAlias,
          typeofName: "string",
        },
        "scriptName option": {
          value: options.scriptName,
          typeofName: "string",
        },
        "method option": {
          value: options.method,
          typeofName: "string",
          optional: true,
        },
        "args option": {
          value: options.args,
          typeofName: "string",
          optional: true,
        },
      },
      { throw: true },
    );

    const workspace = resolveRootWorkspaceSelector(
      options.workspaceNameOrAlias,
      this,
    );

    if (!workspace) {
      throw new PROJECT_ERRORS.ProjectWorkspaceNotFound(
        `Workspace not found: ${JSON.stringify(options.workspaceNameOrAlias)}`,
      );
    }
    if (!workspace.scripts.includes(options.scriptName)) {
      throw new PROJECT_ERRORS.WorkspaceScriptDoesNotExist(
        `Script not found in workspace ${JSON.stringify(
          workspace.name,
        )}: ${JSON.stringify(options.scriptName)} (available: ${
          workspace.scripts.join(", ") || "none"
        })`,
      );
    }
    return {
      workspace,
      scriptName: options.scriptName,
      commandDetails: createWorkspaceScriptCommand({
        ...options,
        workspace,
        rootDirectory: path.resolve(this.rootDirectory),
        method: options.method,
        args: options.args ?? "",
      }),
    };
  }
}
