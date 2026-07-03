import { defineWorkspaceConfig } from "pacwich/config";

export default defineWorkspaceConfig({
  alias: ["doc-website", "docs", "docs-website", "docs-web", "documentation"],
  tags: ["static-website"],
  rules: {
    workspaceDependencies: {
      allowPatterns: ["path:workspaces/web/**/*"],
    },
  },
});
