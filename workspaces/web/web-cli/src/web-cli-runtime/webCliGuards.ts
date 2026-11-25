/**
 * Front-door gate for the browser web CLI.
 *
 * Some pacwich features can't work in the browser (no shell, no git, a fixed
 * working directory). Rather than let them fail deep in the CLI with a stack
 * trace, we reject them up front — on the tokenized user input, before the CLI
 * runs — with a single friendly line. This mirrors how the previous
 * backend-driven web CLI gated features (inline scripts, `--cwd`, and shell
 * operators) and adds git-diff affected resolution, which this widget
 * replaces with `--files`. `doctor` used to be gated here too, but now runs
 * for real against the runtime's shimmed `process`/`os`/`child_process`
 * (see processShim.ts, osShim.ts, stubs.ts), reporting plausible dummy
 * values wherever the browser has nothing real to report.
 *
 * Aliases are taken from pacwich's option config: `--cwd`/`-d`,
 * `--inline`/`-i`, `--inline-name`/`-I`, `--files`/`-F`, `--help`/`-h`.
 */

export type GuardResult = { message: string } | null;

/** True if `tokens` contains any of `flags`, incl. the `--flag=value` form. */
const hasFlag = (tokens: string[], flags: string[]): boolean =>
  tokens.some((token) =>
    flags.some((flag) => token === flag || token.startsWith(`${flag}=`)),
  );

/**
 * Bare shell operators our tokenizer would otherwise pass to pacwich as bogus
 * arguments. Anything inside quotes has already been consumed by the tokenizer,
 * so we test the raw line for these characters/sequences.
 */
const SHELL_OPERATOR = /[|<>;`&]|\$\(/;

/**
 * Top-level command names that resolve affected workspaces, including the
 * deprecated pre-`affected`-subcommand forms.
 */
const AFFECTED_COMMAND_NAMES = [
  "affected",
  "af",
  "list-affected",
  "ls-affected",
  "run-affected",
];

/**
 * True when `tokens` invokes an affected command that would default to git
 * diffing (no `--files`/`-F`) — the actual condition that determines whether
 * git gets touched at all, rather than checking for `--base`/`--head`
 * specifically (those only override the *refs* compared; omitting them
 * still diffs against git). `--help`/`-h` is excluded since it never runs
 * the command body.
 */
const usesGitDiffAffectedResolution = (tokens: string[]): boolean =>
  AFFECTED_COMMAND_NAMES.includes(tokens[0] ?? "") &&
  !hasFlag(tokens, ["--files", "-F"]) &&
  !hasFlag(tokens, ["--help", "-h"]);

/**
 * Decide whether a command line is allowed. Returns `null` to allow, or a
 * `{ message }` to reject (rendered to stderr with a non-zero exit). Operates
 * on the *user* tokens, before `--cwd`/`--pm` are injected.
 */
export const checkCommandLine = (
  rawInput: string,
  tokens: string[],
): GuardResult => {
  if (SHELL_OPERATOR.test(rawInput)) {
    return {
      message:
        "Shell operations aren't supported here. The web CLI only passes arguments to `pacwich` (no pipes, redirects, subshells, background jobs, etc.).",
    };
  }

  if (hasFlag(tokens, ["--cwd", "-d"])) {
    return {
      message:
        "`--cwd` is fixed to the demo project in the web CLI and can't be changed.",
    };
  }

  if (hasFlag(tokens, ["--inline", "-i", "--inline-name", "-I"])) {
    return {
      message:
        "Inline scripts (`--inline`) aren't supported in the web CLI. Run a package.json script instead, e.g. `run build`.",
    };
  }

  if (usesGitDiffAffectedResolution(tokens)) {
    return {
      message:
        "Git diffs aren't available in the web CLI. Use `--files` instead, e.g. `affected list --files 'packages/**/*.ts'`.",
    };
  }

  return null;
};
