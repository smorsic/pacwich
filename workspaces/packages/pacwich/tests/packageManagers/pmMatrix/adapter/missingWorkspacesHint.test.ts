import fs from "fs";
import os from "os";
import path from "path";
import { resolvePackageManagerAdapter } from "../../../../src/packageManager/adapter";
import { describeEachPm } from "../../../util/pmMatrix";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
} from "../../../util/testFramework";

/**
 * `describeMissingWorkspacesHint` is the per-adapter hint shown when a
 * project loads with no nested workspaces AND no workspace config in
 * place. Each backend checks its own "is the config present" signal:
 * bun and npm look at `package.json.workspaces`; pnpm looks for a
 * `pnpm-workspace.yaml` on disk. Empty-but-present config (`[]` or a
 * yaml with no `packages` key) is deliberate and skips the hint.
 *
 * Tests build a tmpdir per case so they don't depend on which
 * `testProjects` fixtures happen to ship a lockfile.
 */
describeEachPm("adapter: describeMissingWorkspacesHint", ({ pm }) => {
  const adapter = resolvePackageManagerAdapter(pm.id);
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(
      path.join(os.tmpdir(), `pacwich-missing-ws-${pm.id}-`),
    );
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { force: true, recursive: true });
  });

  test("hook is defined for every shipped backend", () => {
    expect(typeof adapter.describeMissingWorkspacesHint).toBe("function");
  });

  test("returns a non-empty hint when workspace config is absent", () => {
    const rootPackageJson: Record<string, unknown> = { name: "missing-root" };
    const result = adapter.describeMissingWorkspacesHint!({
      rootDirectory: tmpDir,
      rootPackageJson,
    });
    expect(typeof result).toBe("string");
    expect(result?.length).toBeGreaterThan(0);
    expect(result).toContain("No workspaces declared");
  });

  test("returns null when configuration is present but empty (deliberate)", () => {
    const rootPackageJson: Record<string, unknown> =
      pm.id === "pnpm"
        ? { name: "with-empty-config" }
        : { name: "with-empty-config", workspaces: [] };
    if (pm.id === "pnpm") {
      // Empty config = pnpm-workspace.yaml exists but has no packages
      // key (or any key); the file's mere presence signals deliberate
      // config, not a misconfiguration.
      fs.writeFileSync(path.join(tmpDir, "pnpm-workspace.yaml"), "");
    }
    const result = adapter.describeMissingWorkspacesHint!({
      rootDirectory: tmpDir,
      rootPackageJson,
    });
    expect(result).toBeNull();
  });
});
