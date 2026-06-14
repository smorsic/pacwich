import fs from "fs";
import os from "os";
import path from "path";
import { BUN_LOCK_ERRORS } from "../../../src/packageManager/backends/bun/lockfile/parseBunLock";
import { createFileSystemProject } from "../../../src/project";
import { describe, expect, test } from "../../util/testFramework";
import { withWindowsPath } from "../../util/windows";

/**
 * Bun-specific behavior of `createFileSystemProject`. The PM-agnostic
 * sibling lives at `tests/api/fileSystemProject/simpleMembers.test.ts`.
 */

describe("createFileSystemProject — bun backend", () => {
  test("--pm bun on an empty dir (no bun.lock) throws BunLockNotFound", () => {
    // Pinning --pm bun skips auto-detection and routes straight to
    // the bun adapter, which surfaces its own missing-lockfile error.
    // (Without the pin, auto-detect-failure would fire first; that
    // path lives in tests/packageManagers/selection/resolveValue.test.ts.)
    //
    // Use an isolated tmp dir so the default walk-up has no
    // workspaces-field ancestor to land on — the project falls back
    // to the tmp dir itself, and the bun adapter sees no bun.lock.
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pacwich-no-lock-"));
    try {
      fs.writeFileSync(
        path.join(tmpDir, "package.json"),
        JSON.stringify({
          name: "no-lock-project",
          version: "1.0.0",
          workspaces: ["packages/*"],
        }),
      );
      expect(() =>
        createFileSystemProject({
          packageManager: "bun",
          rootDirectory: tmpDir,
        }),
      ).toThrow(BUN_LOCK_ERRORS.BunLockNotFound);
      expect(() =>
        createFileSystemProject({
          packageManager: "bun",
          rootDirectory: tmpDir,
        }),
      ).toThrow(`No bun.lock found at ${withWindowsPath(tmpDir)}.`);
    } finally {
      fs.rmSync(tmpDir, { force: true, recursive: true });
    }
  });
});
