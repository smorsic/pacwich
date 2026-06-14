import { defineProjectConfig } from "pacwich/config";

// Intentionally invalid: triggers an `InvalidProjectConfig` throw
// during evaluation of this file. Used as a regression fixture for
// the jiti+sucrase cross-realm error-marker fix.
export default defineProjectConfig({
  // @ts-expect-error - the whole point of this fixture is to fail validation
  packageManager: "fake-pm",
});
