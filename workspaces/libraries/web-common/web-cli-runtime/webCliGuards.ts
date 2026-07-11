/**
 * Front-door gate for the browser web CLI.
 *
 * Some pacwich features can't work in the browser (no shell, no git, a fixed
 * working directory). Rather than let them fail deep in the CLI with a stack
 * trace, we reject them up front — on the tokenized user input, before the CLI
 * runs — with a single friendly line. This mirrors how the previous
 * backend-driven web CLI gated features (inline scripts, `doctor`, `--cwd`, and
 * shell operators) and adds git-diff affected resolution, which this widget
 * replaces with `--files`.
 *
 * Aliases are taken from pacwich's option config: `--cwd`/`-d`,
 * `--inline`/`-i`, `--inline-name`/`-I`, `--base`/`-B`, `--head`/`-H`.
 */

export type GuardResult = { message: string } | null;

/** True if `tokens` contains any of `flags`, incl. the `--flag=value` form. */
const hasFlag = (tokens: string[], flags: string[]): boolean =>
  tokens.some((token) =>
    flags.some((flag) => token === flag || token.startsWith(`${flag}=`)),
  );

/** The first non-option token — i.e. the command name, if any. */
const commandName = (tokens: string[]): string | undefined =>
  tokens.find((token) => !token.startsWith("-"));

/**
 * Bare shell operators our tokenizer would otherwise pass to pacwich as bogus
 * arguments. Anything inside quotes has already been consumed by the tokenizer,
 * so we test the raw line for these characters/sequences.
 */
const SHELL_OPERATOR = /[|<>;`&]|\$\(/;

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
        "Shell operations aren't supported here — the web CLI only passes arguments to `pacwich` (no pipes, redirects, subshells, or background jobs).",
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
        "Inline scripts (`--inline`) aren't supported in the web CLI — there's no shell to run them. Run a package.json script instead, e.g. `run build`.",
    };
  }

  if (commandName(tokens) === "doctor") {
    return {
      message:
        "The `doctor` command isn't available in the web CLI — it inspects the host environment.",
    };
  }

  if (hasFlag(tokens, ["--base", "-B", "--head", "-H"])) {
    return {
      message:
        "Git diffs aren't available in the web CLI — use `--files` instead, e.g. `list-affected --files 'packages/**/*.ts'`.",
    };
  }

  return null;
};
