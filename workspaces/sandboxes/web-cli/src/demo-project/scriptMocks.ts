/**
 * How the web-cli sandbox mocks script runs.
 *
 * There's no shell in the browser, so `run <script>` can't actually execute
 * anything. Instead, each `workspace:script` pair maps to some canned output.
 * The real pacwich scheduler still runs above this (dependency order,
 * parallelism, per-workspace orchestration) — only the process is faked.
 *
 * Edit freely: add/remove entries, tweak the printed lines, add a per-line
 * delay to simulate work, or a non-zero exit to simulate a failure.
 */

export type ScriptMock = {
  /** Lines printed to stdout, in order (no trailing newline needed). */
  output: string[];
  /** Delay in ms before *each* line, to simulate work. Default 0 (instant). */
  delayMsPerLine?: number;
  /** Exit code the mocked run reports. Default 0. */
  exitCode?: number;
};

/**
 * Keyed by `"<workspace>:<script>"`. Lookups fall back, most specific first:
 *
 *   1. `"<workspace>:<script>"`  — exact
 *   2. `"*:<script>"`            — any workspace, this script
 *   3. `"<workspace>:*"`         — this workspace, any script
 *   4. `"*:*"`                   — the global default
 *
 * `{workspace}` and `{script}` are substituted into output lines.
 */
export const SCRIPT_MOCKS: Record<string, ScriptMock> = {
  // Per-script defaults (any workspace).
  "*:build": {
    output: ["$ building {workspace}…", "✓ {workspace} built (mock)"],
    delayMsPerLine: 120,
  },
  "*:lint": {
    output: [
      "$ linting {workspace}…",
      "✓ {workspace}: no lint problems (mock)",
    ],
    delayMsPerLine: 80,
  },
  "*:test": {
    output: [
      "$ testing {workspace}…",
      "✓ {workspace}: 3 passed, 0 failed (mock)",
    ],
    delayMsPerLine: 150,
  },
  "*:dev": {
    output: ["{workspace}: dev server isn't runnable in the sandbox (mock)"],
  },

  // Example workspace-specific override: give the web app a chattier build.
  "@demo/web:build": {
    output: [
      "$ rsbuild build",
      "  building client bundle…",
      "  ✓ 42 modules transformed",
      "✓ @demo/web built (mock)",
    ],
    delayMsPerLine: 120,
  },

  // Global fallback for any script not matched above.
  "*:*": {
    output: ["$ {script} ({workspace})", "✓ {workspace}: {script} done (mock)"],
  },
};
