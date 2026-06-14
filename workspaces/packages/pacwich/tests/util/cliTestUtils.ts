import path from "path";
import packageJson from "../../package.json";
import { getCliCommandConfig, type CliCommandName } from "../../src/cli";
import { createRawPattern } from "../../src/internal/core";
import { createSubprocess } from "../../src/runScript/subprocesses";
import { type TestProjectName } from "../fixtures/testProjects";
import { loadFixture } from "./fixtures";
import { IS_BUN } from "./runtime";
import { expect } from "./testFramework";

export const listCommandAndAliases = (commandName: CliCommandName) => {
  const config = getCliCommandConfig(commandName);
  return [config.command.split(/\s+/)[0], ...config.aliases];
};

export const USAGE_OUTPUT_PATTERN = new RegExp(
  createRawPattern(`Usage: pacwich [options] [command]

Monorepo tooling that works on top of Bun, npm, or pnpm workspaces

Options:`) +
    "(.|\n)*" +
    createRawPattern(`Commands:\n`) +
    "(.|\n)*display help for command$",
  "m",
);

export interface SetupTestOptions {
  /** If provided, the test will be run in the project with the given name. Cannot be used together with workingDirectory. */
  testProject?: TestProjectName;
  /** If provided, the test will be run in the given working directory. Cannot be used together with testProject. */
  workingDirectory?: string;
  /** If provided, the test will be run with the given environment variables. */
  env?: Record<string, string>;
}

export interface OutputText {
  raw: string;
  sanitized: string;
  sanitizedCompactLines: string;
}

export interface OutputLine {
  text: OutputText;
  source: "stdout" | "stderr";
}

export interface RunResult {
  outputLines: OutputLine[];
  stdoutAndErr: OutputText;
  stdout: OutputText;
  stderr: OutputText;
  exitCode: number;
}

export interface SetupTestResult {
  run: (...argv: string[]) => Promise<RunResult>;
}

export const assertOutputMatches = (output: string, pattern: string | RegExp) =>
  expect(output.trim()).toMatch(
    pattern instanceof RegExp
      ? pattern
      : new RegExp("^" + createRawPattern(pattern.trim()) + "$", "i"),
  );

const blankOutputText: OutputText = {
  raw: "",
  sanitized: "",
  sanitizedCompactLines: "",
};

export type CreateCliSubprocessOptions = {
  env?: Record<string, string>;
  argv: string[];
  testProject?: TestProjectName;
  /** Takes precedence over testProject if passed */
  workingDirectoryOverride?: string;
  /**
   * Bun-style PTY options. Honored only on Bun (`Bun.spawn` supports it
   * natively); ignored under Node since the `child_process.spawn`-based
   * fallback has no PTY. Use `IS_PTY_SUPPORTED` to gate tests that
   * require a real PTY.
   */
  terminal?: Bun.Spawn.SpawnOptions<"pipe", "pipe", "pipe">["terminal"];
};

/**
 * When tests run from a build artifact (dist.test/), `packageJson.bin`
 * already resolves to the built `bin/cli.js`. When running against
 * source, `packageJson.bin` points to `bin/cliDev.js` (Bun-only).
 */
const IS_BUILD = process.env.IS_BUILD === "true";

export const SOURCE_BIN_PATH = path.resolve(
  __dirname,
  "../../",
  packageJson.bin.pacwich,
);

const DIST_BIN_PATH = IS_BUILD
  ? path.resolve(__dirname, "../../", packageJson.bin.pacwich)
  : path.resolve(__dirname, "../../dist/bin/cli.js");

/**
 * Argv prefix to invoke the CLI under the active test runtime. Bun runs
 * the source bin directly (or the built bin under IS_BUILD, which
 * `packageJson.bin` already points to). Node runs the built bin — from
 * the sibling `dist/` for source runs, or the build root for IS_BUILD.
 */
export const CLI_INVOCATION: readonly string[] = IS_BUN
  ? ["bun", SOURCE_BIN_PATH]
  : [process.execPath, DIST_BIN_PATH];

export const createCliSubprocess = ({
  env,
  argv,
  testProject,
  workingDirectoryOverride: workingDirectory,
  terminal,
}: CreateCliSubprocessOptions) => {
  const testProjectRoot =
    workingDirectory ?? loadFixture(testProject ?? "default");

  const fullArgv = [...CLI_INVOCATION, ...argv];
  const fullEnv = {
    ...process.env,
    ...env,
    FORCE_COLOR: "1",
  };

  // Tests that want PTY frames (e.g. grouped-output snapshots) pass a
  // `terminal` callback. Under Bun, route through `Bun.spawn` to get a
  // real PTY; under Node we have no equivalent, so the regular
  // child_process path is used and PTY-dependent tests skip via
  // IS_PTY_SUPPORTED.
  if (terminal && IS_BUN) {
    return Bun.spawn(fullArgv, {
      cwd: testProjectRoot,
      env: fullEnv,
      stdout: "pipe",
      stderr: "pipe",
      terminal,
    });
  }

  return createSubprocess(fullArgv, {
    cwd: testProjectRoot,
    env: fullEnv,
    stdout: "pipe",
    stderr: "pipe",
  });
};

export const setupCliTest = (
  { testProject, workingDirectory, env }: SetupTestOptions = {
    testProject: "default",
  },
): SetupTestResult => {
  if (testProject && workingDirectory) {
    throw new Error("Cannot specify both testProject and workingDirectory");
  }

  const sanitizeText = (text: string) =>
    // eslint-disable-next-line no-control-regex
    text.replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, "");

  const run = async (...argv: string[]) => {
    const subprocess = createCliSubprocess({
      env,
      argv,
      testProject,
      workingDirectoryOverride: workingDirectory,
    });

    const outputLines: OutputLine[] = [];
    const stdout: OutputText = { ...blankOutputText };
    const stderr: OutputText = { ...blankOutputText };
    const stdoutAndErr: OutputText = { ...blankOutputText };

    const appendOutputLine = (outputText: OutputText, line: string) => {
      outputText.raw += line + "\n";
      outputText.sanitized += sanitizeText(line) + "\n";
    };

    const pipeOutput = async (source: "stdout" | "stderr") => {
      const stream = subprocess[source];
      if (stream) {
        for await (const chunk of stream) {
          outputLines.push(
            ...new TextDecoder()
              .decode(chunk)
              .split("\n")
              .map((line) => {
                appendOutputLine(source === "stdout" ? stdout : stderr, line);
                appendOutputLine(stdoutAndErr, line);
                return {
                  text: {
                    raw: line,
                    sanitized: sanitizeText(line),
                    sanitizedCompactLines: sanitizeText(line),
                  },
                  source,
                };
              }),
          );
        }
      }
    };

    await Promise.all([pipeOutput("stdout"), pipeOutput("stderr")]);

    const sanitizeCompact = (outputText: OutputText) => {
      outputText.sanitizedCompactLines = outputText.sanitized.replace(
        /(\n+)/gm,
        "\n",
      );
      return outputText;
    };

    return {
      outputLines,
      stdoutAndErr: sanitizeCompact(stdoutAndErr),
      stdout: sanitizeCompact(stdout),
      stderr: sanitizeCompact(stderr),
      exitCode: await subprocess.exited,
    };
  };

  return { run };
};
