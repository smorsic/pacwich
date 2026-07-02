/**
 * Browser stand-in for pacwich's `runScript/subprocesses.ts`.
 *
 * pacwich funnels *every* process it spawns — package.json scripts, inline
 * scripts, and `git` for affected resolution — through the single
 * `createSubprocess()` function. The browser has no processes, so we replace
 * that one function (via `NormalModuleReplacementPlugin` in `rsbuild.config.ts`,
 * and `mock.module` in the tests) with this mock.
 *
 * Crucially, we replace only the *leaf* spawn: the real `runScripts` scheduler
 * still runs above us, so dependency order (`--dep-order`), parallelism, and
 * per-workspace orchestration are all genuinely exercised. Only the process
 * itself is faked, emitting canned per-script output and a 0 exit.
 *
 * The object we return matches the shape `runScript` consumes: it reads
 * `proc.stdout`/`proc.stderr` as async-iterables of byte chunks, awaits
 * `proc.exited` for the code, and reads `proc.signalCode`. See
 * `runScript/runScript.ts` and `runScript/scriptExit.ts` in the pacwich
 * package.
 */
import { fs } from "memfs";
import {
  PROJECT_ROOT,
  resolveScriptMock,
  workspaceNameForCwd,
} from "./demoProject";

/** Minimal structural mirror of pacwich's `Subprocess` (its type isn't exported). */
type MockSubprocess = {
  pid: number;
  readonly killed: boolean;
  readonly exitCode: number | null;
  readonly signalCode: null;
  stdout: AsyncIterable<Uint8Array>;
  stderr: AsyncIterable<Uint8Array>;
  stdin: null;
  exited: Promise<number>;
  kill: () => void;
};

type CreateSubprocessOptions = {
  cwd?: string;
  env?: Record<string, string | undefined>;
  [key: string]: unknown;
};

const encoder = new TextEncoder();

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

async function* byteStream(
  lines: string[],
  delayMsPerLine: number,
): AsyncIterable<Uint8Array> {
  for (const line of lines) {
    if (delayMsPerLine > 0) await sleep(delayMsPerLine);
    yield encoder.encode(line.endsWith("\n") ? line : `${line}\n`);
  }
}

let nextPid = 4000;

/**
 * Ordered log of mocked script runs, in the order pacwich *started* them.
 * Exposed for tests to assert scheduling behavior (e.g. `--dep-order`), since
 * the mock completes instantly and output is rendered in discovery order.
 */
export const runLog: { workspace: string | null; script: string | null }[] =
  [];

const makeSubprocess = (
  stdout: string[],
  stderr: string[],
  exitCode: number,
  delayMsPerLine = 0,
): MockSubprocess => {
  // Resolve `exited` after the output would have finished streaming, so the
  // scheduler doesn't consider the run done before its (delayed) lines flush.
  const totalMs =
    delayMsPerLine > 0
      ? Math.max(stdout.length, stderr.length) * delayMsPerLine
      : 0;
  const exited = totalMs
    ? new Promise<number>((resolve) => setTimeout(() => resolve(exitCode), totalMs))
    : Promise.resolve(exitCode);

  return {
    pid: nextPid++,
    killed: false,
    exitCode,
    signalCode: null,
    stdout: byteStream(stdout, delayMsPerLine),
    stderr: byteStream(stderr, delayMsPerLine),
    stdin: null,
    exited,
    // Nothing real to kill; the mock finishes on its own.
    kill: () => undefined,
  };
};

/**
 * Extract the script name from a resolved command like
 * `npm run --silent build` or `npm run --silent build -- --flag`.
 * Returns the first non-flag token after `run` (before any `--` separator).
 */
const parseScriptName = (command: string): string | null => {
  const tokens = command.trim().split(/\s+/);
  const runIndex = tokens.indexOf("run");
  if (runIndex === -1) return null;
  for (const token of tokens.slice(runIndex + 1)) {
    if (token === "--") return null;
    if (!token.startsWith("-")) return token;
  }
  return null;
};

/** Read the command the executor wrote to a temp shell script in memfs. */
const readTempCommand = (tempPath: string): string | null => {
  try {
    return fs.readFileSync(tempPath, "utf8").toString().trim();
  } catch {
    return null;
  }
};

export const createSubprocess = (
  argv: string[],
  options: CreateSubprocessOptions = {},
): MockSubprocess => {
  const [command] = argv;
  const cwd = options.cwd ?? PROJECT_ROOT;

  // git is only reached by affected-by-diff, which the web-cli gates before
  // this point. If it slips through, fail loudly-but-cleanly rather than hang.
  if (command === "git") {
    return makeSubprocess(
      [],
      ["git is not available in the web-cli sandbox — use --files instead."],
      1,
    );
  }

  // Script runs arrive as `sh -c <tempfile>` (or `bun <tempfile>`); the real
  // command was written into that temp file in memfs.
  const tempPath = argv[argv.length - 1];
  const scriptCommand = readTempCommand(tempPath);
  const workspaceName = workspaceNameForCwd(cwd);
  const scriptName = scriptCommand ? parseScriptName(scriptCommand) : null;
  runLog.push({ workspace: workspaceName, script: scriptName });

  if (workspaceName && scriptName) {
    const { output, delayMsPerLine, exitCode } = resolveScriptMock(
      workspaceName,
      scriptName,
    );
    return makeSubprocess(output, [], exitCode, delayMsPerLine);
  }

  // Fallback: echo whatever we were asked to run so nothing is silently lost.
  return makeSubprocess(
    [`$ ${scriptCommand ?? argv.join(" ")}`, "(mock) completed"],
    [],
    0,
  );
};
