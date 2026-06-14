import path from "path";
import { resolvePackageManagerAdapter } from "../../../src/packageManager/adapter";
import { makeTestWorkspace } from "../../util/testData";
import { describe, expect, test } from "../../util/testFramework";

/**
 * Pins the exact bun-specific script command form: bun does not need
 * a `--` separator (its `--silent` already suppresses pre-script
 * banners and bun passes positional args straight through). The
 * PM-agnostic conformance contract lives in
 * tests/packageManagers/pmMatrix/adapter/scriptCommand.test.ts.
 */

describe("bun adapter: createScriptCommand", () => {
  const adapter = resolvePackageManagerAdapter("bun");
  const workspace = makeTestWorkspace({ name: "a", path: "packages/a" });
  const rootDirectory = "/abs/project";

  test("emits `bun --silent run <scriptName>` with no args", () => {
    const result = adapter.createScriptCommand({
      scriptName: "build",
      args: "",
      workspace,
      rootDirectory,
    });
    expect(result.command).toBe("bun --silent run build");
    expect(result.workingDirectory).toBe(
      path.resolve(rootDirectory, "packages/a"),
    );
  });

  test("appends args directly without a `--` separator", () => {
    const result = adapter.createScriptCommand({
      scriptName: "build",
      args: "--flag=value",
      workspace,
      rootDirectory,
    });
    expect(result.command).toBe("bun --silent run build --flag=value");
  });
});
