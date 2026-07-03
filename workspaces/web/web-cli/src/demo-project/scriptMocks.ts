/**
 * How the web CLI mocks script runs.
 *
 * There's no shell in the browser, so `run <script>` can't actually execute
 * anything. Instead, each `workspace:script` pair maps to some canned output.
 * The real pacwich scheduler still runs above this (dependency order,
 * parallelism, per-workspace orchestration) — only the leaf process is faked.
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
    output: ["$ example-build-command", "✓ {workspace} built (mock)"],
    delayMsPerLine: 120,
  },
  "*:type-check": {
    output: ["$ tsc --noEmit", "✓ {workspace}: type check passed (mock)"],
    delayMsPerLine: 100,
  },

  // A chattier, workspace-specific override for the frontend build.
  "frontend:build": {
    output: [
      "$ example-build-command",
      "  bundling client…",
      "  ✓ 128 modules transformed",
      "✓ frontend built (mock)",
    ],
    delayMsPerLine: 120,
  },

  // The root `build-all` script (referenced via `@root`).
  "*:build-all": {
    output: [
      "$ pacwich run build --dep-order",
      "✓ built shared, backend, frontend (mock)",
    ],
    delayMsPerLine: 120,
  },

  // Global fallback for any script not matched above.
  "*:*": {
    output: ["$ {script} ({workspace})", "✓ {workspace}: {script} done (mock)"],
  },
};
