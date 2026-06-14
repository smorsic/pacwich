import path from "path";
import { resolvePackageManagerAdapter } from "../../../src/packageManager/adapter";
import { makeTestWorkspace } from "../../util/testData";
import { describe, expect, test } from "../../util/testFramework";

/**
 * Pins the exact pnpm-specific script command form. Like npm, pnpm
 * needs the `--` separator before appended args so they reach the
 * script rather than being interpreted as further script names. The
 * PM-agnostic conformance contract lives in
 * tests/packageManagers/pmMatrix/adapter/scriptCommand.test.ts.
 */

describe("pnpm adapter: createScriptCommand", () => {
  const adapter = resolvePackageManagerAdapter("pnpm");
  const workspace = makeTestWorkspace({ name: "a", path: "packages/a" });
  const rootDirectory = "/abs/project";

  test("emits `pnpm run --silent <scriptName>` with no args (no -- separator)", () => {
    const result = adapter.createScriptCommand({
      scriptName: "build",
      args: "",
      workspace,
      rootDirectory,
    });
    expect(result.command).toBe("pnpm run --silent build");
    expect(result.workingDirectory).toBe(
      path.resolve(rootDirectory, "packages/a"),
    );
  });

  test("inserts a `--` separator before appended args", () => {
    const result = adapter.createScriptCommand({
      scriptName: "build",
      args: "--flag=value",
      workspace,
      rootDirectory,
    });
    expect(result.command).toBe("pnpm run --silent build -- --flag=value");
  });
});
