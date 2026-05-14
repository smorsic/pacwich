import { startBwMcpServer } from "../../ai/mcp";
import { getUserBoolEnvVar } from "../../config/userEnvVars";
import { logger } from "../../internal/logger";
import { handleGlobalCommand } from "./commandHandlerUtils";

export const mcpServer = handleGlobalCommand(
  "mcpServer",
  async ({ workingDirectory, disableExecutableConfigs }) => {
    logger.printLevel = "silent";
    // mcp-server is the only command that defaults to *disabled* when
    // neither the global flag nor the env var is set, because the server
    // can be redirected to arbitrary directories at runtime via the
    // set_working_directory tool. Precedence: CLI flag > env var > true.
    const effectiveDisable =
      disableExecutableConfigs ??
      getUserBoolEnvVar("disableExecutableConfigsDefault") ??
      true;
    await startBwMcpServer({
      initialWorkingDirectory: workingDirectory,
      enableExecutableConfigs: !effectiveDisable,
    });
  },
);
