/**
 * Canned output for `run <script>`, keyed by "<workspace>:<script>".
 * Falls back most specific first: exact, "*:<script>", "<workspace>:*", "*:*".
 * `{workspace}`/`{script}` are substituted into output lines.
 */

export type ScriptMock = {
  /** Lines printed to stdout, in order (no trailing newline needed). */
  output: string[];
  /** Delay in ms before each line, to simulate work. Default 0 (instant). */
  delayMsPerLine?: number;
  /** Exit code the mocked run reports. Default 0. */
  exitCode?: number;
};

export const SCRIPT_MOCKS: Record<string, ScriptMock> = {
  "*:build": {
    output: [
      "$ building {workspace}…",
      "✓ {workspace} built (mock)",
    ],
    delayMsPerLine: 120,
  },
  "*:lint": {
    output: [
      "$ linting {workspace}…",
      "✓ {workspace}: no lint problems (mock)",
    ],
    delayMsPerLine: 80,
  },
  "*:type-check": {
    output: [
      "$ type-checking {workspace}…",
      "✓ {workspace}: no type errors (mock)",
    ],
    delayMsPerLine: 100,
  },

  "@demo/frontend-a:build": {
    output: [
      "$ rsbuild build",
      "  building client bundle…",
      "  ✓ 42 modules transformed",
      "✓ @demo/frontend-a built (mock)",
    ],
    delayMsPerLine: 120,
  },
  "@demo/frontend-b:build": {
    output: [
      "$ rsbuild build",
      "  building client bundle…",
      "  ✓ 40 modules transformed",
      "✓ @demo/frontend-b built (mock)",
    ],
    delayMsPerLine: 120,
  },

  "*:*": {
    output: [
      "$ {script} ({workspace})",
      "✓ {workspace}: {script} done (mock)",
    ],
  },
};
