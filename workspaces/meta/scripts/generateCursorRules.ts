import path from "path";
import { createScriptLogger } from "../util";

const root = process.env.BW_PROJECT_PATH as string;

const logger = createScriptLogger({ name: "Cursor Rules" });

if (import.meta.main) {
  logger.info("Generating Cursor rules...");

  let content = "";
  for (const contextFile of [
    "md/ai/context/overview.md",
    "md/ai/context/concepts.md",
    "md/ai/context/cliExamples.md",
    "md/ai/context/apiExamples.md",
    "md/ai/context/config.md",
    "md/ai/context/development.md",
  ]) {
    const contextFilePath = path.resolve(root, contextFile);
    logger.info(`Reading ${contextFile}`);
    content += (content ? "\n" : "") + (await Bun.file(contextFilePath).text());
  }
  logger.info("All files read");

  const outputPath = path.resolve(root, ".cursor/rules/context.md");

  logger.debug(`Writing to ${outputPath}`);
  await Bun.write(outputPath, content);
  logger.info(
    `Cursor rules generated successfully at ${path.relative(root, outputPath)}`,
  );
}
