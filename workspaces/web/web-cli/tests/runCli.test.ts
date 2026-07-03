/**
 * Integration test for the browser wiring, run under bun.
 *
 * The browser build aliases `fs` to memfs and replaces pacwich's
 * `runScript/subprocesses.ts` with our mock (see `src/bundler`); here we do the
 * equivalent with `mock.module(...)` so the *real* pacwich CLI reads the seeded
 * in-memory monorepo and runs scripts through the mock instead of disk / real
 * processes. path/os/process stay real (bun). This exercises the same code path
 * the browser runs: seed memfs → createCli().run() → capture output.
 */
import { beforeAll, expect, mock, test } from "bun:test";
import { realpathSync } from "node:fs";
import { fs as memfsFs, vol } from "memfs";

// Resolve pacwich's internal subprocess module by realpath *before* fs is
// mocked, so `mock.module` targets the same module the bundled CLI imports.
// pacwich may be installed as raw TS (`workspace:*`) or transpiled JS (a
// published release), so try both extensions.
const resolveSubprocessPath = (): string => {
  for (const ext of ["ts", "js"] as const) {
    try {
      return realpathSync(
        new URL(
          `../node_modules/pacwich/src/runScript/subprocesses.${ext}`,
          import.meta.url,
        ),
      );
    } catch {
      // try the next extension
    }
  }
  throw new Error("Could not resolve pacwich's runScript/subprocesses module");
};

const SUBPROCESS_PATH = resolveSubprocessPath();

beforeAll(async () => {
  vol.reset();
  // Redirect every `import ... from "fs"` (incl. the bundled CLI) to memfs,
  // bound to the same default volume our seeder writes to.
  mock.module("fs", () => ({ ...memfsFs, default: memfsFs }));
  mock.module("node:fs", () => ({ ...memfsFs, default: memfsFs }));
  // Replace the single spawn chokepoint with the browser mock (mirrors the
  // NormalModuleReplacementPlugin in src/bundler).
  const mockSubprocess = await import("../src/engine/mockSubprocess");
  mock.module(SUBPROCESS_PATH, () => mockSubprocess);
});

const WORKSPACES = ["shared", "backend", "frontend"] as const;

test("list-workspaces lists the mock monorepo's workspaces", async () => {
  const { runPacwichCli } = await import("../src/engine");

  const { stdout, stderr, exitCode } = await runPacwichCli("list-workspaces", {
    terminalWidth: 80,
  });

  expect(exitCode).toBe(0);
  expect(stderr).not.toMatch(/Error|not found/i);
  for (const name of WORKSPACES) expect(stdout).toContain(name);
});

test("info resolves a workspace by its JSONC-configured alias", async () => {
  const { runPacwichCli } = await import("../src/engine");

  // `fe` is only known if packages/frontend/pacwich.workspace.jsonc loaded.
  const { stdout, exitCode } = await runPacwichCli("info fe", {
    terminalWidth: 80,
  });

  expect(exitCode).toBe(0);
  expect(stdout).toContain("frontend");
  expect(stdout).toContain("application"); // its configured tag
});

test("run <script> streams the mocked per-workspace output", async () => {
  const { runPacwichCli } = await import("../src/engine");

  const { stdout, exitCode } = await runPacwichCli("run build", {
    terminalWidth: 80,
  });

  expect(exitCode).toBe(0);
  for (const name of WORKSPACES) {
    expect(stdout).toContain(`✓ ${name} built (mock)`);
  }
  // The frontend:build override is a chattier, workspace-specific mock.
  expect(stdout).toContain("128 modules transformed");
});

test("run --dep-order starts dependencies before dependents", async () => {
  const { runPacwichCli } = await import("../src/engine");
  const { runLog } = await import("../src/engine/mockSubprocess");
  runLog.length = 0;

  const { exitCode } = await runPacwichCli("run build --dep-order", {
    terminalWidth: 80,
  });

  expect(exitCode).toBe(0);
  const started = runLog.map((r) => r.workspace);
  // Both backend and frontend depend on shared, so shared must start first.
  expect(started[0]).toBe("shared");
  expect(new Set(started)).toEqual(new Set(WORKSPACES));
});

test("run type-check runs on every workspace that has the script", async () => {
  const { runPacwichCli } = await import("../src/engine");

  const { stdout, exitCode } = await runPacwichCli("run type-check", {
    terminalWidth: 80,
  });

  expect(exitCode).toBe(0);
  for (const name of WORKSPACES) {
    expect(stdout).toContain(`✓ ${name}: type check passed (mock)`);
  }
});

test("list-affected --files resolves affected workspaces (glob)", async () => {
  const { runPacwichCli } = await import("../src/engine");

  const { stdout, exitCode } = await runPacwichCli(
    "list-affected --files 'packages/shared/**/*.ts'",
    { terminalWidth: 80 },
  );

  expect(exitCode).toBe(0);
  // A change in shared affects shared and everything that depends on it.
  for (const name of WORKSPACES) expect(stdout).toContain(name);
});

test("list-affected --files scopes to a workspace with no dependents", async () => {
  const { runPacwichCli } = await import("../src/engine");

  const { stdout, exitCode } = await runPacwichCli(
    "list-affected --files packages/frontend/src/App.tsx",
    { terminalWidth: 80 },
  );

  expect(exitCode).toBe(0);
  expect(stdout).toContain("frontend");
  expect(stdout).not.toContain("shared");
  expect(stdout).not.toContain("backend");
});

test("run-affected --files runs the mocked script on affected workspaces", async () => {
  const { runPacwichCli } = await import("../src/engine");

  const { stdout, exitCode } = await runPacwichCli(
    "run-affected build --files 'packages/shared/**/*.ts'",
    { terminalWidth: 80 },
  );

  expect(exitCode).toBe(0);
  for (const name of WORKSPACES) {
    expect(stdout).toContain(`✓ ${name} built (mock)`);
  }
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
    "list-workspaces | grep frontend",
    /Shell operations aren't supported/i,
  ],
];

for (const [name, command, pattern] of blocked) {
  test(`blocks ${name}`, async () => {
    const { runPacwichCli } = await import("../src/engine");
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
