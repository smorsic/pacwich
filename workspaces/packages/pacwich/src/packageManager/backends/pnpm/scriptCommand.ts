import path from "path";
import type {
  CreateScriptCommandOptions,
  ScriptCommand,
} from "../../adapter/adapterTypes";

const spaceArgs = (args: string) => (args ? ` ${args.trim()}` : "");

/**
 * Build a ScriptCommand that runs the workspace's package.json
 * script via `pnpm run --silent <scriptName> [-- <args>]`. The
 * `--silent` flag suppresses pnpm's own `$ <command>` banner so the
 * script's stdout matches what bun/npm produce in pacwich's grouped
 * output, and `-- <args>` is the standard pnpm passthrough form.
 */
export const createScriptCommand = ({
  scriptName,
  workspace,
  rootDirectory,
  args,
}: CreateScriptCommandOptions): ScriptCommand => {
  const trimmedArgs = args.trim();
  const argsSuffix = trimmedArgs ? ` --${spaceArgs(trimmedArgs)}` : "";
  return {
    workingDirectory: path.resolve(rootDirectory, workspace.path),
    command: `pnpm run --silent ${scriptName}${argsSuffix}`,
  };
};
