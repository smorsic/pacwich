import fs from "fs";
import path from "path";
import Ajv from "ajv";
import standaloneCode from "ajv/dist/standalone";
import { ROOT_CONFIG_JSON_SCHEMA } from "../src/config/rootConfig/rootConfigSchema";
import { WORKSPACE_CONFIG_JSON_SCHEMA } from "../src/config/workspaceConfig/workspaceConfigSchema";

if (import.meta.main) {
  console.log("Compiling AJV scripts...");

  const ajv = new Ajv({
    code: { source: true, esm: true },
    allowUnionTypes: true,
  });

  const validateWorkspaceConfig = ajv.compile(WORKSPACE_CONFIG_JSON_SCHEMA);
  const validateRootConfig = ajv.compile(ROOT_CONFIG_JSON_SCHEMA);

  const workspaceFilePath = path.join(
    __dirname,
    "../src/internal/generated/ajv/validateWorkspaceConfig.js",
  );

  const rootFilePath = path.join(
    __dirname,
    "../src/internal/generated/ajv/validateRootConfig.js",
  );

  console.log(
    `Writing ${path.relative(path.join(process.cwd(), "../../"), workspaceFilePath)}`,
  );
  fs.writeFileSync(
    workspaceFilePath,
    standaloneCode(ajv, validateWorkspaceConfig),
  );

  console.log(
    `Writing ${path.relative(path.join(process.cwd(), "../../"), rootFilePath)}`,
  );
  fs.writeFileSync(rootFilePath, standaloneCode(ajv, validateRootConfig));

  console.log("Finished AJV generation");
}
