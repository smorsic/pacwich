import { defineWorkspaceConfig } from "pacwich/config";

// Intentionally invalid: triggers an `InvalidWorkspaceConfig` throw
// during evaluation of this file. Mirrors the projectConfig fixture
// of the same purpose. Regression for the jiti+sucrase cross-realm
// error-marker handling.
export default defineWorkspaceConfig({
  // @ts-expect-error - the whole point is to fail validation
  alias: 123,
});
