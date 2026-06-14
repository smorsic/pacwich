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
 * End-to-end check that assembleProject calls the active adapter's
 * `describeMissingWorkspacesHint` and surfaces the result as a warning
 * when a project loads with no nested workspaces. The hook is
 * adapter-owned; this test asserts the wiring, not the message
 * content (per-adapter assertions live in
 * `tests/packageManagers/pmMatrix/adapter/missingWorkspacesHint.test.ts`).
 */
describe("createFileSystemProject — missing-workspaces warning", () => {
  let tmpDir: string;
  let warnSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pacwich-no-ws-"));
    warnSpy = spyOn(logger, "warn").mockImplementation(
      (() => undefined) as unknown as typeof logger.warn,
    );
  });

  afterEach(() => {
    warnSpy.mockRestore();
    fs.rmSync(tmpDir, { force: true, recursive: true });
  });

  test("bun: warns when package.json has no workspaces field", () => {
    fs.writeFileSync(
      path.join(tmpDir, "package.json"),
      JSON.stringify({ name: "no-ws-root" }),
    );
    // Empty bun.lock satisfies the lockfile-present check; the project
    // assembles with just the root workspace.
    fs.writeFileSync(
      path.join(tmpDir, "bun.lock"),
      `{"lockfileVersion": 1, "workspaces": {"": {"name": "no-ws-root"}}}`,
    );
    createFileSystemProject({ rootDirectory: tmpDir, packageManager: "bun" });
    const hintCall = warnSpy.mock.calls.find(([msg]: [string]) =>
      msg.includes("No workspaces declared"),
    );
    expect(hintCall).toBeDefined();
  });

  test("bun: does NOT warn when package.json has an (empty) workspaces field", () => {
    fs.writeFileSync(
      path.join(tmpDir, "package.json"),
      JSON.stringify({ name: "empty-ws-root", workspaces: [] }),
    );
    fs.writeFileSync(
      path.join(tmpDir, "bun.lock"),
      `{"lockfileVersion": 1, "workspaces": {"": {"name": "empty-ws-root"}}}`,
    );
    createFileSystemProject({ rootDirectory: tmpDir, packageManager: "bun" });
    const hintCall = warnSpy.mock.calls.find(
      ([msg]: [string]) =>
        typeof msg === "string" && msg.includes("No workspaces declared"),
    );
    expect(hintCall).toBeUndefined();
  });

  test("pnpm: warns when pnpm-workspace.yaml is absent", () => {
    fs.writeFileSync(
      path.join(tmpDir, "package.json"),
      JSON.stringify({ name: "no-ws-root" }),
    );
    fs.writeFileSync(
      path.join(tmpDir, "pnpm-lock.yaml"),
      `lockfileVersion: '9.0'\n\nimporters:\n  .: {}\n`,
    );
    createFileSystemProject({ rootDirectory: tmpDir, packageManager: "pnpm" });
    const hintCall = warnSpy.mock.calls.find(
      ([msg]: [string]) =>
        typeof msg === "string" && msg.includes("pnpm-workspace.yaml"),
    );
    expect(hintCall).toBeDefined();
  });

  test("pnpm: does NOT warn when pnpm-workspace.yaml exists (even if empty)", () => {
    fs.writeFileSync(
      path.join(tmpDir, "package.json"),
      JSON.stringify({ name: "empty-ws-root" }),
    );
    fs.writeFileSync(path.join(tmpDir, "pnpm-workspace.yaml"), "");
    fs.writeFileSync(
      path.join(tmpDir, "pnpm-lock.yaml"),
      `lockfileVersion: '9.0'\n\nimporters:\n  .: {}\n`,
    );
    createFileSystemProject({ rootDirectory: tmpDir, packageManager: "pnpm" });
    const hintCall = warnSpy.mock.calls.find(
      ([msg]: [string]) =>
        typeof msg === "string" && msg.includes("No workspaces declared"),
    );
    expect(hintCall).toBeUndefined();
  });
});
