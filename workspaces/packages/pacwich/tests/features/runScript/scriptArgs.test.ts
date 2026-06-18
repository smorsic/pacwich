import { createFileSystemProject } from "../../../src";
import { IS_WINDOWS } from "../../../src/internal/core";
import { getProjectRoot } from "../../fixtures/testProjects";
import { setupCliTest } from "../../util/cliTestUtils";
import { collectStdout } from "../../util/collectOutput";
import { describe, expect, test } from "../../util/testFramework";

const TEST_PROJECT = "runScriptWithDebugArgv" as const;

// Skip tests that rely on POSIX single-quote syntax on Windows
const testNonWindows = test.skipIf(IS_WINDOWS);
// Skip tests that rely on Windows cmd double-quote syntax on non-Windows
const testWindowsOnly = test.skipIf(!IS_WINDOWS);

const collectOutputText = async (output: {
  text: () => AsyncIterable<{ chunk: string }>;
}): Promise<string> => {
  let text = "";
  for await (const { chunk } of output.text()) {
    text += chunk;
  }
  return text;
};

/** Extracts lines from output that parse as string arrays (from debugArgv.ts) */
const parseArgvLines = (text: string): string[][] =>
  text.split("\n").flatMap((line) => {
    const trimmed = line.trim();
    if (!trimmed.startsWith("[")) return [];
    try {
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed) && parsed.every((s) => typeof s === "string")
        ? [parsed]
        : [];
    } catch {
      return [];
    }
  });

describe("Script args", () => {
  describe("API: runWorkspaceScript", () => {
    const getProject = () =>
      createFileSystemProject({ rootDirectory: getProjectRoot(TEST_PROJECT) });

    testNonWindows("quoted string passes as single arg (string)", async () => {
      const { output } = getProject().runWorkspaceScript({
        workspaceNameOrAlias: "workspace-a",
        script: "debug-argv",
        args: "'hello world'",
      });
      const text = await collectOutputText(output);
      expect(parseArgvLines(text)).toEqual([["hello world"]]);
    });

    testNonWindows(
      "quoted string passes as single arg (string[])",
      async () => {
        const { output } = getProject().runWorkspaceScript({
          workspaceNameOrAlias: "workspace-a",
          script: "debug-argv",
          args: ["hello world"],
        });
        const text = await collectOutputText(output);
        expect(parseArgvLines(text)).toEqual([["hello world"]]);
      },
    );

    test("operator passes through shell (string)", async () => {
      const { output } = getProject().runWorkspaceScript({
        workspaceNameOrAlias: "workspace-a",
        script: "debug-argv",
        args: "first-arg && echo operator-passed",
      });
      const text = await collectOutputText(output);
      expect(parseArgvLines(text)).toContainEqual(["first-arg"]);
      expect(text).toContain("operator-passed");
    });

    test("glob pattern passes through unquoted (string)", async () => {
      const { output } = getProject().runWorkspaceScript({
        workspaceNameOrAlias: "workspace-a",
        script: "debug-argv",
        args: "no-match/**/*",
      });
      const text = await collectOutputText(output);
      expect(parseArgvLines(text)).toContainEqual(["no-match/**/*"]);
    });

    testNonWindows(
      "glob pattern in array is quoted as literal (string[])",
      async () => {
        const { output } = getProject().runWorkspaceScript({
          workspaceNameOrAlias: "workspace-a",
          script: "debug-argv",
          args: ["no-match/**/*"],
        });
        const text = await collectOutputText(output);
        expect(parseArgvLines(text)).toContainEqual(["no-match/**/*"]);
      },
    );

    test("metadata is interpolated (string)", async () => {
      const { output } = getProject().runWorkspaceScript({
        workspaceNameOrAlias: "workspace-a",
        script: "debug-argv",
        args: "--name=<workspaceName> --rel=<workspaceRelativePath>",
      });
      const text = await collectOutputText(output);
      expect(parseArgvLines(text)).toContainEqual([
        "--name=workspace-a",
        `--rel=packages/workspace-a`,
      ]);
    });

    test("metadata is interpolated (string[])", async () => {
      const { output } = getProject().runWorkspaceScript({
        workspaceNameOrAlias: "workspace-a",
        script: "debug-argv",
        args: ["--name=<workspaceName>", "--rel=<workspaceRelativePath>"],
      });
      const text = await collectOutputText(output);
      expect(parseArgvLines(text)).toContainEqual([
        "--name=workspace-a",
        `--rel=packages/workspace-a`,
      ]);
    });

    testNonWindows("mix: quoted string and metadata (string)", async () => {
      const { output } = getProject().runWorkspaceScript({
        workspaceNameOrAlias: "workspace-a",
        script: "debug-argv",
        args: "'spaced value' --name=<workspaceName>",
      });
      const text = await collectOutputText(output);
      expect(parseArgvLines(text)).toContainEqual([
        "spaced value",
        "--name=workspace-a",
      ]);
    });

    testNonWindows("mix: quoted string and metadata (string[])", async () => {
      const { output } = getProject().runWorkspaceScript({
        workspaceNameOrAlias: "workspace-a",
        script: "debug-argv",
        args: ["spaced value", "--name=<workspaceName>"],
      });
      const text = await collectOutputText(output);
      expect(parseArgvLines(text)).toContainEqual([
        "spaced value",
        "--name=workspace-a",
      ]);
    });

    testNonWindows(
      "mix: quoted string, metadata, and operator (string)",
      async () => {
        const { output } = getProject().runWorkspaceScript({
          workspaceNameOrAlias: "workspace-a",
          script: "debug-argv",
          args: "'spaced value' --name=<workspaceName> && echo mix-op-passed",
        });
        const text = await collectOutputText(output);
        expect(parseArgvLines(text)).toContainEqual([
          "spaced value",
          "--name=workspace-a",
        ]);
        expect(text).toContain("mix-op-passed");
      },
    );

    testNonWindows(
      "mix: quoted string, metadata, and glob (string)",
      async () => {
        const { output } = getProject().runWorkspaceScript({
          workspaceNameOrAlias: "workspace-a",
          script: "debug-argv",
          args: "'spaced value' --name=<workspaceName> no-match/**/*",
        });
        const text = await collectOutputText(output);
        expect(parseArgvLines(text)).toContainEqual([
          "spaced value",
          "--name=workspace-a",
          "no-match/**/*",
        ]);
      },
    );

    testWindowsOnly(
      "quoted string passes as single arg via cmd quoting (string[])",
      async () => {
        const { output } = getProject().runWorkspaceScript({
          workspaceNameOrAlias: "workspace-a",
          script: "debug-argv",
          args: ["hello world"],
        });
        const text = await collectOutputText(output);
        expect(parseArgvLines(text)).toEqual([["hello world"]]);
      },
    );

    testWindowsOnly(
      "quoted string passes as single arg via cmd quoting (string)",
      async () => {
        const { output } = getProject().runWorkspaceScript({
          workspaceNameOrAlias: "workspace-a",
          script: "debug-argv",
          args: "'hello world'",
        });
        const text = await collectOutputText(output);
        expect(parseArgvLines(text)).toEqual([["hello world"]]);
      },
    );

    testWindowsOnly(
      "mix: quoted string and metadata via cmd quoting (string[])",
      async () => {
        const { output } = getProject().runWorkspaceScript({
          workspaceNameOrAlias: "workspace-a",
          script: "debug-argv",
          args: ["spaced value", "--name=<workspaceName>"],
        });
        const text = await collectOutputText(output);
        expect(parseArgvLines(text)).toContainEqual([
          "spaced value",
          "--name=workspace-a",
        ]);
      },
    );
  });

  describe("API: runScriptAcrossWorkspaces", () => {
    const getProject = () =>
      createFileSystemProject({ rootDirectory: getProjectRoot(TEST_PROJECT) });

    testNonWindows(
      "quoted string passes as single arg per workspace (string)",
      async () => {
        const { output } = getProject().runScriptAcrossWorkspaces({
          workspacePatterns: ["workspace-a", "workspace-b"],
          script: "debug-argv",
          args: "'hello world'",
          parallel: false,
        });
        const text = await collectOutputText(output);
        const argvLines = parseArgvLines(text);
        expect(argvLines).toHaveLength(2);
        for (const line of argvLines) {
          expect(line).toEqual(["hello world"]);
        }
      },
    );

    testNonWindows(
      "quoted string passes as single arg per workspace (string[])",
      async () => {
        const { output } = getProject().runScriptAcrossWorkspaces({
          workspacePatterns: ["workspace-a", "workspace-b"],
          script: "debug-argv",
          args: ["hello world"],
          parallel: false,
        });
        const text = await collectOutputText(output);
        const argvLines = parseArgvLines(text);
        expect(argvLines).toHaveLength(2);
        for (const line of argvLines) {
          expect(line).toEqual(["hello world"]);
        }
      },
    );

    test("metadata is interpolated per workspace (string)", async () => {
      const { output } = getProject().runScriptAcrossWorkspaces({
        workspacePatterns: ["workspace-a", "workspace-b"],
        script: "debug-argv",
        args: "--name=<workspaceName>",
        parallel: false,
      });
      const chunks = await collectStdout(output);
      expect(chunks).toHaveLength(2);
      for (const { text, metadata } of chunks) {
        expect(JSON.parse(text)).toEqual([`--name=${metadata.workspace.name}`]);
      }
    });

    test("metadata is interpolated per workspace (string[])", async () => {
      const { output } = getProject().runScriptAcrossWorkspaces({
        workspacePatterns: ["workspace-a", "workspace-b"],
        script: "debug-argv",
        args: ["--name=<workspaceName>", "--rel=<workspaceRelativePath>"],
        parallel: false,
      });
      const chunks = await collectStdout(output);
      expect(chunks).toHaveLength(2);
      for (const { text, metadata } of chunks) {
        expect(JSON.parse(text)).toEqual([
          `--name=${metadata.workspace.name}`,
          `--rel=${metadata.workspace.path}`,
        ]);
      }
    });

    testNonWindows(
      "mix: quoted string and metadata per workspace (string)",
      async () => {
        const { output } = getProject().runScriptAcrossWorkspaces({
          workspacePatterns: ["workspace-a", "workspace-b"],
          script: "debug-argv",
          args: "'spaced value' --name=<workspaceName>",
          parallel: false,
        });
        const chunks = await collectStdout(output);
        expect(chunks).toHaveLength(2);
        for (const { text, metadata } of chunks) {
          expect(JSON.parse(text)).toEqual([
            "spaced value",
            `--name=${metadata.workspace.name}`,
          ]);
        }
      },
    );

    testNonWindows(
      "mix: quoted string and metadata per workspace (string[])",
      async () => {
        const { output } = getProject().runScriptAcrossWorkspaces({
          workspacePatterns: ["workspace-a", "workspace-b"],
          script: "debug-argv",
          args: ["spaced value", "--name=<workspaceName>"],
          parallel: false,
        });
        const chunks = await collectStdout(output);
        expect(chunks).toHaveLength(2);
        for (const { text, metadata } of chunks) {
          expect(JSON.parse(text)).toEqual([
            "spaced value",
            `--name=${metadata.workspace.name}`,
          ]);
        }
      },
    );

    testWindowsOnly(
      "quoted string passes per workspace via cmd quoting (string[])",
      async () => {
        const { output } = getProject().runScriptAcrossWorkspaces({
          workspacePatterns: ["workspace-a", "workspace-b"],
          script: "debug-argv",
          args: ["hello world"],
          parallel: false,
        });
        const text = await collectOutputText(output);
        const argvLines = parseArgvLines(text);
        expect(argvLines).toHaveLength(2);
        for (const line of argvLines) {
          expect(line).toEqual(["hello world"]);
        }
      },
    );

    testWindowsOnly(
      "mix: quoted string and metadata per workspace via cmd quoting (string[])",
      async () => {
        const { output } = getProject().runScriptAcrossWorkspaces({
          workspacePatterns: ["workspace-a", "workspace-b"],
          script: "debug-argv",
          args: ["spaced value", "--name=<workspaceName>"],
          parallel: false,
        });
        const chunks = await collectStdout(output);
        expect(chunks).toHaveLength(2);
        for (const { text, metadata } of chunks) {
          expect(JSON.parse(text)).toEqual([
            "spaced value",
            `--name=${metadata.workspace.name}`,
          ]);
        }
      },
    );
  });

  describe("CLI: --args", () => {
    const { run } = setupCliTest({ testProject: TEST_PROJECT });

    testNonWindows("quoted string passes as single arg", async () => {
      const result = await run(
        "run-script",
        "debug-argv",
        "workspace-a",
        "--args='hello world'",
        "--output-style=plain",
      );
      expect(result.exitCode).toBe(0);
      expect(
        parseArgvLines(result.stdout.sanitizedCompactLines),
      ).toContainEqual(["hello world"]);
    });

    test("operator passes through shell", async () => {
      const result = await run(
        "run-script",
        "debug-argv",
        "workspace-a",
        "--args=first-arg && echo operator-passed",
        "--output-style=plain",
      );
      expect(result.exitCode).toBe(0);
      expect(
        parseArgvLines(result.stdout.sanitizedCompactLines),
      ).toContainEqual(["first-arg"]);
      expect(result.stdout.sanitizedCompactLines).toContain("operator-passed");
    });

    test("glob pattern passes through", async () => {
      const result = await run(
        "run-script",
        "debug-argv",
        "workspace-a",
        "--args=no-match/**/*",
        "--output-style=plain",
      );
      expect(result.exitCode).toBe(0);
      expect(
        parseArgvLines(result.stdout.sanitizedCompactLines),
      ).toContainEqual(["no-match/**/*"]);
    });

    test("metadata is interpolated", async () => {
      const result = await run(
        "run-script",
        "debug-argv",
        "workspace-a",
        "--args=--name=<workspaceName> --rel=<workspaceRelativePath>",
        "--output-style=plain",
      );
      expect(result.exitCode).toBe(0);
      expect(
        parseArgvLines(result.stdout.sanitizedCompactLines),
      ).toContainEqual(["--name=workspace-a", `--rel=packages/workspace-a`]);
    });

    testNonWindows("mix: quoted string and metadata", async () => {
      const result = await run(
        "run-script",
        "debug-argv",
        "workspace-a",
        "--args='spaced value' --name=<workspaceName>",
        "--output-style=plain",
      );
      expect(result.exitCode).toBe(0);
      expect(
        parseArgvLines(result.stdout.sanitizedCompactLines),
      ).toContainEqual(["spaced value", "--name=workspace-a"]);
    });

    testNonWindows("mix: quoted string, metadata, and glob", async () => {
      const result = await run(
        "run-script",
        "debug-argv",
        "workspace-a",
        "--args='spaced value' --name=<workspaceName> no-match/**/*",
        "--output-style=plain",
      );
      expect(result.exitCode).toBe(0);
      expect(
        parseArgvLines(result.stdout.sanitizedCompactLines),
      ).toContainEqual(["spaced value", "--name=workspace-a", "no-match/**/*"]);
    });

    testNonWindows("mix: quoted string, metadata, and operator", async () => {
      const result = await run(
        "run-script",
        "debug-argv",
        "workspace-a",
        "--args='spaced value' --name=<workspaceName> && echo cli-mix-op-passed",
        "--output-style=plain",
      );
      expect(result.exitCode).toBe(0);
      expect(
        parseArgvLines(result.stdout.sanitizedCompactLines),
      ).toContainEqual(["spaced value", "--name=workspace-a"]);
      expect(result.stdout.sanitizedCompactLines).toContain(
        "cli-mix-op-passed",
      );
    });

    testWindowsOnly(
      "quoted string passes as single arg via cmd quoting",
      async () => {
        const result = await run(
          "run-script",
          "debug-argv",
          "workspace-a",
          '--args="hello world"',
          "--output-style=plain",
        );
        expect(result.exitCode).toBe(0);
        expect(
          parseArgvLines(result.stdout.sanitizedCompactLines),
        ).toContainEqual(["hello world"]);
      },
    );

    testWindowsOnly(
      "mix: quoted string and metadata via cmd quoting",
      async () => {
        const result = await run(
          "run-script",
          "debug-argv",
          "workspace-a",
          '--args="spaced value" --name=<workspaceName>',
          "--output-style=plain",
        );
        expect(result.exitCode).toBe(0);
        expect(
          parseArgvLines(result.stdout.sanitizedCompactLines),
        ).toContainEqual(["spaced value", "--name=workspace-a"]);
      },
    );
  });

  describe("CLI: post-terminator (--)", () => {
    const { run } = setupCliTest({ testProject: TEST_PROJECT });

    testNonWindows("arg with space passes as single arg", async () => {
      const result = await run(
        "run-script",
        "debug-argv",
        "workspace-a",
        "--output-style=plain",
        "--",
        "hello world",
      );
      expect(result.exitCode).toBe(0);
      expect(
        parseArgvLines(result.stdout.sanitizedCompactLines),
      ).toContainEqual(["hello world"]);
    });

    testNonWindows("multiple args including one with space", async () => {
      const result = await run(
        "run-script",
        "debug-argv",
        "workspace-a",
        "--output-style=plain",
        "--",
        "hello world",
        "--flag",
      );
      expect(result.exitCode).toBe(0);
      expect(
        parseArgvLines(result.stdout.sanitizedCompactLines),
      ).toContainEqual(["hello world", "--flag"]);
    });

    test("glob pattern is quoted as literal", async () => {
      const result = await run(
        "run-script",
        "debug-argv",
        "workspace-a",
        "--output-style=plain",
        "--",
        "no-match/**/*",
      );
      expect(result.exitCode).toBe(0);
      expect(
        parseArgvLines(result.stdout.sanitizedCompactLines),
      ).toContainEqual(["no-match/**/*"]);
    });

    test("metadata is interpolated", async () => {
      const result = await run(
        "run-script",
        "debug-argv",
        "workspace-a",
        "--output-style=plain",
        "--",
        "--name=<workspaceName>",
        "--rel=<workspaceRelativePath>",
      );
      expect(result.exitCode).toBe(0);
      expect(
        parseArgvLines(result.stdout.sanitizedCompactLines),
      ).toContainEqual(["--name=workspace-a", `--rel=packages/workspace-a`]);
    });

    testNonWindows("mix: arg with space and metadata", async () => {
      const result = await run(
        "run-script",
        "debug-argv",
        "workspace-a",
        "--output-style=plain",
        "--",
        "hello world",
        "--name=<workspaceName>",
      );
      expect(result.exitCode).toBe(0);
      expect(
        parseArgvLines(result.stdout.sanitizedCompactLines),
      ).toContainEqual(["hello world", "--name=workspace-a"]);
    });

    testNonWindows("mix: arg with space, metadata, and glob", async () => {
      const result = await run(
        "run-script",
        "debug-argv",
        "workspace-a",
        "--output-style=plain",
        "--",
        "hello world",
        "--name=<workspaceName>",
        "no-match/**/*",
      );
      expect(result.exitCode).toBe(0);
      expect(
        parseArgvLines(result.stdout.sanitizedCompactLines),
      ).toContainEqual(["hello world", "--name=workspace-a", "no-match/**/*"]);
    });

    testWindowsOnly(
      "arg with space passes as single arg via cmd quoting",
      async () => {
        const result = await run(
          "run-script",
          "debug-argv",
          "workspace-a",
          "--output-style=plain",
          "--",
          "hello world",
        );
        expect(result.exitCode).toBe(0);
        expect(
          parseArgvLines(result.stdout.sanitizedCompactLines),
        ).toContainEqual(["hello world"]);
      },
    );

    testWindowsOnly(
      "mix: arg with space and metadata via cmd quoting",
      async () => {
        const result = await run(
          "run-script",
          "debug-argv",
          "workspace-a",
          "--output-style=plain",
          "--",
          "hello world",
          "--name=<workspaceName>",
        );
        expect(result.exitCode).toBe(0);
        expect(
          parseArgvLines(result.stdout.sanitizedCompactLines),
        ).toContainEqual(["hello world", "--name=workspace-a"]);
      },
    );
  });
});
