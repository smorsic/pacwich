import { defineProjectConfig } from "pacwich/config";

export default defineProjectConfig({
  workspacePatternConfigs: [
    {
      patterns: ["*"],
      config: (workspace) => {
        const lastSegment = workspace.path.split("/").pop() ?? "";
        const tags: string[] = [];

        if (workspace.path.startsWith("libraries/")) tags.push("library");
        if (workspace.path.startsWith("apps/")) {
          tags.push("app");
          tags.push(
            workspace.path.startsWith("apps/my-app-a/") ? "app-a" : "app-b",
          );
        }
        if (lastSegment.startsWith("frontend-")) tags.push("frontend");
        if (lastSegment.startsWith("backend-")) tags.push("backend");
        if (lastSegment.startsWith("shared-")) tags.push("shared");
        if (/^apps\/[^/]+\/shared-/.test(workspace.path))
          tags.push("app-share");

        const denyPatterns: string[] = [];
        if (tags.includes("frontend")) denyPatterns.push("tag:backend");
        if (tags.includes("backend")) denyPatterns.push("tag:frontend");
        if (tags.includes("app-a")) denyPatterns.push("tag:app-b");
        if (tags.includes("app-b")) denyPatterns.push("tag:app-a");

        return { tags, rules: { workspaceDependencies: { denyPatterns } } };
      },
    },
  ],
});
