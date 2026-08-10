import {
  findAncestorWorkspaces,
  isAncestorWorkspacePath,
  normalizeWorkspacePath,
} from "../../../src/workspaces";
import { makeTestWorkspace } from "../../util/testData";
import { describe, expect, test } from "../../util/testFramework";

describe("normalizeWorkspacePath", () => {
  test("maps '.' (root workspace path) to ''", () => {
    expect(normalizeWorkspacePath(".")).toBe("");
  });

  test("strips trailing slashes", () => {
    expect(normalizeWorkspacePath("packages/a/")).toBe("packages/a");
  });

  test("leaves an already-normalized path untouched", () => {
    expect(normalizeWorkspacePath("packages/a")).toBe("packages/a");
  });
});

describe("isAncestorWorkspacePath", () => {
  test("root ('') is an ancestor of any non-root path", () => {
    expect(isAncestorWorkspacePath("", "packages/a")).toBe(true);
  });

  test("root is not its own ancestor", () => {
    expect(isAncestorWorkspacePath("", "")).toBe(false);
  });

  test("a workspace is an ancestor of a path nested inside it", () => {
    expect(isAncestorWorkspacePath("packages/a", "packages/a/nested/b")).toBe(
      true,
    );
  });

  test("siblings are not ancestors of each other", () => {
    expect(isAncestorWorkspacePath("packages/a", "packages/b")).toBe(false);
  });

  test("a workspace is not its own ancestor", () => {
    expect(isAncestorWorkspacePath("packages/a", "packages/a")).toBe(false);
  });

  test("a path is not an ancestor of a same-prefix sibling directory name", () => {
    expect(isAncestorWorkspacePath("packages/a", "packages/ab")).toBe(false);
  });
});

describe("findAncestorWorkspaces", () => {
  const root = makeTestWorkspace({ name: "root", isRoot: true, path: "" });
  const parent = makeTestWorkspace({ name: "parent", path: "packages/parent" });
  const child = makeTestWorkspace({
    name: "child",
    path: "packages/parent/nested/child",
  });
  const sibling = makeTestWorkspace({
    name: "sibling",
    path: "packages/sibling",
  });

  test("finds a direct non-root ancestor", () => {
    const result = findAncestorWorkspaces({
      workspace: child,
      allWorkspaces: [root, parent, child, sibling],
    });
    expect(result).toEqual([parent]);
  });

  test("excludes root from the result even when present in allWorkspaces", () => {
    const result = findAncestorWorkspaces({
      workspace: child,
      allWorkspaces: [root, parent, child, sibling],
    });
    expect(result.some((w) => w.isRoot)).toBe(false);
  });

  test("excludes siblings and the workspace itself", () => {
    const result = findAncestorWorkspaces({
      workspace: parent,
      allWorkspaces: [root, parent, child, sibling],
    });
    expect(result).toEqual([]);
  });

  test("returns an empty array for a top-level (non-nested) workspace", () => {
    const result = findAncestorWorkspaces({
      workspace: sibling,
      allWorkspaces: [root, parent, child, sibling],
    });
    expect(result).toEqual([]);
  });

  test("finds multiple levels of ancestry when queried from a deeper workspace", () => {
    const grandchild = makeTestWorkspace({
      name: "grandchild",
      path: "packages/parent/nested/child/deeper",
    });
    const result = findAncestorWorkspaces({
      workspace: grandchild,
      allWorkspaces: [root, parent, child, sibling, grandchild],
    });
    expect(result.map((w) => w.name).sort()).toEqual(["child", "parent"]);
  });
});
