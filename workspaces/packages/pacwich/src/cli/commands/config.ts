import type { Command } from "../../internal/bundledDeps/commander";
import { handleProjectCommand } from "./commandHandlerUtils";

/**
 * `pacwich config` is a container for `config debug`, not a real command on
 * its own. A bare invocation prints usage and exits non-zero, same as
 * `affected`.
 */
export const config = handleProjectCommand(
  "config",
  (_context, _options: object, command: Command) => {
    command.help({ error: true });
  },
);
