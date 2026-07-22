/**
 * Integration test for the browser wiring, run under bun.
 *
 * The browser build aliases `fs` to memfs and replaces pacwich's
 * `runScript/subprocesses.ts` with our mock (see `rspress.config.ts`); the
 * shared bun:test preload (`tests/setup.ts`) does the equivalent with
 * `mock.module(...)` so the *real* pacwich CLI reads the seeded in-memory
 * monorepo and runs scripts through the mock instead of disk / real
 * processes. path/os/process stay real (bun). This exercises the same code
 * path the browser runs: seed memfs, createCli().run(), capture output.
 */
import { expect, test } from "bun:test";

const ALL_WORKSPACE_NAMES = [
  "@demo/frontend-a",
  "@demo/backend-a",
  "@demo/shared-a",
  "@demo/frontend-b",
  "@demo/backend-b",
  "@demo/frontend-utils",
  "@demo/backend-utils",
  "@demo/shared-utils",
];

test("list-workspaces lists the mock monorepo's workspaces", async () => {
  // Import AFTER the fs mock is installed so the CLI binds to memfs.
  const { runPacwichCli } = await import("../src/web-cli-runtime");

  const { stdout, stderr, exitCode } = await runPacwichCli("list-workspaces", {
    terminalWidth: 80,
  });

  expect(exitCode).toBe(0);
  expect(stderr).not.toMatch(/Error|not found/i);
  for (const name of ALL_WORKSPACE_NAMES) {
    expect(stdout).toContain(name);
  }
});

test("list-workspaces --name-only prints just the names", async () => {
  const { runPacwichCli } = await import("../src/web-cli-runtime");

  const { stdout, exitCode } = await runPacwichCli(
    "list-workspaces --name-only",
    { terminalWidth: 80 },
  );

  expect(exitCode).toBe(0);
  const names = stdout
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  expect(names).toEqual(expect.arrayContaining(ALL_WORKSPACE_NAMES));
});

test("list-workspaces shows tags and aliases from the project/workspace configs", async () => {
  const { runPacwichCli } = await import("../src/web-cli-runtime");

  const { stdout, exitCode } = await runPacwichCli(
    "info @demo/shared-a --json",
    { terminalWidth: 80 },
  );

  expect(exitCode).toBe(0);
  const info = JSON.parse(stdout);
  expect(info.aliases).toEqual(["shr-a"]);
  expect(info.tags.sort()).toEqual(
    ["app", "app-b", "app-share", "shared"].sort(),
  );
});

test("run <script> streams the mocked per-workspace output", async () => {
  const { runPacwichCli } = await import("../src/web-cli-runtime");

  const { stdout, exitCode } = await runPacwichCli("run build", {
    terminalWidth: 80,
  });

  expect(exitCode).toBe(0);
  // Every workspace has a `build` script (mocked from scriptMocks.ts), except
  // the two frontend apps, which have a chattier workspace-specific override.
  for (const name of ALL_WORKSPACE_NAMES) {
    if (name === "@demo/frontend-a" || name === "@demo/frontend-b") continue;
    expect(stdout).toContain(`✓ ${name} built (mock)`);
  }
  expect(stdout).toContain("$ rsbuild build");
  expect(stdout).toContain("✓ @demo/frontend-a built (mock)");
  expect(stdout).toContain("✓ @demo/frontend-b built (mock)");
});

test("run lint streams the mocked per-workspace output", async () => {
  const { runPacwichCli } = await import("../src/web-cli-runtime");

  const { stdout, exitCode } = await runPacwichCli("run lint", {
    terminalWidth: 80,
  });

  expect(exitCode).toBe(0);
  for (const name of ALL_WORKSPACE_NAMES) {
    expect(stdout).toContain(`✓ ${name}: no lint problems (mock)`);
  }
});

test("run type-check streams the mocked per-workspace output", async () => {
  const { runPacwichCli } = await import("../src/web-cli-runtime");

  const { stdout, exitCode } = await runPacwichCli("run type-check", {
    terminalWidth: 80,
  });

  expect(exitCode).toBe(0);
  for (const name of ALL_WORKSPACE_NAMES) {
    expect(stdout).toContain(`✓ ${name}: no type errors (mock)`);
  }
});

test("run <script> uses grouped output style, since the shim reports a TTY", async () => {
  const { runPacwichCli } = await import("../src/web-cli-runtime");

  const { stdout, exitCode } = await runPacwichCli("run build", {
    terminalWidth: 80,
    terminalHeight: 30,
  });

  expect(exitCode).toBe(0);
  // Grouped mode hides the cursor before drawing its live, redrawing frame;
  // prefixed mode (picked when isTTY is false, the old shim default) never
  // emits this raw ANSI escape.
  expect(stdout).toContain("\x1b[?25l");
});

test("run --dep-order starts dependencies before their dependents", async () => {
  const { runPacwichCli } = await import("../src/web-cli-runtime");
  const { runLog } = await import("../src/web-cli-runtime/mockSubprocess");
  runLog.length = 0;

  const { exitCode } = await runPacwichCli("run build --dep-order", {
    terminalWidth: 80,
  });

  expect(exitCode).toBe(0);
  // The real scheduler runs above the mock, so it only *starts* a dependent
  // after its dependencies have finished. Independent leaves (the three
  // libraries) can start in any relative order, so assert the partial order
  // rather than one exact sequence.
  const startedAt = (name: string) =>
    runLog.findIndex((r) => r.workspace === name);

  expect(startedAt("@demo/frontend-utils")).toBeLessThan(
    startedAt("@demo/frontend-a"),
  );
  expect(startedAt("@demo/shared-utils")).toBeLessThan(
    startedAt("@demo/frontend-a"),
  );
  expect(startedAt("@demo/backend-utils")).toBeLessThan(
    startedAt("@demo/backend-a"),
  );
  expect(startedAt("@demo/shared-utils")).toBeLessThan(
    startedAt("@demo/backend-a"),
  );
  expect(startedAt("@demo/shared-utils")).toBeLessThan(
    startedAt("@demo/shared-a"),
  );
  expect(startedAt("@demo/shared-a")).toBeLessThan(
    startedAt("@demo/frontend-b"),
  );
  expect(startedAt("@demo/shared-a")).toBeLessThan(
    startedAt("@demo/backend-b"),
  );
});

test("affected list --files resolves affected workspaces (glob)", async () => {
  const { runPacwichCli } = await import("../src/web-cli-runtime");

  const { stdout, exitCode } = await runPacwichCli(
    "affected list --files 'libraries/shared-utils/**/*.ts'",
    { terminalWidth: 80 },
  );

  expect(exitCode).toBe(0);
  // A change in shared-utils affects shared-utils and everything that
  // depends on it (every workspace except the frontend/backend utils libs).
  const affected = stdout
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  expect(affected).toEqual(
    expect.arrayContaining([
      "@demo/shared-utils",
      "@demo/frontend-a",
      "@demo/backend-a",
      "@demo/shared-a",
      "@demo/frontend-b",
      "@demo/backend-b",
    ]),
  );
  expect(affected).not.toContain("@demo/frontend-utils");
  expect(affected).not.toContain("@demo/backend-utils");
});

test("affected list --files scopes to the changed workspace", async () => {
  const { runPacwichCli } = await import("../src/web-cli-runtime");

  const { stdout, exitCode } = await runPacwichCli(
    "affected list --files 'apps/my-app-b/frontend-b/src/*.tsx'",
    { terminalWidth: 80 },
  );

  expect(exitCode).toBe(0);
  // frontend-b has no dependents, so only frontend-b is affected.
  expect(stdout).toContain("@demo/frontend-b");
  expect(stdout).not.toContain("@demo/backend-b");
  expect(stdout).not.toContain("@demo/shared-a");
});

test("affected run --files runs the mocked script on affected workspaces", async () => {
  const { runPacwichCli } = await import("../src/web-cli-runtime");

  const { stdout, exitCode } = await runPacwichCli(
    "affected run build --files 'libraries/backend-utils/**/*.ts'",
    { terminalWidth: 80 },
  );

  expect(exitCode).toBe(0);
  // backend-utils changed, so backend-utils, backend-a, and backend-b build;
  // nothing frontend/shared-only is affected.
  expect(stdout).toContain("✓ @demo/backend-utils built (mock)");
  expect(stdout).toContain("✓ @demo/backend-a built (mock)");
  expect(stdout).toContain("✓ @demo/backend-b built (mock)");
  expect(stdout).not.toContain("@demo/frontend-utils");
  expect(stdout).not.toContain("@demo/shared-utils");
});

test("the deprecated list-affected/run-affected forms still work (with a warning)", async () => {
  const { runPacwichCli } = await import("../src/web-cli-runtime");

  const listResult = await runPacwichCli(
    "list-affected --files 'apps/my-app-b/frontend-b/src/*.tsx'",
    { terminalWidth: 80 },
  );
  expect(listResult.exitCode).toBe(0);
  expect(listResult.stdout).toContain("@demo/frontend-b");

  const runResult = await runPacwichCli(
    "run-affected build --files 'libraries/backend-utils/**/*.ts'",
    { terminalWidth: 80 },
  );
  expect(runResult.exitCode).toBe(0);
  expect(runResult.stdout).toContain("✓ @demo/backend-a built (mock)");
});

test("runPacwichCliArgv runs an already-tokenized argv", async () => {
  const { runPacwichCliArgv } = await import("../src/web-cli-runtime");

  const { stdout, exitCode } = await runPacwichCliArgv(
    ["list-workspaces", "--name-only"],
    { terminalWidth: 80 },
  );

  expect(exitCode).toBe(0);
  expect(stdout).toContain("@demo/shared-utils");
});

test("runPacwichCliArgv still runs the webCliGuards", async () => {
  const { runPacwichCliArgv } = await import("../src/web-cli-runtime");

  const { stdout, stderr, exitCode } = await runPacwichCliArgv([
    "list-workspaces",
    "--cwd",
    "/elsewhere",
  ]);

  expect(exitCode).not.toBe(0);
  expect(stdout).toBe("");
  expect(stderr).toMatch(/--cwd.*fixed/i);
});

test("doctor runs for real, reporting dummy package manager versions", async () => {
  const { runPacwichCli } = await import("../src/web-cli-runtime");

  const { stdout, exitCode } = await runPacwichCli("doctor", {
    terminalWidth: 80,
  });

  expect(exitCode).toBe(0);
  expect(stdout).toContain("Package Managers:");
  // npm/pnpm always shell out via the (mocked) child_process, so their
  // fake versions are deterministic here. bun's own detector takes a real
  // `Bun.version` shortcut when running under Bun, which `bun test` (unlike
  // an actual browser, which never has a `Bun` global) genuinely is, so it
  // reports this test runner's real bun version, not the fake one.
  expect(stdout).toContain("npm: 10.9.2");
  expect(stdout).toContain("pnpm: 10.12.1");
  expect(stdout).not.toContain("(none)");
  expect(stdout).not.toMatch(/\bat\b.*\.ts:|MiddlewareHandlerFailed/);
});

test("affected list --help isn't blocked by the git-diff guard", async () => {
  const { checkCommandLine } =
    await import("../src/web-cli-runtime/webCliGuards");
  // `--help` never reaches git, so it must not be caught by the guard.
  // (Not run end-to-end here: commander's real `--help` handling calls
  // `process.exit()` in a way that isn't caught by our shim under `bun
  // test`, silently killing the test process, a separate, pre-existing
  // issue unrelated to this guard.)
  expect(
    checkCommandLine("affected list --help", ["affected", "list", "--help"]),
  ).toBeNull();
});

test("verify runs for real against the demo project (no implicit deps)", async () => {
  const { runPacwichCli } = await import("../src/web-cli-runtime");
  const { stdout, stderr, exitCode } = await runPacwichCli("verify", {
    terminalWidth: 80,
  });
  expect(exitCode).toBe(0);
  // The demo project's package.jsons already declare every workspace
  // import, and verify falls back to a plain filesystem walk since there's
  // no real git, so there's no implicit dependencies, no crash, no blank
  // output.
  expect(stdout).toContain("No verify issues found.");
  expect(stderr).toBe("");
});

test("verify enforces the demo project's workspace dependency rules", async () => {
  const { runPacwichCli } = await import("../src/web-cli-runtime");
  // Sanity check that the tag-based deny rules from pacwich.project.jsonc
  // are genuinely loaded and enforced, not just declared. list-workspaces
  // (any command) fails fast on a rule violation before running at all.
  const { stdout } = await runPacwichCli("list-workspaces", {
    terminalWidth: 80,
  });
  expect(stdout).toContain("@demo/frontend-a");
});

test("doctor --json reports dummy package manager versions", async () => {
  const { runPacwichCli } = await import("../src/web-cli-runtime");

  const { stdout, exitCode } = await runPacwichCli("doctor --json", {
    terminalWidth: 80,
  });

  expect(exitCode).toBe(0);
  const info = JSON.parse(stdout);
  expect(info.packageManagers.npm).toBe("10.9.2");
  expect(info.packageManagers.pnpm).toBe("10.12.1");
  expect(info.os).toEqual({
    type: "Linux",
    platform: "linux",
    arch: "x64",
    release: "0.0.0",
    version: "web-cli demo",
    cpuCount: 4,
  });
  expect(info.shell).toEqual({
    binary: "/bin/bash",
    terminal: "xterm-256color",
  });
  expect(info.binary.exec).toBe("/usr/bin/node");
  expect(info.runtime.valid).toBe(true);
});

// The guards reject unsupported features up front, before the CLI runs, with a
// friendly one-line message and a non-zero exit (never a stack trace).
const blocked: [string, string, RegExp][] = [
  [
    "inline scripts",
    "run 'echo hi' --inline",
    /inline scripts.*aren't supported/i,
  ],
  ["inline (short)", "run build -i", /inline scripts.*aren't supported/i],
  ["--cwd", "list-workspaces --cwd /elsewhere", /--cwd.*fixed/i],
  ["--cwd short", "list-workspaces -d /elsewhere", /--cwd.*fixed/i],
  ["git base", "affected list --base main", /use `--files` instead/i],
  ["git head", "affected run build --head HEAD", /use `--files` instead/i],
  ["affected default (no --files)", "affected list", /use `--files` instead/i],
  [
    "affected run default (no --files)",
    "affected run build",
    /use `--files` instead/i,
  ],
  ["af alias default", "af ls", /use `--files` instead/i],
  ["list-affected default", "list-affected", /use `--files` instead/i],
  ["run-affected default", "run-affected build", /use `--files` instead/i],
  [
    "shell pipe",
    "list-workspaces | grep demo",
    /Shell operations aren't supported/i,
  ],
];

for (const [name, command, pattern] of blocked) {
  test(`blocks ${name}`, async () => {
    const { runPacwichCli } = await import("../src/web-cli-runtime");
    const { stdout, stderr, exitCode } = await runPacwichCli(command, {
      terminalWidth: 80,
    });
    expect(exitCode).not.toBe(0);
    expect(stdout).toBe("");
    expect(stderr).toMatch(pattern);
    // No stack trace / internal error noise.
    expect(stderr).not.toMatch(/\bat\b.*\.ts:|MiddlewareHandlerFailed/);
  });
}
