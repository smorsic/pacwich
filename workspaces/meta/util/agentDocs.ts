import path from "path";
import { TOOL_VERSIONS } from "@pacwich/common/toolVersions";
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

const OVERVIEW_END_MARKER = "<!--End pacwich overview-->";

const renderRequiredVersions = (): string => {
  const lines = Object.entries(TOOL_VERSIONS).map(
    ([toolName, { endUserRequirement }]) =>
      `- **${toolName}:** ${endUserRequirement}`,
  );
  return ["## Version requirements", "", ...lines].join("\n");
};

const injectOverviewExtras = (overviewText: string): string => {
  const versionsBlock = renderRequiredVersions();
  if (overviewText.includes(OVERVIEW_END_MARKER)) {
    return overviewText.replace(
      OVERVIEW_END_MARKER,
      `${versionsBlock}\n\n${OVERVIEW_END_MARKER}`,
    );
  }
  return `${overviewText.replace(/\s+$/, "")}\n\n${versionsBlock}\n`;
};

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
    let text = await Bun.file(contextFilePath).text();
    if (contextFile.name === "overview") {
      text = injectOverviewExtras(text);
    }
    combinedContent += (combinedContent ? "\n" : "") + text;
    contents[contextFile.name] = text;
  }

  logger.info("All files read");

  return { logger, combinedContent, contents };
};
