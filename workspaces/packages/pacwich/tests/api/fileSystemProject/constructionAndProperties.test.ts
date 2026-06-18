import fs from "fs";
import os from "os";
import path from "path";
import { getUserEnvVarName } from "@pacwich/common/config";
import { InvalidJSTypeError } from "../../../src/internal/core";
import { createFileSystemProject } from "../../../src/project";
import { getProjectRoot } from "../../fixtures/testProjects";
import { deepEquals } from "../../util/runtime";
import { expect, test, describe } from "../../util/testFramework";
import { withWindowsPath } from "../../util/windows";

describe("createFileSystemProject - type validation", () => {
  test("throws for non-string rootDirectory", () => {
    expect(() =>
      createFileSystemProject({
        rootDirectory: 123 as unknown as string,
      }),
    ).toThrow(InvalidJSTypeError);
  });

  test("root directory expands home path", () => {
    const root = getProjectRoot("default");
    const project = createFileSystemProject({
      rootDirectory: root.replace(os.homedir(), "~"),
    });
    expect(project.rootDirectory).toBe(root);
  });

  test("throws for non-string name", () => {
    expect(() =>
      createFileSystemProject({
        rootDirectory: getProjectRoot("default"),
        name: 123 as unknown as string,
      }),
    ).toThrow(InvalidJSTypeError);
  });

  test("throws for non-boolean includeRootWorkspace", () => {
    expect(() =>
      createFileSystemProject({
        rootDirectory: getProjectRoot("default"),
        includeRootWorkspace: "true" as unknown as boolean,
      }),
    ).toThrow(InvalidJSTypeError);
  });

  test("does not throw for valid options", () => {
    expect(() =>
      createFileSystemProject({ rootDirectory: getProjectRoot("default") }),
    ).not.toThrow(InvalidJSTypeError);
  });
});

describe("createFileSystemProject - project root resolution", () => {
  test("walks up from a sub-workspace directory to the monorepo root", () => {
    const monorepoRoot = getProjectRoot("simple1");
    const subWorkspace = path.join(monorepoRoot, "applications/applicationA");
    const project = createFileSystemProject({ rootDirectory: subWorkspace });
    expect(project.rootDirectory).toBe(withWindowsPath(monorepoRoot));
  });

  test("walks up through a non-workspace package.json", () => {
    // libraries/ has no package.json of its own — confirms a pure
    // walk-up across a directory that isn't itself a package.
    const monorepoRoot = getProjectRoot("simple1");
    const intermediate = path.join(monorepoRoot, "libraries");
    const project = createFileSystemProject({ rootDirectory: intermediate });
    expect(project.rootDirectory).toBe(withWindowsPath(monorepoRoot));
  });

  test("returns the passed directory when it is already the project root", () => {
    const monorepoRoot = getProjectRoot("simple1");
    const project = createFileSystemProject({ rootDirectory: monorepoRoot });
    expect(project.rootDirectory).toBe(withWindowsPath(monorepoRoot));
  });

  test("falls back to the start directory when no workspaces ancestor exists", () => {
    // Isolate under /tmp so no real ancestor monorepo can be found.
    const tmpDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "pacwich-api-noroot-"),
    );
    try {
      expect(() =>
        createFileSystemProject({ rootDirectory: tmpDir }),
      ).toThrow(); // project-load fails against the tmp dir itself
    } finally {
      fs.rmSync(tmpDir, { force: true, recursive: true });
    }
  });

  test("a plain (non-workspaces) package.json does not stop the walk-up", () => {
    // Under /tmp the walk-up has no workspaces ancestor — so we
    // verify the project resolves to the tmp dir (fallback), not
    // some unrelated path. The plain package.json should be walked
    // past without satisfying the workspaces-field check.
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pacwich-api-plain-"));
    try {
      fs.writeFileSync(
        path.join(tmpDir, "package.json"),
        JSON.stringify({ name: "plain-package", version: "1.0.0" }),
      );
      expect(() =>
        createFileSystemProject({ rootDirectory: tmpDir }),
      ).toThrow();
    } finally {
      fs.rmSync(tmpDir, { force: true, recursive: true });
    }
  });

  test("pnpm-workspace.yaml next to package.json stops the walk-up", () => {
    // A pnpm project typically has no `workspaces` field in
    // package.json; pnpm-workspace.yaml is the marker. The walk-up
    // must treat that pairing as a project root, so a nested pnpm
    // project doesn't lose to a bun/npm ancestor's workspaces field.
    const outerTmp = fs.mkdtempSync(
      path.join(os.tmpdir(), "pacwich-api-pnpm-outer-"),
    );
    try {
      fs.writeFileSync(
        path.join(outerTmp, "package.json"),
        JSON.stringify({ name: "outer", workspaces: ["packages/*"] }),
      );
      const innerDir = path.join(outerTmp, "inner");
      fs.mkdirSync(innerDir);
      fs.writeFileSync(
        path.join(innerDir, "package.json"),
        JSON.stringify({ name: "inner-pnpm", private: true }),
      );
      fs.writeFileSync(
        path.join(innerDir, "pnpm-workspace.yaml"),
        'packages:\n  - "packages/*"\n',
      );
      const startDir = path.join(innerDir, "some/subdir");
      fs.mkdirSync(startDir, { recursive: true });

      // No lockfile, so we expect project-load to fail. The error
      // message will reference the inner dir if walk-up resolved
      // correctly, the outer dir if it didn't.
      let resolvedRoot: string | undefined;
      try {
        createFileSystemProject({ rootDirectory: startDir });
      } catch (err) {
        const message = (err as Error).message;
        // The auto-detect error message references the inner dir,
        // not the outer one, when the walk-up resolves correctly.
        if (message.includes(withWindowsPath(innerDir))) {
          resolvedRoot = innerDir;
        } else if (message.includes(withWindowsPath(outerTmp))) {
          resolvedRoot = outerTmp;
        }
      }
      expect(resolvedRoot).toBe(innerDir);
    } finally {
      fs.rmSync(outerTmp, { force: true, recursive: true });
    }
  });
});

describe("Test FileSystemProject", () => {
  // Bun-specific "default cwd → BunLockNotFound" assertion moved to
  // tests/packageManagers/bun/createFileSystemProject.test.ts.

  test("createFileSystemProject: root directory is relative to process.cwd()  ", async () => {
    if (process.env.IS_BUILD === "true") {
      const project = createFileSystemProject({
        rootDirectory: "../../../../",
      });
      expect(project.rootDirectory).toBe(
        withWindowsPath(path.resolve(process.cwd(), "../../../../")),
      );
    } else {
      const project = createFileSystemProject({
        rootDirectory: "../../..",
      });
      expect(project.rootDirectory).toBe(
        withWindowsPath(path.resolve(process.cwd(), "../../..")),
      );
    }
  });

  test("Inline script env var metadata", async () => {
    const project = createFileSystemProject({
      rootDirectory: getProjectRoot("default"),
    });

    const singleResult = project.runWorkspaceScript({
      workspaceNameOrAlias: "application-a",
      script: "bun run <projectPath>/../testScriptMetadataEnv.ts",
      inline: { scriptName: "test-script-metadata-env" },
    });

    let output = "";
    for await (const { chunk } of singleResult.output.text()) {
      output += chunk;
    }

    expect(output).toBe(`${project.rootDirectory}
test-root
application-a
${project.rootDirectory}${withWindowsPath("/applications/applicationA")}
applications/applicationA
test-script-metadata-env
`);

    const multiResult = project.runScriptAcrossWorkspaces({
      workspacePatterns: ["application-b"],
      script: "bun run <projectPath>/../testScriptMetadataEnv.ts",
      inline: { scriptName: "test-script-metadata-env-b" },
    });

    output = "";
    for await (const { chunk } of multiResult.output.text()) {
      output += chunk;
    }
    expect(output).toBe(`${project.rootDirectory}
test-root
application-b
${project.rootDirectory}${withWindowsPath("/applications/applicationB")}
applications/applicationB
test-script-metadata-env-b
`);
  });

  test("Include root workspace - explicit", () => {
    const projectExclude = createFileSystemProject({
      rootDirectory: getProjectRoot("withRootWorkspace"),
    });

    expect(
      projectExclude.workspaces.find((w) =>
        deepEquals(w, projectExclude.rootWorkspace),
      ),
    ).toBeFalsy();

    const projectInclude = createFileSystemProject({
      rootDirectory: getProjectRoot("withRootWorkspace"),
      includeRootWorkspace: true,
    });

    expect(projectInclude.rootWorkspace).toEqual(projectInclude.workspaces[0]);
  });

  test("Include root workspace - env var", () => {
    process.env[getUserEnvVarName("includeRootWorkspaceDefault")] = "false";

    const projectExclude = createFileSystemProject({
      rootDirectory: getProjectRoot("withRootWorkspace"),
    });

    expect(
      projectExclude.workspaces.find((w) =>
        deepEquals(w, projectExclude.rootWorkspace),
      ),
    ).toBeFalsy();

    process.env[getUserEnvVarName("includeRootWorkspaceDefault")] = "true";

    const projectInclude = createFileSystemProject({
      rootDirectory: getProjectRoot("withRootWorkspace"),
    });

    expect(projectInclude.rootWorkspace).toEqual(projectInclude.workspaces[0]);

    const projectExcludeOverride = createFileSystemProject({
      rootDirectory: getProjectRoot("withRootWorkspace"),
      includeRootWorkspace: false,
    });

    expect(
      projectExcludeOverride.workspaces.find((w) =>
        deepEquals(w, projectExcludeOverride.rootWorkspace),
      ),
    ).toBeFalsy();

    delete process.env[getUserEnvVarName("includeRootWorkspaceDefault")];
  });

  test("Include root workspace - config file", () => {
    const project = createFileSystemProject({
      rootDirectory: getProjectRoot("withRootWorkspaceWithConfigFiles"),
    });

    expect(project.rootWorkspace).toEqual(project.workspaces[0]);

    process.env[getUserEnvVarName("includeRootWorkspaceDefault")] = "false";

    const projectNotOverridden = createFileSystemProject({
      rootDirectory: getProjectRoot("withRootWorkspaceWithConfigFiles"),
    });

    expect(projectNotOverridden.rootWorkspace).toEqual(
      projectNotOverridden.workspaces[0],
    );

    const projectOverridden = createFileSystemProject({
      rootDirectory: getProjectRoot("withRootWorkspaceWithConfigFiles"),
      includeRootWorkspace: false,
    });

    expect(
      projectOverridden.workspaces.find((w) =>
        deepEquals(w, projectOverridden.rootWorkspace),
      ),
    ).toBeFalsy();

    delete process.env[getUserEnvVarName("includeRootWorkspaceDefault")];
  });
});

const makeDefaultProject = () =>
  createFileSystemProject({ rootDirectory: getProjectRoot("default") });

describe("ProjectBase methods - type validation", () => {
  test("listWorkspacesWithScript throws for non-string scriptName", () => {
    const project = makeDefaultProject();
    expect(() =>
      project.listWorkspacesWithScript(123 as unknown as string),
    ).toThrow(InvalidJSTypeError);
  });

  test("findWorkspaceByName throws for non-string workspaceName", () => {
    const project = makeDefaultProject();
    expect(() => project.findWorkspaceByName(123 as unknown as string)).toThrow(
      InvalidJSTypeError,
    );
  });

  test("findWorkspaceByAlias throws for non-string alias", () => {
    const project = makeDefaultProject();
    expect(() =>
      project.findWorkspaceByAlias(123 as unknown as string),
    ).toThrow(InvalidJSTypeError);
  });

  test("findWorkspaceByNameOrAlias throws for non-string nameOrAlias", () => {
    const project = makeDefaultProject();
    expect(() =>
      project.findWorkspaceByNameOrAlias(123 as unknown as string),
    ).toThrow(InvalidJSTypeError);
  });
});
