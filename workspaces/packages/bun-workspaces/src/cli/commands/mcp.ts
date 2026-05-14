import { startBwMcpServer } from "../../ai/mcp";
import { logger } from "../../internal/logger";
import { handleGlobalCommand } from "./commandHandlerUtils";

export const mcpServer = handleGlobalCommand(
  "mcpServer",
  async ({ workingDirectory }, options: { enableAllConfigFiles: boolean }) => {
    logger.printLevel = "silent";
    await startBwMcpServer({
      initialWorkingDirectory: workingDirectory,
      enableExecutableConfigs: options.enableAllConfigFiles,
    });
  },
);
