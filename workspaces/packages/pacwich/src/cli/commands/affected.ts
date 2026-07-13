import type { Command } from "../../internal/bundledDeps/commander";
import { handleProjectCommand } from "./commandHandlerUtils";

/**
 * `pacwich affected` is a container for `affected list`/`affected run`, not
 * a real command on its own. A bare invocation (no subcommand matched)
 * prints usage and exits non-zero, same as an unrecognized command.
 */
export const affected = handleProjectCommand(
  "affected",
  (_context, _options: object, command: Command) => {
    command.help({ error: true });
  },
);
