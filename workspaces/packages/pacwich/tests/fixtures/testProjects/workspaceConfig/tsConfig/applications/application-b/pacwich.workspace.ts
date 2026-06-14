import { defineWorkspaceConfig } from "pacwich/config";

export default defineWorkspaceConfig({
  alias: "appB",
  scripts: {
    "b-workspaces": {
      order: 0,
    },
  },
});
