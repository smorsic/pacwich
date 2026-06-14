import fs from "fs";
import os from "os";
import path from "path";
import { logger } from "../../../src/internal/logger";
import { createFileSystemProject } from "../../../src/project";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  spyOn,
  test,
} from "../../util/testFramework";

/**
 * The "workspaces field in package.json is not used by pnpm" warning
 * is actionable when the user has no pnpm-workspace.yaml (they likely
 * intended their `workspaces` field to be picked up) and noise when
 * they do (dual-pm projects keep both declarations on purpose).
 */
describe("pnpm: workspaces-field warning", () => {
  let tmpDir: string;
  let warnSpy: ReturnType<typeof spyOn>;

  const PNPM_LOCK = "lockfileVersion: '9.0'\n\nimporters:\n  .: {}\n";

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pacwich-pnpm-wsfield-"));
    warnSpy = spyOn(logger, "warn").mockImplementation(
      (() => undefined) as unknown as typeof logger.warn,
    );
  });

  afterEach(() => {
    warnSpy.mockRestore();
    fs.rmSync(tmpDir, { force: true, recursive: true });
  });

  const findWarning = () =>
    warnSpy.mock.calls.find(
      ([msg]: [string]) =>
        typeof msg === "string" &&
        msg.includes('"workspaces" field in package.json is not used by pnpm'),
    );

  test("warns when workspaces field is set and pnpm-workspace.yaml is missing", () => {
    fs.writeFileSync(
      path.join(tmpDir, "package.json"),
      JSON.stringify({ name: "p", workspaces: ["packages/*"] }),
    );
    fs.writeFileSync(path.join(tmpDir, "pnpm-lock.yaml"), PNPM_LOCK);

    createFileSystemProject({ rootDirectory: tmpDir, packageManager: "pnpm" });
    expect(findWarning()).toBeDefined();
  });

  test("does NOT warn when both workspaces field and pnpm-workspace.yaml exist", () => {
    fs.writeFileSync(
      path.join(tmpDir, "package.json"),
      JSON.stringify({ name: "p", workspaces: ["packages/*"] }),
    );
    fs.writeFileSync(
      path.join(tmpDir, "pnpm-workspace.yaml"),
      'packages:\n  - "packages/*"\n',
    );
    fs.writeFileSync(path.join(tmpDir, "pnpm-lock.yaml"), PNPM_LOCK);

    createFileSystemProject({ rootDirectory: tmpDir, packageManager: "pnpm" });
    expect(findWarning()).toBeUndefined();
  });

  test("does NOT warn when workspaces field is absent", () => {
    fs.writeFileSync(
      path.join(tmpDir, "package.json"),
      JSON.stringify({ name: "p" }),
    );
    fs.writeFileSync(
      path.join(tmpDir, "pnpm-workspace.yaml"),
      'packages:\n  - "packages/*"\n',
    );
    fs.writeFileSync(path.join(tmpDir, "pnpm-lock.yaml"), PNPM_LOCK);

    createFileSystemProject({ rootDirectory: tmpDir, packageManager: "pnpm" });
    expect(findWarning()).toBeUndefined();
  });
});
