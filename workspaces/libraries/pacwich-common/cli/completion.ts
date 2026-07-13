import { ROOT_WORKSPACE_SELECTOR } from "../project";
import { WORKSPACE_PATTERN_TARGETS } from "../workspaces/workspacePattern";
import {
  CLI_COMMANDS_CONFIG,
  getCliSubcommandNames,
  getCliTopLevelCommandNames,
  resolveCliCommandName,
  resolveCliSubcommandName,
  type CliCommandConfig,
  type CliCommandName,
} from "./commandsConfig";
import {
  getCliGlobalOptionConfig,
  getCliGlobalOptionNames,
} from "./globalOptionsConfig";

export const SUPPORTED_COMPLETION_SHELLS = ["bash", "zsh", "fish"] as const;

export type CompletionShell = (typeof SUPPORTED_COMPLETION_SHELLS)[number];

/** A single static candidate: a fixed value with an optional description. */
export interface CompletionItem {
  value: string;
  description?: string;
}

/**
 * A group of fixed candidates known without loading the project: command
 * names, option flags, enum values, pattern specifiers.
 */
export interface StaticGroup {
  kind: "static";
  /** Group heading (also the completion tag in shells that show groups). */
  label: string;
  items: CompletionItem[];
  /** Do not append space after value (e.g. for workspace pattern syntax) */
  noSpace?: boolean;
}

/**
 * Names the {@link ProjectGroup.source} draws from. Each maps to a lookup
 * the completion command performs against the loaded project.
 */
export type ProjectSource =
  | "script"
  | "tag"
  | "workspaceName"
  | "workspaceAlias"
  | "workspacePath";

/**
 * A group whose candidates come dynamically from a loaded project (workspaces, scripts,
 * tags).
 */
export interface ProjectGroup {
  kind: "dynamic";
  label: string;
  source: ProjectSource;
  /** Filter resolved names to those starting with this. */
  prefix: string;
  /** Literal prepended to each emitted value (e.g. `"alias:"`, `"not:"`). */
  valuePrefix?: string;
  /**
   * When completing scripts, scope the results to these workspaces.
   * Undefined means the project-wide union.
   */
  workspaceScope?: string[];
  /** See {@link StaticGroup.noSpace}. */
  noSpace?: boolean;
}

export type CompletionGroup = StaticGroup | ProjectGroup;

/**
 * Order two candidates: `@scope/...` names cluster together, ahead of
 * plain names, each cluster sorted alphabetically. Keeps scoped package
 * names (e.g. `@acme/ui`) from interleaving with unscoped ones instead of
 * sorting as if the leading `@` weren't there.
 */
const compareCompletionCandidates = (a: string, b: string): number => {
  const aScoped = a.startsWith("@");
  const bScoped = b.startsWith("@");
  if (aScoped !== bScoped) return aScoped ? -1 : 1;
  return a < b ? -1 : a > b ? 1 : 0;
};

/**
 * Keep the names that start with `prefix`, de-duplicated and sorted for
 * stable output ({@link compareCompletionCandidates}). Used by the
 * completion command on each dynamic group's resolved names.
 */
export const filterCompletionCandidates = (
  names: string[],
  prefix: string,
): string[] => {
  const seen = new Set<string>();
  for (const name of names) {
    if (name.startsWith(prefix)) seen.add(name);
  }
  return [...seen].sort(compareCompletionCandidates);
};

/** `path:` -> `workspacePath`, etc. Ties a pattern target to its source. */
const TARGET_TO_SOURCE: Record<
  (typeof WORKSPACE_PATTERN_TARGETS)[number],
  ProjectSource
> = {
  path: "workspacePath",
  alias: "workspaceAlias",
  name: "workspaceName",
  tag: "tag",
};

/** Negation prefixes a workspace pattern may lead with (`not:foo`, `!foo`). */
const NEGATION_PREFIXES = ["not:", "!"] as const;

/** Regex modifier: a `re:`-prefixed pattern value is matched as a regex. */
const REGEX_PREFIX = "re:";

/**
 * Normalized view of one option, unifying global options and per-command
 * options so the line walker can treat them the same.
 */
interface OptionSpec {
  /** Config key (e.g. `"script"`, `"workspacePatterns"`, `"cwd"`). */
  key: string;
  /** Flag tokens, e.g. `["-S", "--script"]`. */
  tokens: string[];
  /** Whether the flag consumes a following value. */
  takesValue: boolean;
  /** Enum values for the flag's argument, if any. */
  values?: readonly string[];
  description: string;
  deprecated?: boolean;
}

/** Split a flags array like `["-S", "--script <script>"]` into a spec. */
const parseOptionSpec = (
  key: string,
  flags: readonly string[],
  values: readonly string[] | undefined,
  description: string,
  deprecated?: boolean,
): OptionSpec => {
  const tokens: string[] = [];
  let takesValue = false;
  for (const flag of flags) {
    const token = flag.split(/\s+/)[0];
    if (token.startsWith("-")) tokens.push(token);
    if (/[<[]/.test(flag)) takesValue = true;
  }
  return { key, tokens, takesValue, values, description, deprecated };
};

/** The global options, normalized. Same for every command. */
const globalOptionSpecs = (): OptionSpec[] =>
  getCliGlobalOptionNames().map((name) => {
    const config = getCliGlobalOptionConfig(name);
    const flags = [config.mainOption, config.shortOption].filter(Boolean);
    const spec = parseOptionSpec(
      name,
      flags,
      config.values ?? undefined,
      config.description,
    );
    // Global option flags carry no `<metavar>`; whether they take a value
    // lives in the config's `param` field instead.
    return { ...spec, takesValue: config.param !== "" };
  });

/** A command's own options, normalized. */
const commandOptionSpecs = (config: CliCommandConfig): OptionSpec[] =>
  Object.entries(config.options).map(([key, option]) =>
    parseOptionSpec(
      key,
      option.flags,
      option.values,
      option.description,
      option.deprecated,
    ),
  );

/**
 * Group label for an option's value candidates, keyed by the option's long
 * flag so shells can show a specific heading (e.g. `--output-style` ->
 * `value-output-style`, which the zsh wrapper renders as "output style
 * value"). The `value-` prefix keeps it from colliding with other labels.
 */
const valueGroupLabel = (spec: OptionSpec): string => {
  const longFlag = spec.tokens.find((token) => token.startsWith("--"));
  const slug = longFlag ? longFlag.replace(/^--/, "") : spec.key;
  return `value-${slug}`;
};

/** Find the option spec a flag token belongs to (global, then command). */
const resolveFlag = (
  flagToken: string,
  globals: OptionSpec[],
  commandOptions: OptionSpec[],
): OptionSpec | null =>
  globals.find((spec) => spec.tokens.includes(flagToken)) ??
  commandOptions.find((spec) => spec.tokens.includes(flagToken)) ??
  null;

/** True when an option supplies workspace scope for script completion. */
const isWorkspaceScopeOption = (
  command: CliCommandName,
  key: string,
): boolean =>
  (command === "runScript" || command === "listWorkspaces") &&
  key === "workspacePatterns"
    ? true
    : command === "runInteractive" && key === "workspace";

/**
 * Context distilled from the already-typed words (everything before the
 * word under the cursor).
 */
interface LineContext {
  command: CliCommandName | null;
  /** Positional args typed after the command (excludes the command token). */
  positionals: string[];
  /** Whether a script was given via `-S`/`--script`. */
  scriptFromOption: boolean;
  /** Whether a workspace was given via `--workspace` (run-interactive). */
  workspaceFromOption: boolean;
  /** Values from `-W`/`--workspace-patterns` (or `--workspace`). */
  workspaceScope: string[];
  /** The final typed token, or undefined if none. */
  lastToken: string | undefined;
}

/** Walk the committed words to build a {@link LineContext}. */
const readLine = (prior: string[]): LineContext => {
  const globals = globalOptionSpecs();
  let command: CliCommandName | null = null;
  let commandOptions: OptionSpec[] = [];
  const positionals: string[] = [];
  const workspaceScope: string[] = [];
  let scriptFromOption = false;
  let workspaceFromOption = false;
  let awaiting: OptionSpec | null = null;

  const applyValue = (spec: OptionSpec, value: string) => {
    if (spec.key === "script") scriptFromOption = true;
    if (command && isWorkspaceScopeOption(command, spec.key)) {
      if (command === "runInteractive") workspaceFromOption = true;
      workspaceScope.push(value);
    }
  };

  const selectCommand = (resolved: CliCommandName) => {
    command = resolved;
    commandOptions = commandOptionSpecs(CLI_COMMANDS_CONFIG[resolved]);
  };

  for (let i = 0; i < prior.length; i++) {
    const token = prior[i];
    if (awaiting) {
      applyValue(awaiting, token);
      awaiting = null;
      continue;
    }
    if (token.startsWith("-")) {
      const eq = token.indexOf("=");
      const flagToken = eq >= 0 ? token.slice(0, eq) : token;
      const spec = resolveFlag(flagToken, globals, commandOptions);
      if (spec) {
        if (eq >= 0) applyValue(spec, token.slice(eq + 1));
        else if (spec.takesValue) awaiting = spec;
      }
      continue;
    }
    if (command === null) {
      const resolved = resolveCliCommandName(token);
      if (resolved) {
        selectCommand(resolved);
        // A parent's second token may select one of its children instead of
        // being a positional value for the parent itself (e.g. `completion
        // install`, vs. `completion zsh` where `zsh` stays a positional).
        const nextToken = prior[i + 1];
        const child =
          nextToken !== undefined
            ? resolveCliSubcommandName(resolved, nextToken)
            : null;
        if (child) {
          selectCommand(child);
          i++;
        }
      }
      continue;
    }
    positionals.push(token);
  }

  return {
    command,
    positionals,
    scriptFromOption,
    workspaceFromOption,
    workspaceScope,
    lastToken: prior[prior.length - 1],
  };
};

/** Static group of top-level command names and aliases. */
const commandGroup = (): StaticGroup => {
  const items: CompletionItem[] = [];
  for (const name of getCliTopLevelCommandNames()) {
    const config = CLI_COMMANDS_CONFIG[name];
    const commandName = config.command.split(/\s+/)[0];
    items.push({ value: commandName, description: config.description });
    for (const alias of config.aliases) {
      items.push({ value: alias, description: config.description });
    }
  }
  return { kind: "static", label: "command", items };
};

/**
 * An option's description, with its accepted values prepended when it takes
 * a fixed set (e.g. `--shell` -> "[bun|system|default] ..."), so the choices
 * are visible on the flag itself, not only when completing its value. Values
 * lead so they survive if a shell truncates a long description.
 */
const describeOption = (spec: OptionSpec): string =>
  spec.values?.length
    ? `[${spec.values.join("|")}] ${spec.description}`
    : spec.description;

/** Turn option specs into a static group of their (non-deprecated) flags. */
const optionSpecsToGroup = (
  label: string,
  specs: OptionSpec[],
): StaticGroup => {
  const items: CompletionItem[] = [];
  for (const spec of specs) {
    if (spec.deprecated) continue;
    const description = describeOption(spec);
    for (const token of spec.tokens) {
      items.push({ value: token, description });
    }
  }
  return { kind: "static", label, items };
};

/**
 * Option-flag groups for the current context. A command's own options and
 * the global options are kept as separate groups so shells that show group
 * headings visually distinguish them. Empty groups are dropped.
 */
const optionGroups = (command: CliCommandName | null): CompletionGroup[] => {
  const groups: CompletionGroup[] = [];
  if (command) {
    groups.push(
      optionSpecsToGroup(
        "command-option",
        commandOptionSpecs(CLI_COMMANDS_CONFIG[command]),
      ),
    );
  }
  groups.push(optionSpecsToGroup("global-option", globalOptionSpecs()));
  return groups.filter(
    (group) => group.kind !== "static" || group.items.length,
  );
};

/** Dynamic groups for a bare workspace name/alias slot (single workspace). */
const workspaceNameGroups = (prefix: string): CompletionGroup[] => [
  { kind: "dynamic", label: "workspace", source: "workspaceName", prefix },
  { kind: "dynamic", label: "alias", source: "workspaceAlias", prefix },
];

/**
 * Groups for a workspace-pattern slot. Parses the documented grammar
 * `[not:|!][ @root | re:<regex> | target:[re:]<value> ]` out of the partial:
 * an optional negation, then either the `@root` selector, a `re:` regex, or
 * an optional `path:`/`alias:`/`name:`/`tag:` target. Offers the matching
 * source(s) plus the pattern prefixes themselves (targets, `re:`, `not:`)
 * and `@root` for discoverability. A `re:` value is a regex, so once one is
 * being typed there is nothing to prefix-complete and no groups are returned.
 */
const patternGroups = (partial: string): CompletionGroup[] => {
  let valuePrefix = "";
  let rest = partial;

  const negation = NEGATION_PREFIXES.find((prefix) => rest.startsWith(prefix));
  if (negation) {
    valuePrefix += negation;
    rest = rest.slice(negation.length);
  }

  const target = WORKSPACE_PATTERN_TARGETS.find((candidate) =>
    rest.startsWith(`${candidate}:`),
  );
  if (target) {
    const afterTarget = rest.slice(target.length + 1);
    // `target:re:<regex>` — the value is a regex, nothing to complete.
    if (afterTarget.startsWith(REGEX_PREFIX)) return [];
    return [
      {
        kind: "dynamic",
        label: target,
        source: TARGET_TO_SOURCE[target],
        prefix: afterTarget,
        valuePrefix: `${valuePrefix}${target}:`,
      },
    ];
  }

  // Bare `re:<regex>` (matched against names) — a regex, nothing to complete.
  if (rest.startsWith(REGEX_PREFIX)) return [];

  // The pattern prefixes offered for discoverability: each target, the regex
  // modifier, and (when not already negated) the negation itself.
  const patterns: CompletionItem[] = [
    ...WORKSPACE_PATTERN_TARGETS.map((candidate) => ({
      value: `${valuePrefix}${candidate}:`,
    })),
    { value: `${valuePrefix}${REGEX_PREFIX}` },
  ];
  if (!valuePrefix) patterns.push({ value: "not:" });

  return [
    {
      kind: "dynamic",
      label: "workspace",
      source: "workspaceName",
      prefix: rest,
      valuePrefix,
    },
    {
      kind: "dynamic",
      label: "alias",
      source: "workspaceAlias",
      prefix: rest,
      valuePrefix,
    },
    // The @root selector is a complete value (keeps its trailing space),
    // valid at the top level after optional negation.
    {
      kind: "static",
      label: "root-selector",
      items: [
        {
          value: `${valuePrefix}${ROOT_WORKSPACE_SELECTOR}`,
          description: "the project root workspace",
        },
      ],
    },
    // Pattern prefixes are typed a value after, so they take no trailing space.
    { kind: "static", label: "specifier", items: patterns, noSpace: true },
  ];
};

/** A single script-completion group, scoped by any `-W` patterns. */
const scriptGroup = (partial: string, scope: string[]): ProjectGroup => ({
  kind: "dynamic",
  label: "script",
  source: "script",
  prefix: partial,
  workspaceScope: scope.length ? scope : undefined,
});

/** Static group offering a parent command's subcommand names and aliases. */
const subcommandGroup = (parent: CliCommandName): StaticGroup => {
  const items: CompletionItem[] = [];
  for (const name of getCliSubcommandNames(parent)) {
    const config = CLI_COMMANDS_CONFIG[name];
    const commandName = config.command.split(/\s+/)[0];
    items.push({ value: commandName, description: config.description });
    for (const alias of config.aliases) {
      items.push({ value: alias, description: config.description });
    }
  }
  return { kind: "static", label: "subcommand", items };
};

/** Shell names offered at `completion`'s own positional slot. */
const completionShellGroup = (): StaticGroup => ({
  kind: "static",
  label: "shell",
  items: SUPPORTED_COMPLETION_SHELLS.map((shell) => ({ value: shell })),
});

/**
 * Positional-slot completion once a command is known.
 *
 * Returns `null` when no
 * positional slot applies (all filled, or the command takes none) so the
 * caller can fall back to option flags.
 *
 * An empty array means a positional
 * slot does apply but the current partial has nothing to complete (e.g. a
 * `re:` regex value, or more patterns are allowed) — no options fallback.
 */
const positionalGroups = (
  context: LineContext,
  partial: string,
): CompletionGroup[] | null => {
  const { command, positionals, scriptFromOption, workspaceFromOption } =
    context;
  const scriptFilled = scriptFromOption || positionals.length >= 1;

  // A parent command's first slot offers its subcommands (e.g. `install`
  // under `completion`), generically for any parent. `completion` also
  // accepts a bare shell name at that same slot, printing the script
  // directly, so it folds in its own shell-name group alongside.
  if (command && positionals.length === 0) {
    const children = getCliSubcommandNames(command);
    if (children.length) {
      return command === "completion"
        ? [completionShellGroup(), subcommandGroup(command)]
        : [subcommandGroup(command)];
    }
  }

  switch (command) {
    case "runScript":
      return scriptFilled
        ? patternGroups(partial)
        : [scriptGroup(partial, context.workspaceScope)];
    case "runAffected":
    case "affectedRun":
      return scriptFilled ? null : [scriptGroup(partial, [])];
    case "runInteractive": {
      if (!scriptFilled) return [scriptGroup(partial, context.workspaceScope)];
      const workspaceFilled = workspaceFromOption || positionals.length >= 2;
      return workspaceFilled ? null : workspaceNameGroups(partial);
    }
    case "scriptInfo":
      return positionals.length === 0 ? [scriptGroup(partial, [])] : null;
    case "workspaceInfo":
      return positionals.length === 0 ? workspaceNameGroups(partial) : null;
    case "tagInfo":
      return positionals.length === 0
        ? [{ kind: "dynamic", label: "tag", source: "tag", prefix: partial }]
        : null;
    case "listWorkspaces":
    case "verify":
      return patternGroups(partial);
    case "completion":
      // First slot handled above; a shell was already given as the
      // positional, so there is nothing further to complete.
      return null;
    case "completionInstall":
      return positionals.length === 0 ? [completionShellGroup()] : null;
    default:
      return null;
  }
};

/**
 * The heart of shell completion: given the words on the command line (the
 * last being the partial word under the cursor), return the ordered
 * candidate groups. Pure and project-free; dynamic groups are resolved by
 * the caller. Never throws — returns `[]` if the line can't be parsed.
 */
export const planCompletion = (words: string[]): CompletionGroup[] => {
  try {
    return plan(words);
  } catch {
    return [];
  }
};

const plan = (words: string[]): CompletionGroup[] => {
  const partial = words.length ? words[words.length - 1] : "";
  const prior = words.slice(0, -1);
  const context = readLine(prior);
  const { command } = context;

  // `--option=<value>` under the cursor: complete the option's enum values,
  // prefixed so the whole word is replaced.
  const inlineMatch = /^(--[\w-]+)=(.*)$/.exec(partial);
  if (inlineMatch) {
    const [, flagToken, valuePartial] = inlineMatch;
    const spec = resolveFlag(
      flagToken,
      globalOptionSpecs(),
      command ? commandOptionSpecs(CLI_COMMANDS_CONFIG[command]) : [],
    );
    if (spec?.values) {
      return [
        {
          kind: "static",
          label: valueGroupLabel(spec),
          items: spec.values
            .filter((value) => value.startsWith(valuePartial))
            .map((value) => ({ value: `${flagToken}=${value}` })),
        },
      ];
    }
    return [];
  }

  // The partial is the value of the immediately preceding option flag.
  if (context.lastToken?.startsWith("-") && !context.lastToken.includes("=")) {
    const spec = resolveFlag(
      context.lastToken,
      globalOptionSpecs(),
      command ? commandOptionSpecs(CLI_COMMANDS_CONFIG[command]) : [],
    );
    if (spec?.takesValue)
      return optionValueGroups(spec, command, context, partial);
  }

  // Completing an option name.
  if (partial.startsWith("-")) return optionGroups(command);

  // No command chosen yet: offer command names.
  if (command === null) return [commandGroup()];

  const groups = positionalGroups(context, partial);

  // fall back to flags if no positional groups are available
  return groups === null ? optionGroups(command) : groups;
};

/** Candidates for the value of a value-taking option. */
const optionValueGroups = (
  spec: OptionSpec,
  command: CliCommandName | null,
  context: LineContext,
  partial: string,
): CompletionGroup[] => {
  if (spec.values) {
    return [
      {
        kind: "static",
        label: valueGroupLabel(spec),
        items: spec.values.map((value) => ({ value })),
      },
    ];
  }
  if (spec.key === "script") {
    return [scriptGroup(partial, context.workspaceScope)];
  }
  if (command && isWorkspaceScopeOption(command, spec.key)) {
    // run-interactive's --workspace is a single workspace (name/alias);
    // run-script/list-workspaces take full patterns.
    return command === "runInteractive"
      ? workspaceNameGroups(partial)
      : patternGroups(partial);
  }
  // Free-form value (paths, refs, args) — defer to the shell's defaults.
  return [];
};

/**
 * Return the shell script that wires up completion for `pacwich`. Each
 * script is a thin wrapper that calls `pacwich __complete -- <words>` and
 * renders the tab-separated `label⇥value⇥description` lines it prints.
 */
export const getCompletionScript = (shell: CompletionShell): string => {
  switch (shell) {
    case "bash":
      return BASH_SCRIPT;
    case "zsh":
      return ZSH_SCRIPT;
    case "fish":
      return FISH_SCRIPT;
  }
};

const BASH_SCRIPT = `# pacwich bash completion
# Install: eval "$(pacwich completion bash)"  (add to ~/.bashrc)
_pacwich_complete() {
  local cur words
  cur="\${COMP_WORDS[COMP_CWORD]}"
  # Words after the program name, up to and including the current one.
  words=("\${COMP_WORDS[@]:1:COMP_CWORD}")

  # bash has no notion of completion groups, so labels are ignored and all
  # candidates land in one flat list.
  local _label value _desc sfx
  local -a candidates=()
  local -A nospace_of=()
  while IFS=$'\\x1f' read -r _label value _desc sfx; do
    [[ -n "$value" ]] || continue
    candidates+=("$value")
    [[ "$sfx" == nospace ]] && nospace_of["$value"]=1
  done < <(pacwich __complete -- "\${words[@]}" 2>/dev/null)

  local IFS=$'\\n'
  COMPREPLY=($(compgen -W "\${candidates[*]}" -- "$cur"))
  unset IFS

  # compopt is all-or-nothing, so suppress the trailing space globally and
  # re-add it to every candidate not marked nospace (pattern specifiers like
  # \`path:\` want the cursor to stay put for the value that follows).
  compopt -o nospace 2>/dev/null
  local i
  for i in "\${!COMPREPLY[@]}"; do
    [[ -n "\${nospace_of[\${COMPREPLY[$i]}]}" ]] || COMPREPLY[$i]+=" "
  done
}
complete -F _pacwich_complete pacwich
`;

const ZSH_SCRIPT = `#compdef pacwich
# pacwich zsh completion
# Install: eval "$(pacwich completion zsh)"  (add to ~/.zshrc)
_pacwich() {
  # Render each kind of candidate as its own titled section (command vs
  # global options, workspaces vs aliases vs pattern specifiers, ...).
  # Scoped to pacwich and set once so a user's own styles still win.
  if [[ -z "$_pacwich_grouping_set" ]]; then
    typeset -g _pacwich_grouping_set=1
    zstyle ':completion:*:*:pacwich:*' group-name ''
    zstyle ':completion:*:*:pacwich:*' format '%F{242}%d%f'
    # Keep the backend's order for workspace names/aliases (scoped @names
    # clustered separately) instead of zsh's sort, which ignores the @.
    zstyle ':completion:*:*:pacwich:*:workspace' sort false
    zstyle ':completion:*:*:pacwich:*:alias' sort false
  fi

  local -a words_to_complete
  words_to_complete=("\${(@)words[2,$CURRENT]}")

  local raw
  raw="$(pacwich __complete -- "\${words_to_complete[@]}" 2>/dev/null)"

  local -A by_label nospace_of
  local -a order
  local label value desc sfx entry
  while IFS=$'\\x1f' read -r label value desc sfx; do
    [[ -z "$value" ]] && continue
    entry="\${value//:/\\\\:}"
    [[ -n "$desc" ]] && entry="$entry:$desc"
    [[ -z "\${by_label[$label]}" ]] && order+=("$label")
    by_label[$label]+=$'\\n'"$entry"
    [[ "$sfx" == nospace ]] && nospace_of[$label]=1
  done <<< "$raw"

  # Friendly section titles; unknown labels fall back to the label itself.
  local -A headings=(
    command 'command'  command-option 'options'  global-option 'global options'
    script 'workspace scripts'  workspace 'workspace names'  alias 'workspace aliases'
    tag 'tag'  path 'path'  name 'name'  specifier 'workspace patterns'
    root-selector 'root selector'  shell 'shell'
  )

  local -a group
  local heading vname
  for label in $order; do
    group=("\${(f)by_label[$label]}")
    group=(\${group:#})
    if [[ "$label" == value-* ]]; then
      # An option's value group, e.g. value-output-style -> "output style value".
      vname="\${label#value-}"
      heading="\${vname//-/ } value"
    else
      heading="\${headings[$label]:-$label}"
    fi
    if [[ -n "\${nospace_of[$label]}" ]]; then
      # Trailing options are passed to compadd; an empty suffix means no
      # space is added after the specifier, so a value can follow directly.
      _describe -t "$label" "$heading" group -S ''
    else
      _describe -t "$label" "$heading" group
    fi
  done
}
# When this file is autoloaded from $fpath, zsh invokes it as _pacwich, so
# run the completer. When it is eval'd/sourced (e.g. from ~/.zshrc), register
# it with compdef instead — calling it directly there has no completion
# context ($CURRENT is unset).
if [ "$funcstack[1]" = "_pacwich" ]; then
  _pacwich
else
  compdef _pacwich pacwich
fi
`;

const FISH_SCRIPT = `# pacwich fish completion
# Install: pacwich completion fish | source  (add to ~/.config/fish/config.fish)
function __pacwich_complete
  set -l tokens (commandline -opc)
  set -e tokens[1]
  set -l cur (commandline -ct)
  pacwich __complete -- $tokens "$cur" 2>/dev/null | while read -l entry
    set -l parts (string split \\x1f -- $entry)
    set -l value $parts[2]
    set -l desc $parts[3]
    test -n "$value"; or continue
    if test -n "$desc"
      printf '%s\\t%s\\n' $value $desc
    else
      printf '%s\\n' $value
    end
  end
end
complete -c pacwich -f -a '(__pacwich_complete)'
`;
