import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  SUPPORTED_COMPLETION_SHELLS,
  getCompletionScript,
  type CompletionShell,
} from "@pacwich/common/cli";

/**
 * `pacwich completion install` support: detect the current shell, then wire
 * up completions for it and report exactly what was written.
 */

const isCompletionShell = (value: string): value is CompletionShell =>
  (SUPPORTED_COMPLETION_SHELLS as readonly string[]).includes(value);

// ---------------------------------------------------------------------------
// Shell detection
// ---------------------------------------------------------------------------

const normalizeShellName = (raw: string): CompletionShell | null => {
  // `ps comm` / `$SHELL` can be a path, and a login shell shows as `-zsh`.
  const base = path.basename(raw.trim()).replace(/^-/, "").toLowerCase();
  return isCompletionShell(base) ? base : null;
};

/** Parent pid and command name of a process, or null if it can't be read. */
export interface ProcessInfo {
  ppid: number;
  name: string;
}

const readProcessInfo = (pid: number): ProcessInfo | null => {
  try {
    const out = execFileSync("ps", ["-o", "ppid=,comm=", "-p", String(pid)], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 1000,
    }).trim();
    const match = /^\s*(\d+)\s+(.+)$/.exec(out);
    if (!match) return null;
    return { ppid: Number(match[1]), name: match[2].trim() };
  } catch {
    return null;
  }
};

/** Options for {@link detectShell} (the injectable bits exist for testing). */
export interface DetectShellOptions {
  env?: NodeJS.ProcessEnv;
  startPid?: number;
  readProcess?: (pid: number) => ProcessInfo | null;
}

/**
 * Best-effort detection of the interactive shell pacwich is running under.
 * Walks the parent-process chain to the first bash/zsh/fish (skipping the
 * node/bun/pacwich layers a global install adds), then falls back to
 * `$SHELL`. Returns null when no supported shell can be determined.
 *
 * @example
 * ```ts
 * detectShell(); // "zsh" | "bash" | "fish" | null
 * ```
 */
export const detectShell = ({
  env = process.env,
  startPid = process.ppid,
  readProcess = readProcessInfo,
}: DetectShellOptions = {}): CompletionShell | null => {
  let pid = startPid;
  for (let depth = 0; depth < 12 && pid > 1; depth++) {
    const info = readProcess(pid);
    if (!info) break;
    const shell = normalizeShellName(info.name);
    if (shell) return shell;
    if (info.ppid < 1 || info.ppid === pid) break;
    pid = info.ppid;
  }
  return env.SHELL ? normalizeShellName(env.SHELL) : null;
};

// ---------------------------------------------------------------------------
// Install
// ---------------------------------------------------------------------------

/** Wraps the lines pacwich manages inside a user's rc file. */
const MARKER_START = "# >>> pacwich completion >>>";
const MARKER_END = "# <<< pacwich completion <<<";

/** Result of installing completions for one shell. */
export interface CompletionInstallResult {
  shell: CompletionShell;
  filePath: string;
  outcome: "created" | "updated" | "unchanged";
  /** Exactly what pacwich wrote: the managed rc block, or the fish script. */
  snippet: string;
}

export interface InstallCompletionOptions {
  shell: CompletionShell;
  env?: NodeJS.ProcessEnv;
}

const homeDir = (env: NodeJS.ProcessEnv): string => env.HOME ?? os.homedir();

const RC_BLOCK_BODY: Record<"bash" | "zsh", string[]> = {
  bash: [`eval "$(pacwich completion bash)"`],
  zsh: [
    // Initialize compsys before the wrapper registers via compdef, but skip
    // it when a framework already ran compinit (avoids a double init).
    `(( $+functions[compdef] )) || { autoload -Uz compinit && compinit }`,
    `eval "$(pacwich completion zsh)"`,
  ],
};

const buildBlock = (shell: "bash" | "zsh"): string =>
  [MARKER_START, ...RC_BLOCK_BODY[shell], MARKER_END].join("\n");

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Replace the existing pacwich block, or append it, keeping one trailing newline. */
const applyBlock = (content: string, block: string): string => {
  const pattern = new RegExp(
    `${escapeRegExp(MARKER_START)}[\\s\\S]*?${escapeRegExp(MARKER_END)}`,
  );
  if (pattern.test(content)) return content.replace(pattern, block);
  const base = content.replace(/\n*$/, "");
  return base ? `${base}\n\n${block}\n` : `${block}\n`;
};

const writeIfChanged = (
  filePath: string,
  next: string,
): CompletionInstallResult["outcome"] => {
  const before = existsSync(filePath) ? readFileSync(filePath, "utf8") : null;
  const outcome =
    before === null ? "created" : before === next ? "unchanged" : "updated";
  if (outcome !== "unchanged") {
    mkdirSync(path.dirname(filePath), { recursive: true });
    writeFileSync(filePath, next);
  }
  return outcome;
};

const installShellRc = (
  shell: "bash" | "zsh",
  env: NodeJS.ProcessEnv,
): CompletionInstallResult => {
  const filePath =
    shell === "bash"
      ? path.join(homeDir(env), ".bashrc")
      : path.join(env.ZDOTDIR ?? homeDir(env), ".zshrc");
  const block = buildBlock(shell);
  const before = existsSync(filePath) ? readFileSync(filePath, "utf8") : "";
  const outcome = writeIfChanged(filePath, applyBlock(before, block));
  return { shell, filePath, outcome, snippet: block };
};

const installFish = (env: NodeJS.ProcessEnv): CompletionInstallResult => {
  const configHome = env.XDG_CONFIG_HOME ?? path.join(homeDir(env), ".config");
  // fish autoloads every *.fish in this dir, so no config edit is needed.
  const filePath = path.join(configHome, "fish", "completions", "pacwich.fish");
  // Normalize to exactly one trailing newline (the template already ends in one).
  const script = getCompletionScript("fish").replace(/\n*$/, "") + "\n";
  const outcome = writeIfChanged(filePath, script);
  return { shell: "fish", filePath, outcome, snippet: script.trimEnd() };
};

/**
 * Install completions for `shell`, honoring `HOME`/`ZDOTDIR`/
 * `XDG_CONFIG_HOME` from `env`. Idempotent: re-running updates the managed
 * block/file in place.
 *
 * @example
 * ```ts
 * installCompletion({ shell: "zsh" });
 * // { shell: "zsh", filePath: "/home/me/.zshrc", outcome: "created", snippet: "# >>> ..." }
 * ```
 */
export const installCompletion = ({
  shell,
  env = process.env,
}: InstallCompletionOptions): CompletionInstallResult =>
  shell === "fish" ? installFish(env) : installShellRc(shell, env);

// The profiles a login bash reads, in the order it picks the first existing one.
const LOGIN_PROFILE_FILES = [".bash_profile", ".bash_login", ".profile"];

/** Whether the login profile bash reads already sources ~/.bashrc. */
const loginProfileSourcesBashrc = (env: NodeJS.ProcessEnv): boolean => {
  const home = homeDir(env);
  for (const name of LOGIN_PROFILE_FILES) {
    const filePath = path.join(home, name);
    if (existsSync(filePath)) {
      // A login bash reads only the first of these that exists.
      return readFileSync(filePath, "utf8").includes(".bashrc");
    }
  }
  return false; // none exist -> a login shell sources nothing
};

export interface BashLoginHintOptions {
  isMacOS: boolean;
  env?: NodeJS.ProcessEnv;
}

/**
 * A nudge for the one case where installing bash completions to `~/.bashrc`
 * may not take effect: macOS, where terminals open bash as a *login* shell
 * that reads `~/.bash_profile` instead. Returns null (no warning) off macOS,
 * or when a login profile already sources `~/.bashrc` — so the majority of
 * users see nothing. Only meaningful when installing bash completions.
 *
 * @example
 * ```ts
 * bashLoginShellHint({ isMacOS: true }); // "On macOS, terminals open bash..." | null
 * ```
 */
export const bashLoginShellHint = ({
  isMacOS,
  env = process.env,
}: BashLoginHintOptions): string | null => {
  if (!isMacOS || loginProfileSourcesBashrc(env)) return null;
  return [
    `On macOS, terminals open bash as a login shell, which reads ~/.bash_profile, not the ~/.bashrc just updated.`,
    `To load completions in new terminals, add this to ~/.bash_profile:`,
    `  [ -f ~/.bashrc ] && . ~/.bashrc`,
  ].join("\n");
};

// ---------------------------------------------------------------------------
// User-facing text
// ---------------------------------------------------------------------------

/** The setup help printed by bare `pacwich completion`. */
export const completionInfoText = (): string =>
  [
    `pacwich shell completions (${SUPPORTED_COMPLETION_SHELLS.join(", ")})`,
    ``,
    `Install (auto-detects your shell):`,
    `  pacwich completion install`,
    `  pacwich completion install <${SUPPORTED_COMPLETION_SHELLS.join("|")}>   # target a specific shell`,
    ``,
    `Or wire it up yourself:`,
    `  bash   ~/.bashrc:   eval "$(pacwich completion bash)"`,
    `  zsh    ~/.zshrc:    eval "$(pacwich completion zsh)"      # after compinit`,
    `  fish:               pacwich completion fish > ~/.config/fish/completions/pacwich.fish`,
    ``,
    `Print a script:  pacwich completion <${SUPPORTED_COMPLETION_SHELLS.join("|")}>`,
  ].join("\n");

const RELOAD_HINT: Record<CompletionShell, string> = {
  bash: "source ~/.bashrc",
  zsh: "source ~/.zshrc",
  fish: "restart your shell",
};

/** Human-readable report of an install, echoing exactly what changed. */
export const formatInstallReport = (
  result: CompletionInstallResult,
): string => {
  const { shell, filePath, outcome, snippet } = result;

  if (outcome === "unchanged") {
    return `pacwich ${shell} completions already up to date.\n  ${filePath}`;
  }

  const verb = outcome === "created" ? "Created" : "Updated";
  const lines = [`Installed pacwich ${shell} completions.`, ``];

  if (shell === "fish") {
    lines.push(
      `${verb} ${filePath}`,
      `  (contains the \`pacwich completion fish\` script)`,
    );
  } else {
    const indented = snippet
      .split("\n")
      .map((line) => `  ${line}`)
      .join("\n");
    lines.push(`${verb} ${filePath}, adding:`, ``, indented);
  }

  lines.push(``, `Then ${RELOAD_HINT[shell]} to activate.`);
  return lines.join("\n");
};
