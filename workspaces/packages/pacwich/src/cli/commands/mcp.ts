import { startPacwichMcpServer } from "../../ai/mcp";
import { logger } from "../../internal/logger";
import { handleGlobalCommand } from "./commandHandlerUtils";

export const mcpServer = handleGlobalCommand("mcpServer", async () => {
  logger.printLevel = "silent";
  await startPacwichMcpServer();
});
