/**
 * Runs the real pacwich CLI against the in-memory mock monorepo and streams
 * its stdout/stderr back to the caller (the terminal UI).
 *
 * The CLI is the genuine `createCli()` from the `pacwich` package, bundled for
 * the browser. We only supply browser-friendly plumbing: a seeded memfs
 * volume (via the `fs` alias), a `process` shim, and the `writeOutput` hook
 * that pacwich already exposes for embedding.
 */
// `createCli` is imported for its type only (erased at build); the value is
// loaded via dynamic import below so pacwich's modules evaluate only after the
// env shims are in place.
import type { createCli as CreateCliFn } from "pacwich/cli";
// Env shims, imported before any pacwich module evaluates. They self-install
// on import: bufferShim teaches the buffer polyfill `base64url`, pathShim adds
// `path.matchesGlob`, and processShim provides `globalThis.process` (several
// pacwich modules read `process.platform`/`process.versions` at top-level).
import "./bufferShim";
import { PROJECT_ROOT, seedDemoProject } from "../demo-project";
import "./pathShim";
import { installProcessShim, ProcessExit } from "./processShim";
import { checkCommandLine } from "./webCliGuards";

type Cli = ReturnType<typeof CreateCliFn>;

export type OutputStream = "stdout" | "stderr";

export type RunOptions = {
  /** Terminal width, so help/output wraps to the visible columns. */
  terminalWidth?: number;
  /** Called for each chunk the CLI writes, as it is written. */
  onOutput?: (text: string, stream: OutputStream) => void;
};

export type RunResult = {
  /** Full captured stdout. */
  stdout: string;
  /** Full captured stderr. */
  stderr: string;
  /** Process exit code the CLI requested (0 if it returned normally). */
  exitCode: number;
};

/**
 * Tokenize a command line into argv. Supports single/double quotes; this is a
 * deliberately small parser (no shell operators, globbing, or substitution).
 */
export const tokenize = (commandLine: string): string[] => {
  const tokens: string[] = [];
  const pattern = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(commandLine)) !== null) {
    tokens.push(match[1] ?? match[2] ?? match[3] ?? "");
  }
  // A leading "pacwich" is implied by the prompt, so drop it if typed.
  if (tokens[0] === "pacwich") tokens.shift();
  return tokens;
};

/** Lazily-created CLI instance (creating it is cheap, but reuse is fine). */
let cli: Cli | undefined;

export const runPacwichCli = async (
  commandLine: string,
  { terminalWidth = 80, onOutput }: RunOptions = {},
): Promise<RunResult> => {
  installProcessShim();
  seedDemoProject();

  const tokens = tokenize(commandLine);

  // Reject features the browser can't support (inline scripts, git diffs,
  // `--cwd`, shell operators) up front, with a friendly line instead of a
  // deep stack trace. See `webCliGuards.ts`.
  const guard = checkCommandLine(commandLine, tokens);
  if (guard) {
    const text = `${guard.message}\n`;
    onOutput?.(text, "stderr");
    return { stdout: "", stderr: text, exitCode: 2 };
  }

  if (!cli) {
    // Loaded lazily so pacwich's modules evaluate only after the process
    // shim and memfs are ready.
    const { createCli } = await import("pacwich/cli");
    cli = createCli({ defaultCwd: PROJECT_ROOT });
  }

  let stdout = "";
  let stderr = "";

  const write = (stream: OutputStream) => (chunk: unknown) => {
    const text = typeof chunk === "string" ? chunk : String(chunk ?? "");
    if (stream === "stdout") stdout += text;
    else stderr += text;
    onOutput?.(text, stream);
  };

  // The CLI resolves the project from `--cwd`; `--pm npm` makes discovery
  // deterministic (the mock repo only carries a package-lock.json anyway).
  const argv = ["--cwd", PROJECT_ROOT, "--pm", "npm", ...tokens];

  let exitCode = 0;
  try {
    await cli.run({
      argv,
      programmatic: true,
      terminalWidth,
      terminalHeight: 30,
      writeOutput: {
        stdout: write("stdout"),
        stderr: write("stderr"),
      },
    });
  } catch (error) {
    if (error instanceof ProcessExit) {
      exitCode = error.code;
    } else {
      const message = error instanceof Error ? error.message : String(error);
      stderr += message;
      onOutput?.(message, "stderr");
      exitCode = 1;
    }
  }

  return { stdout, stderr, exitCode };
};
