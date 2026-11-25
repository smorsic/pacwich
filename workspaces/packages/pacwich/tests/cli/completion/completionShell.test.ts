import { spawnSync } from "node:child_process";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { getCompletionScript } from "@pacwich/common/cli";
import { getProjectRoot } from "../../fixtures/testProjects";
import { CLI_INVOCATION } from "../../util/cliTestUtils";
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  test,
} from "../../util/testFramework";

/**
 * End-to-end test of the generated bash completion wrapper, driven in a real
 * bash. The per-shell wrappers are thin renderers over the same `__complete`
 * protocol, so bash (near-universal on maintainer machines and CI) exercises
 * the machinery they all share: word slicing, the US-delimited protocol
 * parse, `compgen` prefix filtering, and the nospace trailing-space logic.
 * zsh/fish-specific rendering is checked by the `getCompletionScript` unit
 * tests and, manually, by `bun pw try-completion`.
 *
 * Skipped when bash is unavailable.
 */
const hasBash = (() => {
  try {
    const result = spawnSync("bash", ["--version"], { stdio: "ignore" });
    return !result.error && result.status === 0;
  } catch {
    return false;
  }
})();

/** Single-quote a string for POSIX shells. */
const posixQuote = (value: string): string =>
  `'${value.replace(/'/g, `'\\''`)}'`;

describe.skipIf(!hasBash)("completion bash wrapper (e2e)", () => {
  let tempDir: string;
  let shimDir: string;
  let wrapperFile: string;

  beforeAll(() => {
    tempDir = mkdtempSync(path.join(tmpdir(), "pacwich-bash-e2e-"));
    shimDir = path.join(tempDir, "bin");
    mkdirSync(shimDir, { recursive: true });

    // A `pacwich` the wrapper can call: the CLI under the active test runtime
    // (source bin under Bun, built bin under Node/IS_BUILD), with local
    // delegation disabled so it stays this build's code.
    const shimPath = path.join(shimDir, "pacwich");
    writeFileSync(
      shimPath,
      [
        `#!/bin/sh`,
        `export PACWICH_DISABLE_LOCAL_DELEGATION=true`,
        `exec ${CLI_INVOCATION.map(posixQuote).join(" ")} "$@"`,
        ``,
      ].join("\n"),
    );
    chmodSync(shimPath, 0o755);

    // Source the actual generated wrapper (no bun spawn to regenerate it).
    wrapperFile = path.join(tempDir, "pacwich.bash");
    writeFileSync(wrapperFile, getCompletionScript("bash"));
  });

  afterAll(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  /**
   * Drive the wrapper's completion function for a command line (words, last =
   * the word under the cursor) and return the raw `COMPREPLY` entries. Entries
   * are wrapped in `<…>` on the wire so trailing spaces survive parsing.
   */
  const bashComplete = (words: string[], cwd: string): string[] => {
    const script = [
      `source ${posixQuote(wrapperFile)}`,
      `COMP_WORDS=(${words.map(posixQuote).join(" ")})`,
      `COMP_CWORD=${words.length - 1}`,
      `COMPREPLY=()`,
      `_pacwich_complete`,
      `for r in "\${COMPREPLY[@]}"; do printf '<%s>\\n' "$r"; done`,
    ].join("\n");

    const result = spawnSync("bash", ["-c", script], {
      cwd,
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${shimDir}${path.delimiter}${process.env.PATH ?? ""}`,
      },
    });

    return (result.stdout ?? "")
      .split("\n")
      .filter((line) => line.startsWith("<") && line.endsWith(">"))
      .map((line) => line.slice(1, -1));
  };

  const trimmed = (entries: string[]): string[] =>
    entries.map((entry) => entry.trimEnd());

  test("completes command names (protocol parsed and rendered)", () => {
    // No project needed; also proves the US-delimited lines parse (a broken
    // delimiter would drop the value column and yield nothing).
    const entries = trimmed(bashComplete(["pacwich", ""], tempDir));
    expect(entries).toEqual(
      expect.arrayContaining(["run-script", "doctor", "verify"]),
    );
  });

  test("prefix-filters candidates via compgen", () => {
    const entries = trimmed(bashComplete(["pacwich", "li"], tempDir));
    expect(entries).toContain("list-workspaces");
    expect(entries).not.toContain("doctor");
  });

  test("pattern prefixes get no trailing space; complete values keep it", () => {
    // `not:` is a nospace pattern prefix: it stays as-is (exact match ->
    // no trailing space was appended).
    expect(bashComplete(["pacwich", "run", "x", "no"], tempDir)).toContain(
      "not:",
    );
    // A command is a complete value: the wrapper appends a trailing space.
    expect(bashComplete(["pacwich", "do"], tempDir)).toContain("doctor ");
  });

  test("renders dynamic project candidates through the wrapper", () => {
    // The fixture's tags are defined only in an executable pacwich.project.ts;
    // completion evaluates it by default, so the tag flows all the way to
    // COMPREPLY through the real wrapper.
    const fixture = getProjectRoot("projectConfigWorkspacePatternConfigs");
    const entries = trimmed(
      bashComplete(["pacwich", "run", "x", "tag:"], fixture),
    );
    expect(entries).toContain("tag:type-a");
  });
});
