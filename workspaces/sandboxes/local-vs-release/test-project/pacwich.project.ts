import { defineRootConfig } from "bun-workspaces/config";

export default defineRootConfig({
  // JSONC works
  defaults: {
    parallelMax: 2,
    shell: "system",
  },
});
