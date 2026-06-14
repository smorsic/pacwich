import path from "path";
import { resolvePackageManagerAdapter } from "../../../src/packageManager/adapter";
import { makeTestWorkspace } from "../../util/testData";
import { describe, expect, test } from "../../util/testFramework";

/**
 * Pins the exact npm-specific script command form. The `--`
 * separator before appended args is load-bearing — without it npm
 * would interpret the args as additional script names. The
 * PM-agnostic conformance contract lives in
 * tests/packageManagers/pmMatrix/adapter/scriptCommand.test.ts.
 */

describe("npm adapter: createScriptCommand", () => {
  const adapter = resolvePackageManagerAdapter("npm");
  const workspace = makeTestWorkspace({ name: "a", path: "packages/a" });
  const rootDirectory = "/abs/project";

  test("emits `npm run --silent <scriptName>` with no args (no -- separator)", () => {
    const result = adapter.createScriptCommand({
      scriptName: "build",
      args: "",
      workspace,
      rootDirectory,
    });
    expect(result.command).toBe("npm run --silent build");
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
    expect(result.command).toBe("npm run --silent build -- --flag=value");
  });
});
