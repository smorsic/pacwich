import fs from "fs";
import path from "path";
import { createScriptLogger } from "@pacwich/meta/util";
import Ajv from "ajv";
import standaloneCode from "ajv/dist/standalone";
import { PROJECT_CONFIG_JSON_SCHEMA } from "../src/config/projectConfig/projectConfigSchema";
import { WORKSPACE_CONFIG_JSON_SCHEMA } from "../src/config/workspaceConfig/workspaceConfigSchema";

const logger = createScriptLogger({ name: "pacwich:AJV" });

if (import.meta.main) {
  logger.info("Compiling AJV scripts...");

  const ajv = new Ajv({
    code: { source: true, esm: true },
    allowUnionTypes: true,
  });

  const validateWorkspaceConfig = ajv.compile(WORKSPACE_CONFIG_JSON_SCHEMA);
  const validateProjectConfig = ajv.compile(PROJECT_CONFIG_JSON_SCHEMA);

  const workspaceFilePath = path.join(
    __dirname,
    "../src/internal/generated/ajv/validateWorkspaceConfig.js",
  );

  logger.debug(`workspaceFilePath: ${workspaceFilePath}`);

  const projectFilePath = path.join(
    __dirname,
    "../src/internal/generated/ajv/validateProjectConfig.js",
  );

  logger.debug(`projectFilePath: ${projectFilePath}`);

  logger.info(
    `Writing ${path.relative(path.join(process.cwd(), "../../"), workspaceFilePath)}`,
  );
  fs.writeFileSync(
    workspaceFilePath,
    standaloneCode(ajv, validateWorkspaceConfig),
  );

  logger.info(
    `Writing ${path.relative(path.join(process.cwd(), "../../"), projectFilePath)}`,
  );
  fs.writeFileSync(projectFilePath, standaloneCode(ajv, validateProjectConfig));

  logger.info("Finished AJV generation");
}
