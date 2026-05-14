import { ROOT_WORKSPACE_SELECTOR } from "bw-common/project";
import { getDoctorInfo } from "../../doctor";
import { BUN_WORKSPACES_VERSION } from "../../internal/version";
import type { FileSystemProject } from "../../project/implementations/fileSystemProject";
import type { McpServer, CallToolResult } from "./core";
import { getServerProject, setServerWorkingDirectory } from "./serverState";

const textResult = (data: unknown): CallToolResult => ({
  content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
});

const errorResult = (message: string): CallToolResult => ({
  content: [{ type: "text", text: message }],
  isError: true,
});

const NO_PROJECT_RESULT = errorResult(
  "No bun-workspaces project is available in the current directory.",
);

const withProject =
  <T extends Record<string, unknown>>(
    handler: (project: FileSystemProject, input: T) => CallToolResult,
  ) =>
  (input: T): CallToolResult => {
    const project = getServerProject();
    return project ? handler(project, input) : NO_PROJECT_RESULT;
  };

export const registerBwTools = (server: McpServer): void => {
  server.registerTool(
    {
      name: "version",
      description: "Get the version of bun-workspaces used by this MCP server",
      inputSchema: { type: "object" },
    },
    () => textResult({ version: BUN_WORKSPACES_VERSION }),
  );

  server.registerTool(
    {
      name: "list_workspaces",
      description:
        "List workspaces in the project. Optionally filter by workspace patterns (name, alias, path glob, or tag).",
      inputSchema: {
        type: "object",
        properties: {
          patterns: {
            type: "array",
            items: { type: "string" },
            description:
              'Workspace patterns to match. Examples: "my-workspace", "name:api-*", "alias:my-alias", "path:packages/**/*", "tag:backend", "@root"',
          },
        },
      },
    },
    withProject((project, { patterns }) => {
      const workspaces =
        patterns && Array.isArray(patterns) && patterns.length > 0
          ? project.findWorkspacesByPattern(...(patterns as string[]))
          : project.workspaces;
      return textResult(workspaces);
    }),
  );

  server.registerTool(
    {
      name: "workspace_info",
      description:
        'Get detailed information about a single workspace by its name or alias. Use "@root" for the root workspace.',
      inputSchema: {
        type: "object",
        properties: {
          nameOrAlias: {
            type: "string",
            description:
              'The workspace name, alias, or "@root" for the root workspace',
          },
        },
        required: ["nameOrAlias"],
      },
    },
    withProject((project, { nameOrAlias }) => {
      const name = nameOrAlias as string;
      const workspace =
        name === ROOT_WORKSPACE_SELECTOR
          ? project.rootWorkspace
          : project.findWorkspaceByNameOrAlias(name);

      if (!workspace) {
        return errorResult(`Workspace not found: "${name}"`);
      }

      return textResult(workspace);
    }),
  );

  server.registerTool(
    {
      name: "root_info",
      description: "Get information about the root workspace",
      inputSchema: { type: "object" },
    },
    withProject((project) => textResult(project.rootWorkspace)),
  );

  server.registerTool(
    {
      name: "list_scripts",
      description:
        "List all scripts available across the project, with the workspaces that have each script.",
      inputSchema: { type: "object" },
    },
    withProject((project) => {
      const scriptMap = project.mapScriptsToWorkspaces();
      const scripts = Object.values(scriptMap).map(({ name, workspaces }) => ({
        name,
        workspaces: workspaces.map((w) => w.name),
      }));
      return textResult(scripts);
    }),
  );

  server.registerTool(
    {
      name: "script_info",
      description:
        "Get information about a specific script, including all workspaces that have it in their package.json.",
      inputSchema: {
        type: "object",
        properties: {
          script: {
            type: "string",
            description: "The script name to look up",
          },
        },
        required: ["script"],
      },
    },
    withProject((project, { script }) => {
      const scriptMap = project.mapScriptsToWorkspaces();
      const scriptMetadata = scriptMap[script as string];

      if (!scriptMetadata) {
        return errorResult(`Script not found: "${script}"`);
      }

      return textResult({
        name: scriptMetadata.name,
        workspaces: scriptMetadata.workspaces.map((w) => w.name),
      });
    }),
  );

  server.registerTool(
    {
      name: "list_tags",
      description:
        "List all tags defined across workspaces, with the workspaces that have each tag.",
      inputSchema: { type: "object" },
    },
    withProject((project) => {
      const tagMap = project.mapTagsToWorkspaces();
      const tags = Object.entries(tagMap).map(([tag, workspaces]) => ({
        tag,
        workspaces: workspaces.map((w) => w.name),
      }));
      return textResult(tags);
    }),
  );

  server.registerTool(
    {
      name: "tag_info",
      description:
        "Get information about a specific tag, including all workspaces that have it.",
      inputSchema: {
        type: "object",
        properties: {
          tag: {
            type: "string",
            description: "The tag name to look up",
          },
        },
        required: ["tag"],
      },
    },
    withProject((project, { tag }) => {
      const tagMap = project.mapTagsToWorkspaces();
      const tagWorkspaces = tagMap[tag as string];

      if (!tagWorkspaces) {
        return errorResult(`Tag not found: "${tag}"`);
      }

      return textResult({
        name: tag,
        workspaces: tagWorkspaces.map((w) => w.name),
      });
    }),
  );

  server.registerTool(
    {
      name: "set_working_directory",
      description:
        "Set the working directory used by this MCP server. All subsequent project queries will reflect the new directory. By default the server skips executable config files (bw.root.{ts,js}, bw.workspace.{ts,js}) in the target directory so that pointing the server at an unfamiliar project does not evaluate its code; only bw.root.{jsonc,json}, bw.workspace.{jsonc,json}, and the package.json bw key are read. Start the server with --enable-all-config-files to allow executable configs.",
      inputSchema: {
        type: "object",
        properties: {
          directory: {
            type: "string",
            description: "Absolute path to the new working directory",
          },
        },
        required: ["directory"],
      },
    },
    ({ directory }) => {
      setServerWorkingDirectory(directory as string);
      const project = getServerProject();
      return textResult({
        directory,
        project: project
          ? {
              name: project.name,
              workspaces: project.workspaces.map((w) => w.name),
            }
          : null,
      });
    },
  );

  server.registerTool(
    {
      name: "doctor",
      description:
        "Get diagnostic information about the bun-workspaces installation: version, Bun version, OS, and environment.",
      inputSchema: { type: "object" },
    },
    () => textResult(getDoctorInfo()),
  );
};
