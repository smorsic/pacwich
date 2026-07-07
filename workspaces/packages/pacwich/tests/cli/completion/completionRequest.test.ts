import { getUserEnvVarName } from "@pacwich/common";
import {
  COMPLETE_COMMAND,
  sanitizeCompletionField,
  tryRunCompletionRequest,
} from "../../../src/cli/commands/completion";
import { logger } from "../../../src/internal/logger";
import { getProjectRoot } from "../../fixtures/testProjects";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
} from "../../util/testFramework";

/**
 * e2e behavior of the hidden `__complete` request handler, exercised
 * against a fixture whose aliases and tags are defined only in an
 * executable `pacwich.project.ts`.
 */

const ROOT = getProjectRoot("projectConfigWorkspacePatternConfigs");
const ENV_DISABLE_EXEC_CONFIGS = getUserEnvVarName(
  "disableExecutableConfigsDefault",
);

/** Run a completion request and return the raw `label⇥value⇥desc⇥flags` lines. */
const completeLines = (words: string[]): string[][] => {
  const chunks: string[] = [];
  const handled = tryRunCompletionRequest([COMPLETE_COMMAND], words, (text) =>
    chunks.push(text),
  );
  expect(handled).toBe(true);
  return chunks
    .join("")
    .split("\n")
    .filter(Boolean)
    .map((line) => line.split("\u001f"));
};

/** Run a completion request and return the value column of each candidate. */
const completeValues = (words: string[]): string[] =>
  completeLines(words).map((columns) => columns[1]);

describe("tryRunCompletionRequest", () => {
  // The handler forces the logger silent; restore it so other suites aren't
  // affected by the global mutation.
  let printLevel: typeof logger.printLevel;
  beforeEach(() => {
    printLevel = logger.printLevel;
  });
  afterEach(() => {
    logger.printLevel = printLevel;
    delete process.env[ENV_DISABLE_EXEC_CONFIGS];
  });

  test("returns false (and does nothing) for a non-__complete request", () => {
    let wrote = false;
    const handled = tryRunCompletionRequest(["doctor"], ["do"], () => {
      wrote = true;
    });
    expect(handled).toBe(false);
    expect(wrote).toBe(false);
  });

  test("evaluates executable configs by default: config tags complete", () => {
    const values = completeValues(["--cwd", ROOT, "run", "x", "tag:"]);
    expect(values).toContain("tag:type-a");
    expect(values).toContain("tag:type-b");
  });

  test("evaluates executable configs by default: config aliases complete", () => {
    const values = completeValues(["--cwd", ROOT, "run", "x", "alias:"]);
    expect(values).toContain("alias:ws-a");
  });

  test("--disable-executable-configs on the line opts completion out", () => {
    expect(
      completeValues([
        "--disable-executable-configs",
        "--cwd",
        ROOT,
        "run",
        "x",
        "tag:",
      ]),
    ).toEqual([]);
  });

  test(`${ENV_DISABLE_EXEC_CONFIGS}=true opts completion out`, () => {
    process.env[ENV_DISABLE_EXEC_CONFIGS] = "true";
    expect(completeValues(["--cwd", ROOT, "run", "x", "tag:"])).toEqual([]);
  });

  test("static candidates need no project (no --cwd, still resolves)", () => {
    // Command completion is project-free, so it works from anywhere.
    expect(completeValues([""])).toContain("run-script");
  });

  test("sanitizeCompletionField strips control chars, ANSI, and separators", () => {
    // A benign value passes through unchanged.
    expect(sanitizeCompletionField("@scope/pkg")).toBe("@scope/pkg");
    // Newlines (the record separator) can't inject a second candidate.
    expect(sanitizeCompletionField("evil\nname")).toBe("evilname");
    // The US field separator (0x1f) can't inject extra columns.
    expect(sanitizeCompletionField("a\x1fb")).toBe("ab");
    // Tabs and carriage returns are removed too.
    expect(sanitizeCompletionField("a\tb\rc")).toBe("abc");
    // ANSI/terminal-control sequences are stripped (no screen manipulation).
    expect(sanitizeCompletionField("clear\x1b[2Jme")).toBe("clearme");
  });

  test("path: candidates are project-root-relative, independent of process.cwd()", () => {
    // workspace.path is already root-relative; resolving it against the
    // process cwd (which is not ROOT here) would double-count the path.
    const values = completeValues(["--cwd", ROOT, "run", "x", "path:"]);
    expect(values).toContain("path:workspaces/a");
    expect(values).toContain("path:workspaces/b");
    expect(values.some((value) => value.includes(".."))).toBe(false);
  });

  test("pattern specifiers carry the nospace flag; workspace values do not", () => {
    const lines = completeLines(["--cwd", ROOT, "run", "x", ""]);
    const flagOf = (value: string) =>
      lines.find((columns) => columns[1] === value)?.[3];
    // A specifier prefix suppresses the trailing space...
    expect(flagOf("path:")).toBe("nospace");
    expect(flagOf("not:")).toBe("nospace");
    // ...but a concrete workspace/alias value keeps it (empty flag column).
    expect(flagOf("ws-a")).toBe("");
  });
});
