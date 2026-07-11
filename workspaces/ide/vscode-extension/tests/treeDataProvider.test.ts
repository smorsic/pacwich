import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { WorkspacesTreeDataProvider } from "../src/workspacesView/treeDataProvider";
import {
  MessageTreeItem,
  type WorkspaceTreeItem,
} from "../src/workspacesView/treeItems";
import { __resetConfigValues, __setConfigValue } from "./mocks/vscode";

const FIXTURE_ROOT = path.resolve(__dirname, "fixtures/demoProject");
const workspaceFolder = { uri: { fsPath: FIXTURE_ROOT } } as never;

describe("WorkspacesTreeDataProvider", () => {
  afterEach(() => __resetConfigValues());

  it("lists workspaces sorted by path", () => {
    const provider = new WorkspacesTreeDataProvider(workspaceFolder);
    const children = provider.getChildren() as WorkspaceTreeItem[];

    expect(children.map((item) => item.workspace.name)).toEqual([
      "@fixture/core",
      "@fixture/utils",
    ]);
  });

  it("marks a workspace with a pacwich.workspace.json as configured", () => {
    const provider = new WorkspacesTreeDataProvider(workspaceFolder);
    const [core, utils] = provider.getChildren() as WorkspaceTreeItem[];

    expect(core.contextValue).toBe("pacwich.workspace");
    expect(utils.contextValue).toBe("pacwich.workspace.withConfig");
  });

  it("renders path/alias/tags/scripts as info children", () => {
    const provider = new WorkspacesTreeDataProvider(workspaceFolder);
    const [, utils] = provider.getChildren() as WorkspaceTreeItem[];

    const infoLabels = provider
      .getChildren(utils)
      .map((item) => item.label as string);

    expect(infoLabels).toEqual([
      "Path: packages/utils",
      "Alias: utils, ut",
      "Tags: shared",
      "Scripts (1): lint",
    ]);
  });

  it("omits alias/tags rows for a workspace without them", () => {
    const provider = new WorkspacesTreeDataProvider(workspaceFolder);
    const [core] = provider.getChildren() as WorkspaceTreeItem[];

    const infoLabels = provider
      .getChildren(core)
      .map((item) => item.label as string);

    expect(infoLabels).toEqual([
      "Path: packages/core",
      "Scripts (2): build, test",
    ]);
  });

  it("surfaces a message item when no workspace folder is open", () => {
    const provider = new WorkspacesTreeDataProvider(undefined);
    const children = provider.getChildren();

    expect(children).toHaveLength(1);
    expect(children[0]).toBeInstanceOf(MessageTreeItem);
  });

  it("surfaces a message item when the resolved project root is invalid", () => {
    // Outside any project (findProjectRoot walks up from here and, unlike
    // a path under this repo, won't find an ancestor package.json with a
    // "workspaces" field), so createFileSystemProject should throw.
    const provider = new WorkspacesTreeDataProvider({
      uri: {
        fsPath: path.join(os.tmpdir(), "pacwich-vscode-ext-test-missing"),
      },
    } as never);
    const children = provider.getChildren();

    expect(children).toHaveLength(1);
    expect(children[0]).toBeInstanceOf(MessageTreeItem);
  });

  it("respects the pacwich.projectRoot setting to find a project nested in the opened folder", () => {
    // Simulates the opened VS Code folder being a parent of the actual
    // pacwich project (e.g. a big-repo with the JS monorepo in a subdir).
    __setConfigValue("pacwich", "projectRoot", "demoProject");
    const provider = new WorkspacesTreeDataProvider({
      uri: { fsPath: path.resolve(FIXTURE_ROOT, "..") },
    } as never);

    expect(provider.getProjectRoot()).toBe(FIXTURE_ROOT);
    expect(
      (provider.getChildren() as WorkspaceTreeItem[]).map(
        (item) => item.workspace.name,
      ),
    ).toEqual(["@fixture/core", "@fixture/utils"]);
  });

  it("re-resolves workspaces on refresh()", () => {
    const provider = new WorkspacesTreeDataProvider(workspaceFolder);
    const before = (provider.getChildren() as WorkspaceTreeItem[]).length;

    provider.refresh();

    const after = (provider.getChildren() as WorkspaceTreeItem[]).length;
    expect(after).toBe(before);
  });
});
