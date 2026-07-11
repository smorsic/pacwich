import path from "path";
import { createFileSystemProject } from "pacwich";
import { describe, expect, it } from "vitest";
import { findWorkspaceConfigFilePath } from "../src/workspacesView/workspaceConfigFile";

const FIXTURE_ROOT = path.resolve(__dirname, "fixtures/demoProject");

describe("findWorkspaceConfigFilePath", () => {
  const project = createFileSystemProject({ rootDirectory: FIXTURE_ROOT });

  it("finds a pacwich.workspace.json file when present", () => {
    const utils = project.findWorkspaceByName("@fixture/utils");
    expect(utils).toBeDefined();

    const configPath = findWorkspaceConfigFilePath(FIXTURE_ROOT, utils!);
    expect(configPath).toBe(
      path.join(FIXTURE_ROOT, "packages/utils/pacwich.workspace.json"),
    );
  });

  it("returns undefined when no workspace config file exists", () => {
    const core = project.findWorkspaceByName("@fixture/core");
    expect(core).toBeDefined();

    expect(findWorkspaceConfigFilePath(FIXTURE_ROOT, core!)).toBeUndefined();
  });
});
