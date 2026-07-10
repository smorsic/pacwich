/**
 * Integration test for the browser wiring, run under bun.
 *
 * The browser build aliases `fs` to memfs and replaces pacwich's
 * `runScript/subprocesses.ts` with our mock (see `rspress.config.ts`); here we
 * do the equivalent with `mock.module(...)` so the *real* pacwich CLI reads the
 * seeded in-memory monorepo and runs scripts through the mock instead of disk /
 * real processes. path/os/process stay real (bun). This exercises the same code
 * path the browser runs: seed memfs → createCli().run() → capture output.
 */
import { realpathSync } from "node:fs";
import { beforeAll, expect, mock, test } from "bun:test";
import { fs as memfsFs, vol } from "memfs";

// Resolve pacwich's internal subprocess module by realpath *before* fs is
// mocked, so `mock.module` targets the same module the bundled CLI imports.
const SUBPROCESS_PATH = realpathSync(
  new URL(
    "../node_modules/pacwich/src/runScript/subprocesses.ts",
    import.meta.url,
  ),
);

beforeAll(async () => {
  vol.reset();
  // Redirect every `import ... from "fs"` (incl. the bundled CLI) to memfs,
  // bound to the same default volume our seeder writes to.
  mock.module("fs", () => ({ ...memfsFs, default: memfsFs }));
  mock.module("node:fs", () => ({ ...memfsFs, default: memfsFs }));
  // Replace the single spawn chokepoint with the browser mock (mirrors the
  // NormalModuleReplacementPlugin in rspress.config.ts).
  const mockSubprocess = await import("../src/cli/mockSubprocess");
  mock.module(SUBPROCESS_PATH, () => mockSubprocess);
});

test("list-workspaces lists the mock monorepo's workspaces", async () => {
  // Import AFTER the fs mock is installed so the CLI binds to memfs.
  const { runPacwichCli } = await import("../src/cli/runPacwichCli");

  const { stdout, stderr, exitCode } = await runPacwichCli("list-workspaces", {
    terminalWidth: 80,
  });

  expect(exitCode).toBe(0);
  expect(stderr).not.toMatch(/Error|not found/i);
  for (const name of ["@demo/utils", "@demo/core", "@demo/web"]) {
    expect(stdout).toContain(name);
  }
});

test("list-workspaces --name-only prints just the names", async () => {
  const { runPacwichCli } = await import("../src/cli/runPacwichCli");

  const { stdout, exitCode } = await runPacwichCli(
    "list-workspaces --name-only",
    { terminalWidth: 80 },
  );

  expect(exitCode).toBe(0);
  const names = stdout
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  expect(names).toEqual(
    expect.arrayContaining(["@demo/utils", "@demo/core", "@demo/web"]),
  );
});

test("run <script> streams the mocked per-workspace output", async () => {
  const { runPacwichCli } = await import("../src/cli/runPacwichCli");

  const { stdout, exitCode } = await runPacwichCli("run build", {
    terminalWidth: 80,
  });

  expect(exitCode).toBe(0);
  // Every workspace that has a `build` script should report a mocked result
  // (from the `*:build` entry in demo-project/scriptMocks.ts).
  for (const name of ["@demo/utils", "@demo/core", "@demo/web"]) {
    expect(stdout).toContain(`✓ ${name} built (mock)`);
  }
  // The @demo/web:build override is a chattier, workspace-specific mock.
  expect(stdout).toContain("$ rsbuild build");
  expect(stdout).toContain("42 modules transformed");
});

test("run --dep-order starts workspaces in dependency order", async () => {
  const { runPacwichCli } = await import("../src/cli/runPacwichCli");
  const { runLog } = await import("../src/cli/mockSubprocess");
  runLog.length = 0;

  const { exitCode } = await runPacwichCli("run build --dep-order", {
    terminalWidth: 80,
  });

  expect(exitCode).toBe(0);
  // The real scheduler runs above the mock, so it only *starts* a dependent
  // after its dependencies have finished. utils → core → web.
  const started = runLog.map((r) => r.workspace);
  expect(started).toEqual(["@demo/utils", "@demo/core", "@demo/web"]);
});

test("run test only runs where the script exists", async () => {
  const { runPacwichCli } = await import("../src/cli/runPacwichCli");

  const { stdout, exitCode } = await runPacwichCli("run test", {
    terminalWidth: 80,
  });

  expect(exitCode).toBe(0);
  // Only @demo/utils defines a `test` script.
  expect(stdout).toContain("✓ @demo/utils: 3 passed, 0 failed (mock)");
  expect(stdout).not.toContain("@demo/core: test");
});

test("list-affected --files resolves affected workspaces (glob)", async () => {
  const { runPacwichCli } = await import("../src/cli/runPacwichCli");

  const { stdout, exitCode } = await runPacwichCli(
    "list-affected --files 'packages/utils/**/*.ts'",
    { terminalWidth: 80 },
  );

  expect(exitCode).toBe(0);
  // A change in utils affects utils and everything that depends on it.
  const affected = stdout
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  expect(affected).toEqual(
    expect.arrayContaining(["@demo/utils", "@demo/core", "@demo/web"]),
  );
});

test("list-affected --files scopes to the changed workspace", async () => {
  const { runPacwichCli } = await import("../src/cli/runPacwichCli");

  const { stdout, exitCode } = await runPacwichCli(
    "list-affected --files apps/web/src/index.ts",
    { terminalWidth: 80 },
  );

  expect(exitCode).toBe(0);
  // web has no dependents, so only web is affected.
  expect(stdout).toContain("@demo/web");
  expect(stdout).not.toContain("@demo/utils");
  expect(stdout).not.toContain("@demo/core");
});

test("run-affected --files runs the mocked script on affected workspaces", async () => {
  const { runPacwichCli } = await import("../src/cli/runPacwichCli");

  const { stdout, exitCode } = await runPacwichCli(
    "run-affected build --files 'packages/core/**/*.ts'",
    { terminalWidth: 80 },
  );

  expect(exitCode).toBe(0);
  // core changed → core + web (its dependent) build; utils is not affected.
  expect(stdout).toContain("✓ @demo/core built (mock)");
  expect(stdout).toContain("✓ @demo/web built (mock)");
  expect(stdout).not.toContain("✓ @demo/utils built (mock)");
});

test("runPacwichCliArgv runs an already-tokenized argv", async () => {
  const { runPacwichCliArgv } = await import("../src/cli/runPacwichCli");

  const { stdout, exitCode } = await runPacwichCliArgv(
    ["list-workspaces", "--name-only"],
    { terminalWidth: 80 },
  );

  expect(exitCode).toBe(0);
  expect(stdout).toContain("@demo/utils");
});

test("runPacwichCliArgv still runs the webCliGuards", async () => {
  const { runPacwichCliArgv } = await import("../src/cli/runPacwichCli");

  const { stdout, stderr, exitCode } = await runPacwichCliArgv(["doctor"]);

  expect(exitCode).not.toBe(0);
  expect(stdout).toBe("");
  expect(stderr).toMatch(/doctor.*isn't available/i);
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
  ["doctor", "doctor", /doctor.*isn't available/i],
  ["--cwd", "list-workspaces --cwd /elsewhere", /--cwd.*fixed/i],
  ["--cwd short", "list-workspaces -d /elsewhere", /--cwd.*fixed/i],
  ["git base", "list-affected --base main", /use `--files` instead/i],
  ["git head", "run-affected build --head HEAD", /use `--files` instead/i],
  [
    "shell pipe",
    "list-workspaces | grep demo",
    /Shell operations aren't supported/i,
  ],
];

for (const [name, command, pattern] of blocked) {
  test(`blocks ${name}`, async () => {
    const { runPacwichCli } = await import("../src/cli/runPacwichCli");
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
