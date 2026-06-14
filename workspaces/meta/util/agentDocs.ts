import path from "path";
import { createScriptLogger } from ".";

const PACWICH_PROJECT_PATH = process.env.PACWICH_PROJECT_PATH as string;

if (!PACWICH_PROJECT_PATH) {
  throw new Error("PACWICH_PROJECT_PATH must be set");
}

export interface CreateAgentDocsOptions {
  includeDevDocs?: boolean;
  scriptName: string;
}

export type AgentDocFileName =
  | "overview"
  | "concepts"
  | "cliExamples"
  | "apiExamples"
  | "config"
  | "development";

export const createAgentDocs = async (options: CreateAgentDocsOptions) => {
  const logger = createScriptLogger({
    name: options.scriptName,
  });

  logger.info("Creating Agent docs...");

  const contextFiles: { path: string; name: AgentDocFileName }[] = [
    { path: "md/ai/context/overview.md", name: "overview" },
    { path: "md/ai/context/concepts.md", name: "concepts" },
    { path: "md/ai/context/cliExamples.md", name: "cliExamples" },
    { path: "md/ai/context/apiExamples.md", name: "apiExamples" },
    { path: "md/ai/context/config.md", name: "config" },
  ];

  if (options.includeDevDocs) {
    contextFiles.push({
      path: "md/ai/context/_development.md",
      name: "development",
    });
  }

  const contents: Record<AgentDocFileName, string> = {} as Record<
    AgentDocFileName,
    string
  >;

  let combinedContent = "";
  for (const contextFile of contextFiles) {
    const contextFilePath = path.resolve(
      PACWICH_PROJECT_PATH,
      contextFile.path,
    );
    logger.info(`Reading ${contextFile.path}`);
    combinedContent +=
      (combinedContent ? "\n" : "") + (await Bun.file(contextFilePath).text());
    contents[contextFile.name] = await Bun.file(contextFilePath).text();
  }

  logger.info("All files read");

  return { logger, combinedContent, contents };
};
