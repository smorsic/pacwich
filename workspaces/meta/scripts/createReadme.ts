import path from "path";

import {
  CLI_QUICKSTART,
  API_QUICKSTART,
  PROJECT_CONFIG_QUICKSTART,
  WORKSPACE_CONFIG_QUICKSTART,
} from "@pacwich/common/docs";
import { createScriptLogger } from "../util";

const root = process.env.PACWICH_PROJECT_PATH as string;

const logger = createScriptLogger({ name: "README.md" });

if (import.meta.main) {
  logger.info("Creating README...");

  const readmeTemplatePath = path.resolve(root, "md/public/README_TEMPLATE.md");

  logger.debug(`Reading ${readmeTemplatePath}`);
  const readmeTemplate = await Bun.file(readmeTemplatePath).text();

  const content = readmeTemplate
    .replace(/<<CLI_QUICKSTART>>/gm, CLI_QUICKSTART)
    .replace(/<<API_QUICKSTART>>/gm, API_QUICKSTART)
    .replace(/<<PROJECT_CONFIG_QUICKSTART>>/gm, PROJECT_CONFIG_QUICKSTART)
    .replace(/<<WORKSPACE_CONFIG_QUICKSTART>>/gm, WORKSPACE_CONFIG_QUICKSTART);

  const readmePath = path.resolve(root, "README.md");

  logger.debug(`Writing to ${readmePath}`);
  await Bun.write(readmePath, content);

  logger.info("README generated successfully");
}
