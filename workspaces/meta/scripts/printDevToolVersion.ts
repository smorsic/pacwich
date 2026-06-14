import {
  getToolDevLockVersion,
  TOOL_NAMES,
  type ToolName,
} from "@pacwich/common";
import { createScriptLogger } from "../util";

if (import.meta.main) {
  const logger = createScriptLogger({
    name: "Tool Version",
  });

  const toolName = process.argv[2] as ToolName;
  if (!toolName) {
    logger.error("Tool name argument is required");
    process.exit(1);
  }

  if (!TOOL_NAMES.includes(toolName)) {
    logger.error(
      `Tool "${toolName}" is not a valid tool name (expected: ${TOOL_NAMES.join(" | ")})`,
    );
    process.exit(1);
  }

  const version = getToolDevLockVersion(toolName);

  // eslint-disable-next-line no-console
  console.log(version);
}
