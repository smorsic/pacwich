import path from "path";
import type {
  CreateScriptCommandOptions,
  ScriptCommand,
} from "../../adapter/adapterTypes";

const spaceArgs = (args: string) => (args ? ` ${args.trim()}` : "");

/**
 * Build a ScriptCommand that runs the workspace's package.json
 * script via `npm run --silent <scriptName> [-- <args>]`. The
 * `--silent` flag suppresses npm's own banner so the script's stdout
 * isn't preceded by `> <pkg>@<ver> <script>` noise. Matches the
 * `bun --silent run` behavior pacwich already relies on.
 *
 * Args are forwarded to the script after a `--` separator (the
 * standard way to pass through-args via `npm run`). When `args` is
 * empty the separator is omitted.
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
    command: `npm run --silent ${scriptName}${argsSuffix}`,
  };
};
