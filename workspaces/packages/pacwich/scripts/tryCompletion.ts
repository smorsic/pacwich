#!/usr/bin/env bun
/**
 * Dev helper: launch an isolated interactive shell (bash, zsh, or fish) with
 * pacwich completions loaded from the *source* CLI, so completion changes can
 * be tried live without a build or a global install.
 *
 * Usage (from the repo root):
 *   bun pw try-completion -- zsh              # or bash | fish
 *   bun pw try-completion -- --shell fish
 *   bun pw try-completion -- zsh --cwd /path/to/another/project
 *   bun pw try-completion -- zsh --dry-run    # print the setup, don't launch
 *
 * The shell starts in a target project (this repo by default, so there are
 * real workspaces/scripts/tags) with a `pacwich` shim on PATH that runs the
 * source CLI with local delegation disabled. Your real shell config and any
 * globally installed pacwich are left untouched: everything lives in a temp
 * dir that is removed on exit.
 */
/* eslint-disable no-console */
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  SUPPORTED_COMPLETION_SHELLS,
  type CompletionShell,
} from "@pacwich/common/cli";

const CLI_DEV_ENTRY = path.resolve(import.meta.dir, "..", "bin", "cliDev.js");
const REPO_ROOT = path.resolve(import.meta.dir, "..", "..", "..", "..");

/** Single-quote a string for POSIX shells (bash/zsh). */
const posixQuote = (value: string): string =>
  `'${value.replace(/'/g, `'\\''`)}'`;

/** Single-quote a string for fish (only `\` and `'` are special inside `'…'`). */
const fishQuote = (value: string): string =>
  `'${value.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;

/** The temp-dir layout, env, and argv needed to launch one shell. */
interface ShellSetup {
  /** Files to write under the temp dir, keyed by relative path. */
  files: Record<string, string>;
  /** Extra environment variables for the shell process. */
  env: Record<string, string>;
  /** Argv (after the shell binary) to launch an interactive session. */
  argv: string[];
}

const bannerLines = (shell: CompletionShell, targetCwd: string): string[] => [
  ``,
  `pacwich completion sandbox (${shell}) — source CLI, your real config untouched`,
  `  cwd: ${targetCwd}`,
  ``,
  `Try (press <TAB> where shown):`,
  `  pacwich <TAB>              commands`,
  `  pacwich run li<TAB>        workspace scripts`,
  `  pacwich run build <TAB>    workspace names / aliases / patterns / @root`,
  `  pacwich run x tag:<TAB>    tags`,
  `  pacwich doctor <TAB>       options (no positionals)`,
  `  pacwich run --<TAB>        options, with value sets`,
  ``,
  `Type 'exit' to leave.`,
];

/**
 * Build the per-shell setup. `binDir` holds the `pacwich` shim; each shell
 * prepends it to PATH, loads completions from the source CLI, and starts in
 * the target project.
 */
const SHELL_SETUPS: Record<
  CompletionShell,
  (binDir: string, targetCwd: string) => ShellSetup
> = {
  bash: (binDir, targetCwd) => {
    const banner = bannerLines("bash", targetCwd)
      .map((line) => `  echo ${posixQuote(line)}`)
      .join("\n");
    return {
      files: {
        bashrc: [
          `export PATH=${posixQuote(binDir)}:"$PATH"`,
          `eval "$(pacwich completion bash)"`,
          `cd ${posixQuote(targetCwd)}`,
          `PS1='pw-completion(bash)> '`,
          banner,
          ``,
        ].join("\n"),
      },
      env: {},
      argv: ["--rcfile", "{{TMP}}/bashrc", "-i"],
    };
  },
  zsh: (binDir, targetCwd) => {
    const banner = bannerLines("zsh", targetCwd)
      .map((line) => `  print -r -- ${posixQuote(line)}`)
      .join("\n");
    return {
      files: {
        "zdotdir/.zshrc": [
          `export PATH=${posixQuote(binDir)}:"$PATH"`,
          `autoload -Uz compinit && compinit -u`,
          `eval "$(pacwich completion zsh)"`,
          `cd ${posixQuote(targetCwd)}`,
          `PROMPT='pw-completion(zsh)%# '`,
          banner,
          ``,
        ].join("\n"),
      },
      // ZDOTDIR points zsh at our isolated .zshrc.
      env: { ZDOTDIR: "{{TMP}}/zdotdir" },
      argv: ["-i"],
    };
  },
  fish: (binDir, targetCwd) => {
    const banner = bannerLines("fish", targetCwd)
      .map((line) => `echo ${fishQuote(line)}`)
      .join("\n");
    return {
      files: {
        "xdg/fish/config.fish": [
          `set -gx PATH ${fishQuote(binDir)} $PATH`,
          `pacwich completion fish | source`,
          `cd ${fishQuote(targetCwd)}`,
          `function fish_prompt; echo -n 'pw-completion(fish)> '; end`,
          banner,
          ``,
        ].join("\n"),
      },
      // fish reads config from $XDG_CONFIG_HOME/fish/config.fish.
      env: { XDG_CONFIG_HOME: "{{TMP}}/xdg" },
      argv: ["-i"],
    };
  },
};

interface Options {
  shell: CompletionShell;
  targetCwd: string;
  dryRun: boolean;
}

const isSupportedShell = (value: string): value is CompletionShell =>
  (SUPPORTED_COMPLETION_SHELLS as readonly string[]).includes(value);

const defaultShell = (): CompletionShell => {
  const fromEnv = path.basename(process.env.SHELL ?? "");
  return isSupportedShell(fromEnv) ? fromEnv : "zsh";
};

const HELP = `Launch an isolated interactive shell with pacwich completions from source.

Usage: bun pw try-completion -- [shell] [--shell <shell>] [--cwd <dir>] [--dry-run]

  shell            One of: ${SUPPORTED_COMPLETION_SHELLS.join(", ")} (default: $SHELL if supported, else zsh)
  --shell <shell>  Same as the positional shell argument
  --cwd <dir>      Project to start in (default: this repo)
  --dry-run        Print the generated setup and exit without launching
  -h, --help       Show this help`;

const parseArgs = (argv: string[]): Options => {
  let shell: CompletionShell | undefined;
  let targetCwd = REPO_ROOT;
  let dryRun = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const valueOf = (inline: string) =>
      inline.includes("=") ? inline.slice(inline.indexOf("=") + 1) : argv[++i];

    if (arg === "-h" || arg === "--help") {
      console.log(HELP);
      process.exit(0);
    } else if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg === "--shell" || arg.startsWith("--shell=")) {
      const value = valueOf(arg);
      if (!value || !isSupportedShell(value)) {
        throw new Error(
          `Unsupported shell "${value ?? ""}". Choose one of: ${SUPPORTED_COMPLETION_SHELLS.join(", ")}`,
        );
      }
      shell = value;
    } else if (arg === "--cwd" || arg.startsWith("--cwd=")) {
      targetCwd = path.resolve(valueOf(arg) ?? "");
    } else if (!arg.startsWith("-")) {
      if (!isSupportedShell(arg)) {
        throw new Error(
          `Unsupported shell "${arg}". Choose one of: ${SUPPORTED_COMPLETION_SHELLS.join(", ")}`,
        );
      }
      shell = arg;
    } else {
      throw new Error(`Unknown argument "${arg}". See --help.`);
    }
  }

  return { shell: shell ?? defaultShell(), targetCwd, dryRun };
};

const main = () => {
  const { shell, targetCwd, dryRun } = parseArgs(process.argv.slice(2));

  if (!existsSync(targetCwd)) {
    throw new Error(`Target directory does not exist: ${targetCwd}`);
  }
  if (!dryRun && !Bun.which(shell)) {
    throw new Error(
      `"${shell}" is not installed or not on PATH. Install it or choose another shell.`,
    );
  }

  const tempDir = mkdtempSync(path.join(tmpdir(), "pacwich-completion-"));
  const binDir = path.join(tempDir, "bin");
  try {
    // The `pacwich` shim the completion wrapper calls: run the source CLI,
    // bypassing local delegation so it stays this working tree's code.
    mkdirSync(binDir, { recursive: true });
    const shimPath = path.join(binDir, "pacwich");
    writeFileSync(
      shimPath,
      [
        `#!/bin/sh`,
        `export PACWICH_DISABLE_LOCAL_DELEGATION=true`,
        `exec bun ${posixQuote(CLI_DEV_ENTRY)} "$@"`,
        ``,
      ].join("\n"),
    );
    chmodSync(shimPath, 0o755);

    const setup = SHELL_SETUPS[shell](binDir, targetCwd);
    const resolveTmp = (value: string) => value.replaceAll("{{TMP}}", tempDir);

    for (const [relativePath, content] of Object.entries(setup.files)) {
      const filePath = path.join(tempDir, relativePath);
      mkdirSync(path.dirname(filePath), { recursive: true });
      writeFileSync(filePath, content);
    }

    const env = Object.fromEntries(
      Object.entries(setup.env).map(([key, value]) => [key, resolveTmp(value)]),
    );
    const argv = setup.argv.map(resolveTmp);

    if (dryRun) {
      console.log(`shell:  ${shell}`);
      console.log(`cwd:    ${targetCwd}`);
      console.log(`shim:   ${shimPath} -> bun ${CLI_DEV_ENTRY}`);
      console.log(`env:    ${JSON.stringify(env)}`);
      console.log(`launch: ${shell} ${argv.join(" ")}`);
      for (const [relativePath, content] of Object.entries(setup.files)) {
        console.log(`\n--- ${relativePath} ---\n${resolveTmp(content)}`);
      }
      return 0;
    }

    console.log(
      `Launching isolated ${shell} with pacwich completions (source CLI). Type 'exit' to leave.`,
    );
    const result = spawnSync(shell, argv, {
      stdio: "inherit",
      env: { ...process.env, ...env },
    });
    return result.status ?? 0;
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
};

try {
  process.exit(main());
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
