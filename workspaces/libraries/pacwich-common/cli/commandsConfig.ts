import { OUTPUT_STYLE_VALUES, SCRIPT_SHELL_OPTIONS } from "../parameters";

export interface CliCommandConfig {
  command: string;
  isGlobal: boolean;
  aliases: string[] | readonly string[];
  description: string;
  options: Record<
    string,
    {
      flags: string[] | readonly string[];
      description: string;
      values?: string[] | readonly string[];
      deprecated?: boolean;
    }
  >;
  /**
   * When set, this command is registered as a subcommand of another entry
   * in this same config (by key) instead of as a top-level command. Only
   * one level of nesting is supported. A parent's own entry must not set
   * `parent`.
   */
  parent?: string;
}

export type CliCommandName = keyof typeof CLI_COMMANDS_CONFIG;

export type CliGlobalCommandName = {
  [K in CliCommandName]: (typeof CLI_COMMANDS_CONFIG)[K] extends {
    isGlobal: true;
  }
    ? K
    : never;
}[CliCommandName];

export type CliProjectCommandName = Exclude<
  CliCommandName,
  CliGlobalCommandName
>;

export const JSON_FLAGS = ["-j", "--json"] as const;

export const PRETTY_FLAGS = ["-p", "--pretty"] as const;

/**
 * Diff-related options shared across all four affected commands
 * (`listAffected`/`affectedList` and `runAffected`/`affectedRun`).
 */
const AFFECTED_DIFF_OPTIONS = {
  base: {
    flags: ["-B", "--base <ref>"],
    description:
      "Git base ref to diff against (default is main if not configured). Cannot be used with --files",
  },
  head: {
    flags: ["-H", "--head <ref>"],
    description:
      "Git head ref to diff against (default: HEAD). Cannot be used with --files",
  },
  files: {
    flags: ["-F", "--files <files>"],
    description:
      "Changed files (paths/dirs/globs, '!' to exclude), separated by spaces. Use backslashes to escape spaces if needed. Bypasses git, so cannot be used with --base or --head.",
  },
  ignoreUntracked: {
    flags: ["--ignore-untracked"],
    description: "Exclude untracked files",
  },
  ignoreUnstaged: {
    flags: ["--ignore-unstaged"],
    description: "Exclude unstaged files",
  },
  ignoreStaged: {
    flags: ["--ignore-staged"],
    description: "Exclude staged files",
  },
  ignoreUncommitted: {
    flags: ["--ignore-uncommitted"],
    description:
      "Exclude all uncommitted changes (staged, unstaged, untracked)",
  },
  ignoreWorkspaceDeps: {
    flags: ["--ignore-workspace-deps"],
    description:
      "Ignore workspace dependencies derived from package.json files",
  },
  ignoreExternalDeps: {
    flags: ["--ignore-external-deps"],
    description:
      "Ignore changes to external dependencies (e.g. npm packages) versions in bun.lock",
  },
} as const;

/** Options shared identically by `listAffected` and `affectedList`. */
const LIST_AFFECTED_OPTIONS = {
  base: AFFECTED_DIFF_OPTIONS.base,
  head: AFFECTED_DIFF_OPTIONS.head,
  files: AFFECTED_DIFF_OPTIONS.files,
  script: {
    flags: ["-S", "--script <script>"],
    description: "Resolve inputs for the named script",
  },
  ignoreUntracked: AFFECTED_DIFF_OPTIONS.ignoreUntracked,
  ignoreUnstaged: AFFECTED_DIFF_OPTIONS.ignoreUnstaged,
  ignoreStaged: AFFECTED_DIFF_OPTIONS.ignoreStaged,
  ignoreUncommitted: AFFECTED_DIFF_OPTIONS.ignoreUncommitted,
  ignoreWorkspaceDeps: AFFECTED_DIFF_OPTIONS.ignoreWorkspaceDeps,
  ignoreExternalDeps: AFFECTED_DIFF_OPTIONS.ignoreExternalDeps,
  explain: {
    flags: ["-e", "--explain"],
    description:
      "Include changed-file counts and dependency reasons. With --json, outputs the full result object",
  },
  detailed: {
    flags: ["-D", "--detailed"],
    description:
      "With --explain, render full per-file data and dependency edge chains",
  },
  json: {
    flags: JSON_FLAGS,
    description: "Output as JSON",
  },
  pretty: {
    flags: PRETTY_FLAGS,
    description: "Pretty print JSON",
  },
} as const;

/** Options shared identically by `runAffected` and `affectedRun`. */
const RUN_AFFECTED_OPTIONS = {
  script: {
    flags: ["-S", "--script <script>"],
    description: "The script to run. (Alternative to positional argument)",
  },
  ...AFFECTED_DIFF_OPTIONS,
  parallel: {
    flags: ["-P", "--parallel [max]"],
    description:
      'Run the scripts in parallel. Pass "false" for series, or a concurrency limit as a number, percentage ("50%"), "auto", "default", or"unbounded"',
  },
  args: {
    flags: ["-a", "--args <args>"],
    description: "Args to append to the script command",
  },
  outputStyle: {
    flags: ["-o", "--output-style <style>"],
    description: "The output style to use",
    values: [...OUTPUT_STYLE_VALUES],
  },
  groupedLines: {
    flags: ["-L", "--grouped-lines <count>"],
    description: `With grouped output, the max preview lines per workspace: a number, "auto" (fit to terminal height, default), or "all"`,
  },
  noPrefix: {
    flags: ["-N", "--no-prefix"],
    description: "(DEPRECATED) Use --output-style=plain instead",
    deprecated: true,
  },
  inline: {
    flags: ["-i", "--inline"],
    description:
      "Run the script as an inline command from the workspace directory",
  },
  inlineName: {
    flags: ["-I", "--inline-name <name>"],
    description: "An optional name for the script when --inline is passed",
  },
  shell: {
    flags: ["-s", "--shell <shell>"],
    values: [...SCRIPT_SHELL_OPTIONS, "default"],
    description: `When using --inline, the shell to use to run the script`,
  },
  depOrder: {
    flags: ["-D", "--dep-order"],
    description:
      "Scripts for dependent workspaces run only after their dependencies",
  },
  ignoreDepFailure: {
    flags: ["-f", "--ignore-dep-failure"],
    description:
      "In dependency order, continue running scripts even if a dependency fails",
  },
  jsonOutfile: {
    flags: ["-j", "--json-outfile <file>"],
    description: "Output results in a JSON file",
  },
} as const;

export const CLI_COMMANDS_CONFIG = {
  doctor: {
    command: "doctor",
    isGlobal: true,
    aliases: [],
    description: "Print diagnostic information",
    options: {
      json: {
        flags: JSON_FLAGS,
        description: "Output as JSON",
      },
      pretty: {
        flags: PRETTY_FLAGS,
        description: "Pretty print JSON",
      },
    },
  },
  listWorkspaces: {
    command: "list-workspaces [workspacePatterns...]",
    isGlobal: false,
    aliases: ["ls", "list"],
    description: "List all workspaces",
    options: {
      workspacePatterns: {
        flags: ["-W", "--workspace-patterns <patterns>"],
        description:
          "Workspace patterns to match, separated by whitespace. Use backslashes to escape spaces if needed.",
      },
      nameOnly: {
        flags: ["-n", "--name-only"],
        description: "Only show workspace names",
      },
      json: {
        flags: JSON_FLAGS,
        description: "Output as JSON",
      },
      pretty: {
        flags: PRETTY_FLAGS,
        description: "Pretty print JSON",
      },
    },
  },
  listScripts: {
    command: "list-scripts",
    isGlobal: false,
    aliases: ["ls-scripts"],
    description: "List all scripts available with their workspaces",
    options: {
      nameOnly: {
        flags: ["-n", "--name-only"],
        description: "Only show script names",
      },
      json: {
        flags: JSON_FLAGS,
        description: "Output as JSON",
      },
      pretty: {
        flags: PRETTY_FLAGS,
        description: "Pretty print JSON",
      },
    },
  },
  workspaceInfo: {
    command: "workspace-info <workspaceName>",
    isGlobal: false,
    aliases: ["info"],
    description: "Show information about a workspace",
    options: {
      json: {
        flags: JSON_FLAGS,
        description: "Output as JSON",
      },
      pretty: {
        flags: PRETTY_FLAGS,
        description: "Pretty print JSON",
      },
    },
  },
  scriptInfo: {
    command: "script-info <script>",
    isGlobal: false,
    aliases: [],
    description: "Show information about a script",
    options: {
      workspacesOnly: {
        flags: ["-w", "--workspaces-only"],
        description: "Only show script's workspace names",
      },
      json: {
        flags: JSON_FLAGS,
        description: "Output as JSON",
      },
      pretty: {
        flags: PRETTY_FLAGS,
        description: "Pretty print JSON",
      },
    },
  },
  listTags: {
    command: "list-tags",
    isGlobal: false,
    aliases: ["ls-tags"],
    description: "List all tags available with their workspaces",
    options: {
      nameOnly: {
        flags: ["-n", "--name-only"],
        description: "Only show tag names",
      },
      json: {
        flags: JSON_FLAGS,
        description: "Output as JSON",
      },
      pretty: {
        flags: PRETTY_FLAGS,
        description: "Pretty print JSON",
      },
    },
  },
  tagInfo: {
    command: "tag-info <tag>",
    isGlobal: false,
    aliases: [],
    description: "Show information about a tag",
    options: {
      json: {
        flags: JSON_FLAGS,
        description: "Output as JSON",
      },
      pretty: {
        flags: PRETTY_FLAGS,
        description: "Pretty print JSON",
      },
    },
  },
  mcpServer: {
    command: "mcp-server",
    isGlobal: true,
    aliases: [],
    description:
      "Start the pacwich MCP (Model Context Protocol) server over stdio. Mainly provides documentation resources for agents",
    options: {},
  },
  completion: {
    command: "completion [shell]",
    isGlobal: true,
    aliases: [],
    description:
      "Set up shell completions (bash, zsh, or fish). Passing no args prints setup help.",
    options: {},
  },
  completionInstall: {
    command: "install [shell]",
    parent: "completion",
    isGlobal: true,
    aliases: [],
    description:
      "Wire completions into your shell's config, auto-detecting the current shell when none is given",
    options: {},
  },
  addSkills: {
    command: "add-skills",
    isGlobal: true,
    aliases: [],
    description:
      "Scaffold pacwich's documentation as Claude Agent Skills into your project (.agents/skills by default)",
    options: {
      dir: {
        flags: ["--dir <path>"],
        description:
          "Target directory for the skills, relative to --cwd (default: .agents/skills)",
      },
      dryRun: {
        flags: ["--dry-run"],
        description: "Print what would be written without writing any files",
      },
    },
  },
  listAffected: {
    command: "list-affected",
    isGlobal: false,
    aliases: ["ls-affected"],
    description:
      "(DEPRECATED) Use `affected list` instead. List workspaces affected by a set of changed files (git or file list)",
    options: LIST_AFFECTED_OPTIONS,
  },
  runScript: {
    command: "run-script [script] [workspacePatterns...]",
    isGlobal: false,
    aliases: ["run"],
    description:
      'Run a script in all workspaces that have it in their "scripts" field in package.json',
    options: {
      script: {
        flags: ["-S", "--script <script>"],
        description: "The script to run. (Alternative to positional argument)",
      },
      workspacePatterns: {
        flags: ["-W", "--workspace-patterns <patterns>"],
        description:
          "Workspace patterns to match, separated by spaces. (Alternative to positional arguments)",
      },
      parallel: {
        flags: ["-P", "--parallel [max]"],
        description:
          'Run the scripts in parallel. Pass "false" for series, or a concurrency limit as a number, percentage ("50%"), "auto", "default", or"unbounded"',
      },
      args: {
        flags: ["-a", "--args <args>"],
        description: "Args to append to the script command",
      },
      outputStyle: {
        flags: ["-o", "--output-style <style>"],
        description: "The output style to use",
        values: [...OUTPUT_STYLE_VALUES],
      },
      groupedLines: {
        flags: ["-L", "--grouped-lines <count>"],
        description: `With grouped output, the max preview lines per workspace: a number, "auto" (fit to terminal height, default), or "all"`,
      },
      noPrefix: {
        flags: ["-N", "--no-prefix"],
        description: "(DEPRECATED) Use --output-style=plain instead",
        deprecated: true,
      },
      inline: {
        flags: ["-i", "--inline"],
        description:
          "Run the script as an inline command from the workspace directory",
      },
      inlineName: {
        flags: ["-I", "--inline-name <name>"],
        description: "An optional name for the script when --inline is passed",
      },
      shell: {
        flags: ["-s", "--shell <shell>"],
        values: [...SCRIPT_SHELL_OPTIONS, "default"],
        description: `When using --inline, the shell to use to run the script`,
      },
      depOrder: {
        flags: ["-D", "--dep-order"],
        description:
          "Scripts for dependent workspaces run only after their dependencies",
      },
      ignoreDepFailure: {
        flags: ["-f", "--ignore-dep-failure"],
        description:
          "In dependency order, continue running scripts even if a dependency fails",
      },
      jsonOutfile: {
        flags: ["-j", "--json-outfile <file>"],
        description: "Output results in a JSON file",
      },
    },
  },
  runAffected: {
    command: "run-affected [script]",
    isGlobal: false,
    aliases: ["ra"],
    description:
      "(DEPRECATED) Use `affected run` instead. Run a script across the workspaces affected by a set of changed files (git or file list)",
    options: RUN_AFFECTED_OPTIONS,
  },
  affected: {
    command: "affected",
    isGlobal: false,
    aliases: ["af"],
    description: "Group of commands for affected workspaces: list, run",
    options: {},
  },
  affectedList: {
    command: "list",
    parent: "affected",
    isGlobal: false,
    aliases: ["ls"],
    description:
      "List workspaces affected by a set of changed files (git or file list)",
    options: LIST_AFFECTED_OPTIONS,
  },
  affectedRun: {
    command: "run [script]",
    parent: "affected",
    isGlobal: false,
    aliases: [],
    description:
      "Run a script across the workspaces affected by a set of changed files (git or file list)",
    options: RUN_AFFECTED_OPTIONS,
  },
  runInteractive: {
    command: "run-interactive [script] [workspace]",
    isGlobal: false,
    aliases: ["ri"],
    description:
      "Run a single script in a single workspace with stdio inherited, so the script can read user input. Acts as a passthrough: no extra output besides pacwich warnings and errors",
    options: {
      workspace: {
        flags: ["-W", "--workspace <workspace>"],
        description:
          "The workspace to run the script in, resolved by name or alias (required). (Alternative to second positional argument)",
      },
      script: {
        flags: ["-S", "--script <script>"],
        description: "The script to run. (Alternative to positional argument)",
      },
      args: {
        flags: ["-a", "--args <args>"],
        description: "Args to append to the script command",
      },
      inline: {
        flags: ["-i", "--inline"],
        description:
          "Run the script as an inline command from the workspace directory",
      },
      inlineName: {
        flags: ["-I", "--inline-name <name>"],
        description: "An optional name for the script when --inline is passed",
      },
      shell: {
        flags: ["-s", "--shell <shell>"],
        values: [...SCRIPT_SHELL_OPTIONS, "default"],
        description: `When using --inline, the shell to use to run the script`,
      },
    },
  },
  verify: {
    command: "verify [workspacePatterns...]",
    isGlobal: false,
    aliases: [],
    description:
      "Detect implicit workspace dependencies: imports of other workspaces' package names that aren't declared in the importing workspace's package.json",
    options: {
      strict: {
        flags: ["-s", "--strict"],
        description:
          "Exit non-zero when any implicit workspace dependency is found (default: warn-only)",
      },
      json: {
        flags: JSON_FLAGS,
        description: "Output the verify result as JSON",
      },
      pretty: {
        flags: PRETTY_FLAGS,
        description: "Pretty print JSON",
      },
    },
  },
} as const satisfies Record<string, CliCommandConfig>;

/**
 * Compile-time-only proof that every declared `parent` names a real
 * command, recovering the guarantee lost by typing `parent` as a plain
 * `string` (see {@link CliCommandConfig.parent}). Derived entirely from
 * `CLI_COMMANDS_CONFIG` itself, so it stays correct as commands are added
 * with no second list of names to maintain. A bad `parent` fails here with
 * the offending key named in the error, not with a vague type error
 * elsewhere.
 */
type InvalidParentEntries = {
  [K in CliCommandName]: (typeof CLI_COMMANDS_CONFIG)[K] extends {
    parent: string;
  }
    ? (typeof CLI_COMMANDS_CONFIG)[K]["parent"] extends CliCommandName
      ? never
      : K
    : never;
}[CliCommandName];
type AssertNoInvalidParents = [InvalidParentEntries] extends [never]
  ? true
  : ["invalid parent declared on", InvalidParentEntries];
const _assertNoInvalidParents: AssertNoInvalidParents = true;
void _assertNoInvalidParents;

/**
 * Widening the return type to `CliCommandConfig` (rather than the precise
 * per-key literal) is what lets callers read `.parent` uniformly as
 * `string | undefined` instead of hitting "property does not exist" on
 * whichever entries happen not to declare it.
 */
export const getCliCommandConfig = (
  commandName: CliCommandName,
): CliCommandConfig => CLI_COMMANDS_CONFIG[commandName];

export const getCliCommandNames = () =>
  Object.keys(CLI_COMMANDS_CONFIG) as CliCommandName[];

/** Command names registered as top-level Commander commands (no `parent`). */
export const getCliTopLevelCommandNames = (): CliCommandName[] =>
  getCliCommandNames().filter((name) => !getCliCommandConfig(name).parent);

/** Command names registered as subcommands of `parent`. */
export const getCliSubcommandNames = (
  parent: CliCommandName,
): CliCommandName[] =>
  getCliCommandNames().filter(
    (name) => getCliCommandConfig(name).parent === parent,
  );

const findCommandNameByToken = (
  names: CliCommandName[],
  token: string,
): CliCommandName | null => {
  for (const name of names) {
    const { command, aliases } = CLI_COMMANDS_CONFIG[name];
    const commandWord = command.split(/\s+/)[0];
    if (token === commandWord || aliases.includes(token as never)) return name;
  }
  return null;
};

/**
 * Resolve a raw CLI token (a command word or alias exactly as typed) to
 * its canonical top-level command name, or `null` when it matches no
 * top-level command. Subcommand words (e.g. `install`) only resolve via
 * {@link resolveCliSubcommandName}, scoped to their parent.
 */
export const resolveCliCommandName = (token: string): CliCommandName | null =>
  findCommandNameByToken(getCliTopLevelCommandNames(), token);

/**
 * Resolve a raw CLI token to a subcommand of `parent`, or `null` when it
 * matches none of that parent's children.
 */
export const resolveCliSubcommandName = (
  parent: CliCommandName,
  token: string,
): CliCommandName | null =>
  findCommandNameByToken(getCliSubcommandNames(parent), token);

/**
 * Full command usage string for docs/help: a child is prefixed with its
 * parent's own command word (e.g. `completion install [shell]`); a
 * top-level command's `command` string is returned unchanged.
 */
export const getCliFullCommandUsage = (commandName: CliCommandName): string => {
  const config = getCliCommandConfig(commandName);
  if (!config.parent) return config.command;
  // AssertNoInvalidParents guarantees parent is valid.
  const parentConfig = getCliCommandConfig(config.parent as CliCommandName);
  const parentWord = parentConfig.command.split(/\s+/)[0];
  return `${parentWord} ${config.command}`;
};

/**
 * Whether a raw CLI token (and optional following token) resolves to a
 * global command (one that does not operate on a project, such as
 * `completion` or `doctor`). A token that matches no known command
 * returns `false`.
 *
 * `nextToken` disambiguates a parent command with mixed-scope children:
 * when the first token resolves to a parent, the second token is resolved
 * against that parent's children to find the effective scope. A bare
 * parent invocation (no/unmatched second token) is global only when
 * *every* child of that parent is global, since it never runs
 * project-dependent logic on its own (it only ever prints help).
 */
export const isGlobalCliCommandToken = (
  token: string | undefined,
  nextToken?: string,
): boolean => {
  if (!token) return false;
  const name = resolveCliCommandName(token);
  if (!name) return false;

  const children = getCliSubcommandNames(name);
  if (!children.length) return CLI_COMMANDS_CONFIG[name].isGlobal;

  const childName = nextToken
    ? resolveCliSubcommandName(name, nextToken)
    : null;
  if (childName) return CLI_COMMANDS_CONFIG[childName].isGlobal;

  return children.every((child) => CLI_COMMANDS_CONFIG[child].isGlobal);
};
