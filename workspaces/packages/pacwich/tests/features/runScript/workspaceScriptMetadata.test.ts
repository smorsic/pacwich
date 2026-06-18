import path from "path";
import { PacwichError, createFileSystemProject } from "../../../src";
import { IS_WINDOWS } from "../../../src/internal/core";
import {
  getWorkspaceScriptMetadata,
  interpolateWorkspaceScriptMetadata,
  quoteShellValue,
} from "../../../src/runScript/workspaceScriptMetadata";
import { getProjectRoot } from "../../fixtures/testProjects";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
} from "../../util/testFramework";
import { withWindowsPath } from "../../util/windows";

const baseMetadata = {
  projectPath: "/path/to/project",
  projectName: "my-project",
  workspacePath: "/path/to/project/packages/a",
  workspaceRelativePath: "packages/a",
  workspaceName: "workspace-a",
  scriptName: "lint",
};

const METADATA_KEYS = [
  { key: "projectPath", envVar: "PACWICH_PROJECT_PATH" },
  { key: "projectName", envVar: "PACWICH_PROJECT_NAME" },
  { key: "workspacePath", envVar: "PACWICH_WORKSPACE_PATH" },
  { key: "workspaceRelativePath", envVar: "PACWICH_WORKSPACE_RELATIVE_PATH" },
  { key: "workspaceName", envVar: "PACWICH_WORKSPACE_NAME" },
  { key: "scriptName", envVar: "PACWICH_SCRIPT_NAME" },
] as const;

describe("getWorkspaceScriptMetadata", () => {
  const originalValues: Partial<Record<string, string>> = {};

  beforeEach(() => {
    for (const { envVar } of METADATA_KEYS) {
      originalValues[envVar] = process.env[envVar];
      delete process.env[envVar];
    }
  });

  afterEach(() => {
    for (const { envVar } of METADATA_KEYS) {
      const original = originalValues[envVar];
      if (original === undefined) {
        delete process.env[envVar];
      } else {
        process.env[envVar] = original;
      }
    }
  });

  describe("returns env var value when set", () => {
    for (const { key, envVar } of METADATA_KEYS) {
      test(key, () => {
        const testValue = `test-value-for-${key}`;
        process.env[envVar] = testValue;
        expect(getWorkspaceScriptMetadata(key)).toBe(testValue);
      });
    }
  });

  describe("throws PacwichError when env var is not set", () => {
    for (const { key, envVar } of METADATA_KEYS) {
      test(key, () => {
        expect(() => getWorkspaceScriptMetadata(key)).toThrow(PacwichError);
        expect(() => getWorkspaceScriptMetadata(key)).toThrow(envVar);
        expect(() => getWorkspaceScriptMetadata(key)).toThrow(key);
      });
    }
  });
});

describe("quoteShellValue", () => {
  describe("bun shell", () => {
    test("plain value with no special chars passes through", () => {
      expect(quoteShellValue("hello", "bun")).toBe("hello");
    });

    test("value with semicolon is escaped", () => {
      expect(quoteShellValue("a;b", "bun")).toBe("a\\;b");
    });

    test("value with dollar is escaped", () => {
      expect(quoteShellValue("a$b", "bun")).toBe("a\\$b");
    });

    test("value with command substitution is escaped", () => {
      expect(quoteShellValue("$(evil)", "bun")).toBe("\\$\\(evil\\)");
    });

    test("value with single quote uses double-quote wrap", () => {
      expect(quoteShellValue("a'b", "bun")).toBe(`"a'b"`);
    });

    test("empty value is quoted as empty token", () => {
      expect(quoteShellValue("", "bun")).toBe("''");
    });
  });

  if (!IS_WINDOWS) {
    describe("system shell on POSIX", () => {
      test("value with semicolon is escaped", () => {
        expect(quoteShellValue("a;b", "system")).toBe("a\\;b");
      });

      test("value with backticks is escaped", () => {
        expect(quoteShellValue("a`b", "system")).toBe("a\\`b");
      });
    });
  }

  if (IS_WINDOWS) {
    describe("system shell on Windows", () => {
      test("plain value is double-quoted", () => {
        expect(quoteShellValue("hello", "system")).toBe('"hello"');
      });

      test("internal double quotes are doubled", () => {
        expect(quoteShellValue('he"llo', "system")).toBe('"he""llo"');
      });
    });
  }
});

describe("interpolateWorkspaceScriptMetadata", () => {
  describe("quoteValues: false (default)", () => {
    test("substitutes raw values", () => {
      expect(
        interpolateWorkspaceScriptMetadata({
          text: "--ws=<workspaceName>",
          metadata: baseMetadata,
          shell: "bun",
        }),
      ).toBe("--ws=workspace-a");
    });

    test("does not quote shell metacharacters in values", () => {
      expect(
        interpolateWorkspaceScriptMetadata({
          text: "--dir=<workspacePath>",
          metadata: { ...baseMetadata, workspacePath: "/a;evil" },
          shell: "bun",
        }),
      ).toBe("--dir=/a;evil");
    });
  });

  describe("quoteValues: true", () => {
    test("plain value with no metacharacters needs no quoting", () => {
      expect(
        interpolateWorkspaceScriptMetadata({
          text: "--ws=<workspaceName>",
          metadata: baseMetadata,
          shell: "bun",
          quoteValues: true,
        }),
      ).toBe("--ws=workspace-a");
    });

    test("value with semicolon is escaped (bun shell)", () => {
      expect(
        interpolateWorkspaceScriptMetadata({
          text: "--dir=<workspacePath>",
          metadata: { ...baseMetadata, workspacePath: "/a;evil" },
          shell: "bun",
          quoteValues: true,
        }),
      ).toBe("--dir=/a\\;evil");
    });

    test("value with command substitution is escaped (bun shell)", () => {
      expect(
        interpolateWorkspaceScriptMetadata({
          text: "build <workspacePath>",
          metadata: { ...baseMetadata, workspacePath: "$(curl evil)" },
          shell: "bun",
          quoteValues: true,
        }),
      ).toBe("build '$(curl evil)'");
    });

    test("multiple substitutions are independently quoted", () => {
      expect(
        interpolateWorkspaceScriptMetadata({
          text: "<workspaceName> at <workspacePath>",
          metadata: { ...baseMetadata, workspacePath: "/a b;c" },
          shell: "bun",
          quoteValues: true,
        }),
      ).toBe("workspace-a at '/a b;c'");
    });

    if (!IS_WINDOWS) {
      test("system shell on POSIX escapes metacharacters", () => {
        expect(
          interpolateWorkspaceScriptMetadata({
            text: "echo <workspacePath>",
            metadata: { ...baseMetadata, workspacePath: "/a;b" },
            shell: "system",
            quoteValues: true,
          }),
        ).toBe("echo /a\\;b");
      });
    }

    if (IS_WINDOWS) {
      test("system shell on Windows uses double-quote doubling", () => {
        expect(
          interpolateWorkspaceScriptMetadata({
            text: "echo <workspacePath>",
            metadata: { ...baseMetadata, workspacePath: 'C:\\a"b' },
            shell: "system",
            quoteValues: true,
          }),
        ).toBe('echo "C:\\a""b"');
      });
    }
  });
});

describe("inline script metadata interpolation does not allow injection", () => {
  const projectRoot = getProjectRoot("runScriptWithScriptMetadataApi");

  test("scriptName containing shell metacharacters does not execute", async () => {
    const project = createFileSystemProject({ rootDirectory: projectRoot });

    // Before the quoting fix, the substituted scriptName would have ended the
    // first echo and then run a second echo, surfacing INJECTED in stdout.
    const { output, exit } = project.runWorkspaceScript({
      workspaceNameOrAlias: "workspace-a",
      script: "echo running:<scriptName>",
      inline: { scriptName: "safe; echo INJECTED" },
    });

    let stdout = "";
    for await (const { chunk, metadata } of output.text()) {
      if (metadata.streamName === "stdout") stdout += chunk;
    }
    await exit;

    expect(stdout).toContain("running:safe; echo INJECTED");
    expect(stdout).not.toContain("\nINJECTED");
  });
});

describe("getWorkspaceScriptMetadata (integration)", () => {
  const projectRoot = getProjectRoot("runScriptWithScriptMetadataApi");

  test("returns real metadata values from a script running via pacwich", async () => {
    const project = createFileSystemProject({ rootDirectory: projectRoot });
    const { output, exit } = project.runWorkspaceScript({
      workspaceNameOrAlias: "workspace-a",
      script: "get-metadata",
    });

    let stdout = "";
    for await (const { chunk, metadata } of output.text()) {
      if (metadata.streamName === "stdout") stdout += chunk;
    }
    await exit;

    const result = JSON.parse(stdout.trim());

    expect(result.projectPath).toBe(projectRoot);
    expect(result.projectName).toBe("test-root");
    expect(result.workspacePath).toBe(
      withWindowsPath(path.join(projectRoot, "packages/workspace-a")),
    );
    expect(result.workspaceRelativePath).toBe("packages/workspace-a");
    expect(result.workspaceName).toBe("workspace-a");
    expect(result.scriptName).toBe("get-metadata");
  });
});
