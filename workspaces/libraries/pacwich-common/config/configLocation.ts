export const PROJECT_CONFIG_FILE_NAME = "pacwich.project";
export const PROJECT_CONFIG_PACKAGE_JSON_KEY = "pacwich-project";

export const WORKSPACE_CONFIG_FILE_NAME = "pacwich.workspace";
export const WORKSPACE_CONFIG_PACKAGE_JSON_KEY = "pacwich";

export const CONFIG_LOCATION_TYPES = [
  "tsFile",
  "jsFile",
  "jsoncFile",
  "jsonFile",
  "packageJson",
] as const;

export type ConfigLocationType = (typeof CONFIG_LOCATION_TYPES)[number];

export type ConfigLocation = {
  type: ConfigLocationType;
  content: unknown;
  path: string;
};

const CONFIG_LOCATION_PATHS: Record<
  ConfigLocationType,
  (name: string, packageJsonKey: string) => string
> = {
  tsFile: (name) => `${name}.ts`,
  jsFile: (name) => `${name}.js`,
  jsoncFile: (name) => `${name}.jsonc`,
  jsonFile: (name) => `${name}.json`,
  packageJson: (_, packageJsonKey) => `package.json["${packageJsonKey}"]`,
};

const CONFIG_LOCATION_DESCRIPTIONS: Record<ConfigLocationType, string> = {
  tsFile: "TypeScript file",
  jsFile: "JavaScript file",
  jsoncFile: "JSONC file",
  jsonFile: "JSON file",
  packageJson: "package.json key",
};

export const createConfigLocationPath = (
  locationType: ConfigLocationType,
  name: string,
  packageJsonKey: string,
) => CONFIG_LOCATION_PATHS[locationType](name, packageJsonKey);

export const createConfigLocationDescription = (
  locationType: ConfigLocationType,
) => CONFIG_LOCATION_DESCRIPTIONS[locationType];
