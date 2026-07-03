# sandbox: web-cli

An experiment: run the **real pacwich CLI** in the browser, on top of an
in-memory filesystem ([memfs](https://github.com/streamich/memfs)).

Unlike the (previous, backend-driven) web CLI that lived in the
documentation website, nothing here talks to a server. The CLI is bundled
for the browser and its `fs` access is redirected to a memfs volume that we
seed with a small mock monorepo. That keeps everything in this repo and lets
us mock whatever behavior we want directly.

## The demo project

The mock monorepo the CLI operates on lives as **static files** under
`src/demo-project/`:

```
src/demo-project/
  package.json              root (defines the workspaces)
  package-lock.json         the npm adapter discovers workspaces from here
  packages/utils/package.json
  packages/core/package.json
  apps/web/package.json
  scriptMocks.ts            how `run <script>` output is faked (see below)
```

Edit those `package.json`s / the lockfile to change what the CLI sees.
`src/cli/demoProject.ts` imports them and seeds them into memfs (JSON imports
work under both rsbuild and bun). A couple of placeholder source files are
seeded per workspace so `--files` globs have something to match.

## How it works

- `src/cli/demoProject.ts` seeds the memfs volume from the static
  `src/demo-project/` files (above).
- `rsbuild.config.ts` aliases `fs` (and `node:fs`) to a thin shim over that
  shared memfs volume, and uses `@rsbuild/plugin-node-polyfill` for the rest
  of the Node built-ins (`path`, `os`, `process`, ...).
- `src/cli/runPacwichCli.ts` calls `createCli({ defaultCwd }).run(...)` with
  the `writeOutput` hook, capturing stdout/stderr so the terminal can render
  it.
- `src/components/WebCliTerminal.tsx` is an [xterm](https://xtermjs.org/)
  screen plus a prompt input.

### Running scripts (mocked)

The browser has no processes, so pacwich can't actually spawn anything. pacwich
funnels _every_ spawn — package.json scripts, inline scripts, and `git` — through
a single `createSubprocess()` in its `runScript/subprocesses.ts`. We replace only
that one module (`src/cli/mockSubprocess.ts`, wired via a
`NormalModuleReplacementPlugin` in `rsbuild.config.ts`).

Because only the leaf spawn is faked, the **real** `runScripts` scheduler still
runs above it — so `--dep-order`, parallelism, and per-workspace orchestration
are genuinely exercised. The mock reads the command pacwich wrote to a temp
shell script (in memfs), maps it back to a workspace + script, and streams the
canned output for that pair.

The canned output is configured in `src/demo-project/scriptMocks.ts` — a simple
map of `"<workspace>:<script>"` to output lines, with optional per-line delay
and exit code:

```ts
export const SCRIPT_MOCKS: Record<string, ScriptMock> = {
  "*:build": {
    output: ["$ building {workspace}…", "✓ {workspace} built (mock)"],
    delayMsPerLine: 120,
  },
  "@demo/web:build": {
    output: ["$ rsbuild build" /* … */],
    delayMsPerLine: 120,
  },
};
```

Lookups fall back most-specific-first (`ws:script` → `*:script` → `ws:*` →
`*:*`), and `{workspace}` / `{script}` are substituted into the lines. Add a
`delayMsPerLine` to simulate work, or an `exitCode` to simulate a failure.

### What's gated

`src/cli/webCliGuards.ts` rejects features the browser can't support, up front,
with a friendly one-line message instead of a stack trace:

- **inline scripts** (`--inline`/`-i`) — no shell to run them
- **`doctor`** — inspects the host environment
- **`--cwd`/`-d`** — the working directory is fixed to the mock project
- **git-diff affected** (`--base`/`--head`) — no git; use `--files` instead
- **shell operators** (pipes, redirects, subshells, background) — the prompt
  only passes arguments to `pacwich`

## Run it

```bash
bun web-cli dev      # from the repo root (runs this workspace's dev script)
# or, from this directory:
bun run dev
```

The scripts invoke rsbuild via `bunx` so they work regardless of how bun hoists
`@rsbuild/core` in the workspace install.

Then try some commands in the terminal:

```
list-workspaces
list-scripts
run build
run build --dep-order
list-affected --files 'packages/**/*.ts'
run-affected build --files 'packages/core/**/*.ts'
--help
```

## Tests

`tests/runCli.test.ts` runs under bun and exercises the same path the browser
does: it mocks `fs` to memfs and replaces `runScript/subprocesses.ts` with the
same mock (via `mock.module`), then drives `runPacwichCli` and asserts on the
captured output — read-only commands, mocked script runs (incl. `--dep-order`
ordering), `--files` affected resolution, and the guarded/blocked commands.

```bash
bun test        # from this directory
```
