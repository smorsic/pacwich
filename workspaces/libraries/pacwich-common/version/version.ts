import packageJson from "../../../packages/pacwich/package.json" with { type: "json" };

export const PACWICH_VERSION =
  packageJson.version +
  (process.env._IS_PACWICH_LOCAL_SOURCE === "true" ? "-local" : "");
