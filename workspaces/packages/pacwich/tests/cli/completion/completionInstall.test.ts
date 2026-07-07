import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { getCompletionScript } from "@pacwich/common/cli";
import {
  bashLoginShellHint,
  completionInfoText,
  detectShell,
  formatInstallReport,
  installCompletion,
  type ProcessInfo,
} from "../../../src/cli/commands/completionInstall";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
} from "../../util/testFramework";

/**
 * Unit coverage for `pacwich completion install`: shell detection (via an
 * injected process walk + $SHELL fallback), the idempotent rc/file writes
 * (into a temp HOME), and the user-facing text.
 */

describe("detectShell", () => {
  /** A fake process tree keyed by pid. */
  const treeReader =
    (tree: Record<number, ProcessInfo>) =>
    (pid: number): ProcessInfo | null =>
      tree[pid] ?? null;

  test("walks parent processes past node/bun to the shell", () => {
    const tree: Record<number, ProcessInfo> = {
      100: { ppid: 90, name: "node" },
      90: { ppid: 80, name: "bun" },
      80: { ppid: 1, name: "zsh" },
    };
    expect(
      detectShell({ startPid: 100, readProcess: treeReader(tree), env: {} }),
    ).toBe("zsh");
  });

  test("normalizes a login shell name and a path", () => {
    expect(
      detectShell({
        startPid: 5,
        readProcess: treeReader({ 5: { ppid: 1, name: "-bash" } }),
        env: {},
      }),
    ).toBe("bash");
    expect(
      detectShell({
        startPid: 5,
        readProcess: treeReader({ 5: { ppid: 1, name: "/usr/bin/fish" } }),
        env: {},
      }),
    ).toBe("fish");
  });

  test("falls back to $SHELL when the walk finds no shell", () => {
    expect(
      detectShell({
        startPid: 5,
        readProcess: () => null,
        env: { SHELL: "/usr/local/bin/fish" },
      }),
    ).toBe("fish");
  });

  test("returns null for an unsupported shell and no fallback", () => {
    expect(
      detectShell({
        startPid: 5,
        readProcess: treeReader({ 5: { ppid: 1, name: "dash" } }),
        env: { SHELL: "/bin/dash" },
      }),
    ).toBeNull();
    expect(
      detectShell({ startPid: 5, readProcess: () => null, env: {} }),
    ).toBeNull();
  });
});

describe("installCompletion", () => {
  let home: string;
  let env: NodeJS.ProcessEnv;

  beforeEach(() => {
    home = mkdtempSync(path.join(tmpdir(), "pacwich-install-"));
    env = { HOME: home };
  });
  afterEach(() => {
    rmSync(home, { recursive: true, force: true });
  });

  test("bash: appends a marker-wrapped eval to ~/.bashrc", () => {
    const result = installCompletion({ shell: "bash", env });
    expect(result.filePath).toBe(path.join(home, ".bashrc"));
    expect(result.outcome).toBe("created");
    const rc = readFileSync(result.filePath, "utf8");
    expect(rc).toContain("# >>> pacwich completion >>>");
    expect(rc).toContain(`eval "$(pacwich completion bash)"`);
    expect(rc).toContain("# <<< pacwich completion <<<");
  });

  test("zsh: writes to $ZDOTDIR when set, with a compinit guard", () => {
    const zdotdir = path.join(home, "zdot");
    const result = installCompletion({
      shell: "zsh",
      env: { HOME: home, ZDOTDIR: zdotdir },
    });
    expect(result.filePath).toBe(path.join(zdotdir, ".zshrc"));
    const rc = readFileSync(result.filePath, "utf8");
    expect(rc).toContain("compinit");
    expect(rc).toContain(`eval "$(pacwich completion zsh)"`);
  });

  test("fish: writes the completion script to the autoload dir (no config edit)", () => {
    const result = installCompletion({ shell: "fish", env });
    expect(result.filePath).toBe(
      path.join(home, ".config", "fish", "completions", "pacwich.fish"),
    );
    expect(readFileSync(result.filePath, "utf8").trim()).toBe(
      getCompletionScript("fish").trim(),
    );
  });

  test("is idempotent: re-running leaves a single block and reports unchanged", () => {
    installCompletion({ shell: "bash", env });
    const second = installCompletion({ shell: "bash", env });
    expect(second.outcome).toBe("unchanged");
    const rc = readFileSync(path.join(home, ".bashrc"), "utf8");
    expect(rc.match(/# >>> pacwich completion >>>/g)).toHaveLength(1);
  });

  test("preserves existing rc content when appending", () => {
    const bashrc = path.join(home, ".bashrc");
    writeFileSync(bashrc, "export FOO=1\n");
    const result = installCompletion({ shell: "bash", env });
    expect(result.outcome).toBe("updated");
    const rc = readFileSync(bashrc, "utf8");
    expect(rc).toContain("export FOO=1");
    expect(rc).toContain(`eval "$(pacwich completion bash)"`);
  });
});

describe("bashLoginShellHint", () => {
  let home: string;
  let env: NodeJS.ProcessEnv;

  beforeEach(() => {
    home = mkdtempSync(path.join(tmpdir(), "pacwich-hint-"));
    env = { HOME: home };
  });
  afterEach(() => {
    rmSync(home, { recursive: true, force: true });
  });

  test("null off macOS (the majority never see it)", () => {
    expect(bashLoginShellHint({ isMacOS: false, env })).toBeNull();
  });

  test("warns on macOS when no login profile sources ~/.bashrc", () => {
    // No profiles exist -> a login shell sources nothing.
    const hint = bashLoginShellHint({ isMacOS: true, env });
    expect(hint).toContain("~/.bash_profile");
    expect(hint).toContain(". ~/.bashrc");
  });

  test("silent on macOS when a login profile already sources ~/.bashrc", () => {
    writeFileSync(
      path.join(home, ".bash_profile"),
      "[ -f ~/.bashrc ] && . ~/.bashrc\n",
    );
    expect(bashLoginShellHint({ isMacOS: true, env })).toBeNull();
  });

  test("warns on macOS when the login profile exists but omits ~/.bashrc", () => {
    writeFileSync(path.join(home, ".bash_profile"), "export PATH=$PATH:/x\n");
    expect(bashLoginShellHint({ isMacOS: true, env })).not.toBeNull();
  });
});

describe("completion text", () => {
  test("info lists the install command and each shell's manual line", () => {
    const info = completionInfoText();
    expect(info).toContain("pacwich completion install");
    expect(info).toContain(`eval "$(pacwich completion bash)"`);
    expect(info).toContain(`eval "$(pacwich completion zsh)"`);
    expect(info).toContain("~/.config/fish/completions/pacwich.fish");
  });

  test("report echoes the file and the exact block added", () => {
    const report = formatInstallReport({
      shell: "zsh",
      filePath: "/home/me/.zshrc",
      outcome: "created",
      snippet: "# >>> pacwich completion >>>\nX\n# <<< pacwich completion <<<",
    });
    expect(report).toContain("/home/me/.zshrc");
    expect(report).toContain("# >>> pacwich completion >>>");
    expect(report).toContain("source ~/.zshrc");
  });
});
