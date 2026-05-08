import { afterEach, describe, expect, test } from "bun:test";
import { createMcpServer } from "../../../src/ai/mcp/core/server";
import { createMemoryTransport } from "../../../src/ai/mcp/core/transport";
import { setServerWorkingDirectory } from "../../../src/ai/mcp/serverState";
import { registerBwTools } from "../../../src/ai/mcp/tools";
import { BUN_WORKSPACES_VERSION } from "../../../src/internal/version";
import { getProjectRoot } from "../../fixtures/testProjects";

afterEach(() => setServerWorkingDirectory(null));

const callTool = async (
  projectName: "fullProject" | "workspaceTags" | null,
  toolName: string,
  args: Record<string, unknown> = {},
) => {
  if (projectName !== null) {
    setServerWorkingDirectory(getProjectRoot(projectName));
  }
  const transport = createMemoryTransport([
    {
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name: toolName, arguments: args },
    },
  ]);
  const server = createMcpServer({ name: "bun-workspaces", version: "0.0.0" });
  registerBwTools(server);
  await server.start(transport);
  const response = transport.sent[0] as {
    result?: { content: { text: string }[]; isError?: boolean };
  };
  const text = response.result?.content[0]?.text ?? "";
  let result: unknown = null;
  try {
    result = JSON.parse(text);
  } catch {
    result = text;
  }
  return { result, isError: response.result?.isError };
};

describe("bw MCP tools", () => {
  describe("version", () => {
    test("returns the version of bun-workspaces", async () => {
      const { result, isError } = await callTool("fullProject", "version");
      expect(isError).toBeUndefined();
      expect(result).toBeObject();
      expect((result as { version: string }).version).toBe(
        BUN_WORKSPACES_VERSION,
      );
    });

    test("returns version even without a project", async () => {
      const { result, isError } = await callTool(null, "version");
      expect(isError).toBeUndefined();
      expect((result as { version: string }).version).toBe(
        BUN_WORKSPACES_VERSION,
      );
    });
  });

  describe("root_info", () => {
    test("returns the root workspace", async () => {
      const { result, isError } = await callTool("fullProject", "root_info");
      expect(isError).toBeUndefined();
      expect(result).toBeObject();
      expect(result).toEqual({
        name: "test-root",
        aliases: [],
        path: "",
        matchPattern: "",
        isRoot: true,
        scripts: [],
        tags: [],
        dependencies: [],
        dependents: [],
        externalDependencies: [],
      });
    });

    test("returns error without a project", async () => {
      const { isError } = await callTool(null, "root_info");
      expect(isError).toBe(true);
    });
  });

  describe("list_workspaces", () => {
    test("returns all workspaces when no patterns", async () => {
      const { result, isError } = await callTool(
        "fullProject",
        "list_workspaces",
      );
      expect(isError).toBeUndefined();
      expect(result).toBeArray();
      expect((result as { name: string }[]).map((w) => w.name)).toEqual([
        "application-a",
        "application-b",
        "library-a",
        "library-b",
        "library-c",
      ]);
    });

    test("filters by name pattern", async () => {
      const { result, isError } = await callTool(
        "fullProject",
        "list_workspaces",
        {
          patterns: ["library-*"],
        },
      );
      expect(isError).toBeUndefined();
      expect((result as { name: string }[]).map((w) => w.name)).toEqual([
        "library-a",
        "library-b",
        "library-c",
      ]);
    });

    test("filters by path pattern", async () => {
      const { result } = await callTool("fullProject", "list_workspaces", {
        patterns: ["path:applications/*"],
      });
      expect((result as { name: string }[]).map((w) => w.name)).toEqual([
        "application-a",
        "application-b",
      ]);
    });

    test("returns empty array for unmatched pattern", async () => {
      const { result } = await callTool("fullProject", "list_workspaces", {
        patterns: ["does-not-exist"],
      });
      expect(result).toEqual([]);
    });

    test("returns error without a project", async () => {
      const { isError } = await callTool(null, "list_workspaces");
      expect(isError).toBe(true);
    });
  });

  describe("workspace_info", () => {
    test("returns workspace info by name", async () => {
      const { result, isError } = await callTool(
        "fullProject",
        "workspace_info",
        {
          nameOrAlias: "library-c",
        },
      );
      expect(isError).toBeUndefined();
      expect((result as { name: string }).name).toBe("library-c");
      expect((result as { scripts: string[] }).scripts).toContain("library-c");
    });

    test("returns error for unknown workspace", async () => {
      const { isError, result } = await callTool(
        "fullProject",
        "workspace_info",
        {
          nameOrAlias: "does-not-exist",
        },
      );
      expect(isError).toBe(true);
      expect(result as string).toContain("does-not-exist");
    });

    test("returns root workspace info with @root selector", async () => {
      const { result, isError } = await callTool(
        "fullProject",
        "workspace_info",
        {
          nameOrAlias: "@root",
        },
      );
      expect(isError).toBeUndefined();
      expect((result as { isRoot: boolean }).isRoot).toBe(true);
    });

    test("returns workspace info by alias", async () => {
      const { result, isError } = await callTool(
        "workspaceTags",
        "workspace_info",
        {
          nameOrAlias: "libA",
        },
      );
      expect(isError).toBeUndefined();
      expect((result as { name: string }).name).toBe("library-1a");
    });

    test("returns error without a project", async () => {
      const { isError } = await callTool(null, "workspace_info", {
        nameOrAlias: "library-a",
      });
      expect(isError).toBe(true);
    });
  });

  describe("list_scripts", () => {
    test("returns scripts with workspace names", async () => {
      const { result, isError } = await callTool("fullProject", "list_scripts");
      expect(isError).toBeUndefined();
      const scripts = result as { name: string; workspaces: string[] }[];
      expect(scripts).toBeArray();
      const allWorkspaces = scripts.find((s) => s.name === "all-workspaces");
      expect(allWorkspaces?.workspaces).toEqual([
        "application-a",
        "application-b",
        "library-a",
        "library-b",
        "library-c",
      ]);
    });

    test("returns error without a project", async () => {
      const { isError } = await callTool(null, "list_scripts");
      expect(isError).toBe(true);
    });
  });

  describe("script_info", () => {
    test("returns info for a known script", async () => {
      const { result, isError } = await callTool("fullProject", "script_info", {
        script: "all-workspaces",
      });
      expect(isError).toBeUndefined();
      const info = result as { name: string; workspaces: string[] };
      expect(info.name).toBe("all-workspaces");
      expect(info.workspaces).toContain("library-c");
    });

    test("returns error for unknown script", async () => {
      const { isError } = await callTool("fullProject", "script_info", {
        script: "not-a-script",
      });
      expect(isError).toBe(true);
    });

    test("returns error without a project", async () => {
      const { isError } = await callTool(null, "script_info", {
        script: "all-workspaces",
      });
      expect(isError).toBe(true);
    });
  });

  describe("list_tags", () => {
    test("returns tags with workspace names", async () => {
      const { result, isError } = await callTool("workspaceTags", "list_tags");
      expect(isError).toBeUndefined();
      const tags = result as { tag: string; workspaces: string[] }[];
      const appTag = tags.find((t) => t.tag === "app");
      expect(appTag?.workspaces).toEqual(["application-1a", "application-1b"]);
      const libTag = tags.find((t) => t.tag === "lib");
      expect(libTag?.workspaces).toEqual(["library-1a", "library-1b"]);
    });

    test("returns error without a project", async () => {
      const { isError } = await callTool(null, "list_tags");
      expect(isError).toBe(true);
    });
  });

  describe("tag_info", () => {
    test("returns workspaces for a known tag", async () => {
      const { result, isError } = await callTool("workspaceTags", "tag_info", {
        tag: "app",
      });
      expect(isError).toBeUndefined();
      const info = result as { name: string; workspaces: string[] };
      expect(info.name).toBe("app");
      expect(info.workspaces).toEqual(["application-1a", "application-1b"]);
    });

    test("returns error for unknown tag", async () => {
      const { isError } = await callTool("workspaceTags", "tag_info", {
        tag: "unknown-tag",
      });
      expect(isError).toBe(true);
    });

    test("returns error without a project", async () => {
      const { isError } = await callTool(null, "tag_info", { tag: "app" });
      expect(isError).toBe(true);
    });
  });

  describe("set_working_directory", () => {
    test("sets a valid project directory and returns project info", async () => {
      const { result, isError } = await callTool(
        null,
        "set_working_directory",
        { directory: getProjectRoot("fullProject") },
      );
      expect(isError).toBeUndefined();
      const data = result as {
        directory: string;
        project: { name: string; workspaces: string[] } | null;
      };
      expect(data.directory).toBe(getProjectRoot("fullProject"));
      expect(data.project).not.toBeNull();
      expect(data.project?.workspaces).toContain("application-a");
    });

    test("returns project: null when directory is not a bun-workspaces project", async () => {
      const { result, isError } = await callTool(
        null,
        "set_working_directory",
        { directory: getProjectRoot("notAProject") },
      );
      expect(isError).toBeUndefined();
      const data = result as { directory: string; project: null };
      expect(data.project).toBeNull();
    });

    test("subsequent tool calls use the new directory", async () => {
      await callTool(null, "set_working_directory", {
        directory: getProjectRoot("fullProject"),
      });
      const { result, isError } = await callTool(null, "list_workspaces");
      expect(isError).toBeUndefined();
      expect((result as { name: string }[]).map((w) => w.name)).toContain(
        "application-a",
      );
    });

    test("switching directory changes the active project", async () => {
      await callTool(null, "set_working_directory", {
        directory: getProjectRoot("fullProject"),
      });
      await callTool(null, "set_working_directory", {
        directory: getProjectRoot("workspaceTags"),
      });
      const { result } = await callTool(null, "list_workspaces");
      const names = (result as { name: string }[]).map((w) => w.name);
      expect(names).toContain("application-1a");
      expect(names).not.toContain("application-a");
    });
  });

  describe("doctor", () => {
    test("returns diagnostic info with version fields", async () => {
      const { result, isError } = await callTool("fullProject", "doctor");
      expect(isError).toBeUndefined();
      const info = result as Record<string, unknown>;
      expect(typeof info.version).toBe("string");
      expect(typeof info.bunVersion).toBe("string");
      expect(typeof info.os).toBe("object");
    });

    test("returns diagnostic info even without a project", async () => {
      const { result, isError } = await callTool(null, "doctor");
      expect(isError).toBeUndefined();
      expect(typeof (result as Record<string, unknown>).version).toBe("string");
    });
  });
});
