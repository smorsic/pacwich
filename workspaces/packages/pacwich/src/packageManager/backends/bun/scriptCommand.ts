import path from "path";
import type {
  CreateScriptCommandOptions,
  ScriptCommand,
} from "../../adapter/adapterTypes";

const spaceArgs = (args: string) => (args ? ` ${args.trim()}` : "");

/**
 * Build a ScriptCommand that changes into the workspace's directory and
 * invokes `bun --silent run <scriptName>` with any appended args. This is
 * the only recipe bun ships. The previous `--filter` recipe was removed
 * along with the public `Project.createScriptCommand` method.
 */
export const createScriptCommand = ({
  scriptName,
  workspace,
  rootDirectory,
  args,
}: CreateScriptCommandOptions): ScriptCommand => ({
  workingDirectory: path.resolve(rootDirectory, workspace.path),
  command: `bun --silent run ${scriptName}${spaceArgs(args)}`,
});
