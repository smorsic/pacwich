import { createMcpServer } from "../../../src/ai/mcp/core/server";
import { createMemoryTransport } from "../../../src/ai/mcp/core/transport";
import { registerPacwichResources } from "../../../src/ai/mcp/resources";
import { describe, expect, test } from "../../util/testFramework";

const setupServer = () => {
  const server = createMcpServer({ name: "pacwich", version: "0.0.0" });
  registerPacwichResources(server);
  return server;
};

const readResource = async (uri: string) => {
  const server = setupServer();
  const transport = createMemoryTransport([
    { jsonrpc: "2.0", id: 1, method: "resources/read", params: { uri } },
  ]);
  await server.start(transport);
  const response = transport.sent[0] as {
    result?: { contents: { uri: string; mimeType: string; text: string }[] };
    error?: { code: number; message: string };
  };
  return response;
};

const listResources = async () => {
  const server = setupServer();
  const transport = createMemoryTransport([
    { jsonrpc: "2.0", id: 1, method: "resources/list", params: {} },
  ]);
  await server.start(transport);
  return (
    transport.sent[0] as {
      result: { resources: { uri: string; name: string; mimeType?: string }[] };
    }
  ).result.resources;
};

describe("pacwich MCP resources", () => {
  describe("resources/list", () => {
    test("lists all 6 pacwich resources", async () => {
      const resources = await listResources();
      const uris = resources.map((r) => r.uri);
      expect(uris).toEqual([
        "pacwich://docs/all",
        "pacwich://docs/overview",
        "pacwich://docs/concepts",
        "pacwich://docs/cli",
        "pacwich://docs/api",
        "pacwich://docs/config",
      ]);
    });

    test("doc resources have text/markdown mimeType", async () => {
      const resources = await listResources();
      const docResources = resources.filter((r) =>
        r.uri.startsWith("pacwich://docs/"),
      );
      for (const r of docResources) {
        expect(r.mimeType).toBe("text/markdown");
      }
    });
  });

  describe("doc resources", () => {
    const DOC_RESOURCES = [
      "pacwich://docs/all",
      "pacwich://docs/overview",
      "pacwich://docs/concepts",
      "pacwich://docs/cli",
      "pacwich://docs/api",
      "pacwich://docs/config",
    ] as const;

    for (const uri of DOC_RESOURCES) {
      test(`${uri} returns non-empty markdown content`, async () => {
        const response = await readResource(uri);
        expect(response.error).toBeUndefined();
        const content = response.result!.contents[0];
        expect(content.uri).toBe(uri);
        expect(content.mimeType).toBe("text/markdown");
        expect(content.text.length).toBeGreaterThan(0);
      });
    }

    test("pacwich://docs/cli contains CLI examples", async () => {
      const response = await readResource("pacwich://docs/cli");
      expect(response.result!.contents[0].text).toContain("pacwich ls");
      expect(response.result!.contents[0].text).toContain("pacwich run");
    });

    test("pacwich://docs/overview mentions pacwich", async () => {
      const response = await readResource("pacwich://docs/overview");
      expect(response.result!.contents[0].text).toContain("pacwich");
    });

    test("pacwich://docs/config mentions pacwich.project.jsonc", async () => {
      const response = await readResource("pacwich://docs/config");
      expect(response.result!.contents[0].text).toContain(
        "pacwich.project.jsonc",
      );
    });
  });

  describe("navigation footers", () => {
    test("overview resource appends a 'see also' block listing sibling resources", async () => {
      const text = (await readResource("pacwich://docs/overview")).result!
        .contents[0].text;
      expect(text).toContain("More pacwich docs:");
      expect(text).toContain("pacwich://docs/cli");
      expect(text).toContain("pacwich://docs/config");
    });

    test("topic resources append an orientation backlink to overview", async () => {
      const text = (await readResource("pacwich://docs/cli")).result!
        .contents[0].text;
      expect(text).toContain("See pacwich://docs/overview for orientation.");
    });

    test("the combined docs/all resource stays clean (no nav footers)", async () => {
      const text = (await readResource("pacwich://docs/all")).result!
        .contents[0].text;
      expect(text).toContain("pacwich ls");
      expect(text).toContain("createFileSystemProject(");
      expect(text).toContain('"pacwich/config"');
      expect(text).not.toContain("More pacwich docs:");
      expect(text).not.toContain(
        "See pacwich://docs/overview for orientation.",
      );
    });
  });
});
