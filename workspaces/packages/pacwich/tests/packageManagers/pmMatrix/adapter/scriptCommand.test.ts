import path from "path";
import { resolvePackageManagerAdapter } from "../../../../src/packageManager/adapter";
import { describeEachPm } from "../../../util/pmMatrix";
import { makeTestWorkspace } from "../../../util/testData";
import { describe, expect, test } from "../../../util/testFramework";

/**
 * Asserts the returned `ScriptCommand` shape: a non-empty `command`
 * string and an absolute `workingDirectory` resolved from the
 * workspace path. The exact `command` text is backend-specific (bun
 * emits `bun --silent run …`) and is not asserted by the conformance
 * contract; what matters is that the command includes the script name
 * and any provided args.
 */

describeEachPm("adapter conformance: createScriptCommand", ({ pm }) => {
  const adapter = resolvePackageManagerAdapter(pm.id);
  const rootDirectory = "/abs/project";
  const workspace = makeTestWorkspace({
    name: "a",
    path: "packages/a",
  });

  describe("shape", () => {
    test("returns an object with `command` and `workingDirectory`", () => {
      const result = adapter.createScriptCommand({
        scriptName: "build",
        args: "",
        workspace,
        rootDirectory,
      });
      expect(typeof result.command).toBe("string");
      expect(result.command.length).toBeGreaterThan(0);
      expect(typeof result.workingDirectory).toBe("string");
    });

    test("workingDirectory is an absolute path under the project root", () => {
      const result = adapter.createScriptCommand({
        scriptName: "build",
        args: "",
        workspace,
        rootDirectory,
      });
      expect(path.isAbsolute(result.workingDirectory)).toBe(true);
      expect(result.workingDirectory).toBe(
        path.resolve(rootDirectory, workspace.path),
      );
    });
  });

  describe("script name and args", () => {
    test("command includes the script name", () => {
      const result = adapter.createScriptCommand({
        scriptName: "my-unique-script",
        args: "",
        workspace,
        rootDirectory,
      });
      expect(result.command).toContain("my-unique-script");
    });

    test("command includes appended args when provided", () => {
      const result = adapter.createScriptCommand({
        scriptName: "build",
        args: "--my-flag --another=value",
        workspace,
        rootDirectory,
      });
      expect(result.command).toContain("--my-flag");
      expect(result.command).toContain("--another=value");
    });

    test("command omits trailing whitespace when no args are provided", () => {
      const result = adapter.createScriptCommand({
        scriptName: "build",
        args: "",
        workspace,
        rootDirectory,
      });
      expect(result.command).toBe(result.command.trimEnd());
    });
  });

  describe("root workspace", () => {
    test("workingDirectory for a root workspace resolves to the project root", () => {
      const rootWorkspace = makeTestWorkspace({
        name: "test-root",
        isRoot: true,
        path: "",
      });
      const result = adapter.createScriptCommand({
        scriptName: "build",
        args: "",
        workspace: rootWorkspace,
        rootDirectory,
      });
      expect(result.workingDirectory).toBe(
        path.resolve(rootDirectory, rootWorkspace.path),
      );
    });
  });
});
