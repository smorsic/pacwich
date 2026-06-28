/**
 * Integration test for the browser wiring, run under bun.
 *
 * The browser build aliases `fs` to memfs; here we do the equivalent with
 * `mock.module("fs", ...)` so the *real* pacwich CLI reads the seeded
 * in-memory monorepo instead of disk. path/os/process stay real (bun), which
 * is fine — only filesystem access needs to be virtual. This exercises the
 * same code path the browser runs: seed memfs → createCli().run() → capture
 * output.
 */
import { beforeAll, expect, mock, test } from "bun:test";
import { fs as memfsFs, vol } from "memfs";

beforeAll(() => {
  vol.reset();
  // Redirect every `import ... from "fs"` (incl. the bundled CLI) to memfs,
  // bound to the same default volume our seeder writes to.
  mock.module("fs", () => ({ ...memfsFs, default: memfsFs }));
  mock.module("node:fs", () => ({ ...memfsFs, default: memfsFs }));
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
