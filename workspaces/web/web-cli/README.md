# @pacwich/web-cli

Runs the **real pacwich CLI in the browser**, on top of an in-memory filesystem
([memfs](https://github.com/streamich/memfs)) — no backend. This workspace owns
the feature; the documentation website depends on it and renders it on its Web
CLI page.

It grew out of the `web-cli` **sandbox** (`workspaces/sandboxes/web-cli`), which
remains as reference material until this ships.

## What's here

```
src/
  engine/         the browser CLI driver + env shims (fs/os/process/path/buffer)
                  + the leaf-spawn mock. Public API in engine/index.ts.
  demo-project/   the mock monorepo (frontend/backend/shared) as inlined files,
                  seeded into memfs; plus how `run <script>` output is faked.
  bundler/        the rspack/rsbuild wiring consumers apply (aliases, node
                  polyfill options, the subprocess-replacement plugin).
  preview/        a standalone xterm UI + dev server for this package alone.
```

## How it works

- `engine/runPacwichCli.ts` calls the genuine `createCli()` from `pacwich`,
  bundled for the browser, capturing stdout/stderr via its `writeOutput` hook.
- `bundler/` aliases `fs`/`os` to memfs-backed shims, turns the `process`
  global off (a runtime shim provides it), stubs the Node built-ins the CLI
  imports but never runs, and replaces pacwich's single `runScript/
  subprocesses.ts` spawn with a mock — so the **real** scheduler still runs
  above it (`--dep-order`, parallelism), only the leaf process is faked.
- `demo-project/` seeds a small npm monorepo. Workspaces are discovered from
  `package-lock.json`; aliases/tags come from each `pacwich.workspace.jsonc`
  (JSONC, since the browser can't load executable `.ts` configs). Script output
  is canned in `scriptMocks.ts`.

## What's gated

`engine/webCliGuards.ts` rejects features the browser can't support, up front,
with a friendly one-line message: inline scripts (`--inline`), `doctor`,
`--cwd`, git-diff affected (`--base`/`--head` — use `--files`), and shell
operators.

## Run the preview

```bash
bun web-cli-lib dev   # from the repo root
# or, from this directory:
bun run dev           # http://localhost:3301
```

Try: `list-workspaces`, `info fe`, `list-scripts`, `run build`,
`run build --dep-order`, `list-affected --files 'packages/shared/**/*.ts'`,
`--help`.

## Tests

`tests/runCli.test.ts` runs under bun and exercises the same path the browser
does (memfs + the subprocess mock via `mock.module`), then drives
`runPacwichCli` and asserts on the captured output.

```bash
bun test   # from this directory
```
