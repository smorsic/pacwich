import { defineWorkspaceConfig } from "pacwich/config";

// Aliases avoid colliding with the reference `web-cli`/`wcli` sandbox, which is
// removed once this feature ships.
export default defineWorkspaceConfig({
  alias: ["web-cli-lib", "wcl"],
});
