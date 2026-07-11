import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { resolveProjectRoot } from "../src/workspacesView/resolveProjectRoot";
import { __resetConfigValues, __setConfigValue } from "./mocks/vscode";

const workspaceFolder = { uri: { fsPath: "/repo" } } as never;

describe("resolveProjectRoot", () => {
  afterEach(() => __resetConfigValues());

  it("uses the workspace folder itself when no setting is configured", () => {
    expect(resolveProjectRoot(workspaceFolder)).toBe("/repo");
  });

  it("resolves a relative projectRoot setting against the workspace folder", () => {
    __setConfigValue("pacwich", "projectRoot", "services/js-monorepo");
    expect(resolveProjectRoot(workspaceFolder)).toBe(
      path.resolve("/repo", "services/js-monorepo"),
    );
  });

  it("uses an absolute projectRoot setting as-is", () => {
    __setConfigValue("pacwich", "projectRoot", "/elsewhere/monorepo");
    expect(resolveProjectRoot(workspaceFolder)).toBe("/elsewhere/monorepo");
  });

  it("treats a blank/whitespace-only setting as unset", () => {
    __setConfigValue("pacwich", "projectRoot", "   ");
    expect(resolveProjectRoot(workspaceFolder)).toBe("/repo");
  });
});
