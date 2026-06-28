# sandbox: web-cli

An experiment: run the **real pacwich CLI** in the browser, on top of an
in-memory filesystem ([memfs](https://github.com/streamich/memfs)).

Unlike the (previous, backend-driven) web CLI that lived in the
documentation website, nothing here talks to a server. The CLI is bundled
for the browser and its `fs` access is redirected to a memfs volume that we
seed with a small mock monorepo. That keeps everything in this repo and lets
us mock whatever behavior we want directly.

## How it works

- `src/cli/memoryProject.ts` seeds a memfs volume with a mock npm monorepo
  (root `package.json` + `package-lock.json` + a few workspace
  `package.json`s). The npm adapter discovers workspaces from the lockfile.
- `rsbuild.config.ts` aliases `fs` (and `node:fs`) to a thin shim over that
  shared memfs volume, and uses `@rsbuild/plugin-node-polyfill` for the rest
  of the Node built-ins (`path`, `os`, `process`, ...).
- `src/cli/runPacwichCli.ts` calls `createCli({ defaultCwd }).run(...)` with
  the `writeOutput` hook, capturing stdout/stderr so the terminal can render
  it.
- `src/components/WebCliTerminal.tsx` is an [xterm](https://xtermjs.org/)
  screen plus a prompt input.

## Run it

```bash
bun web-cli dev      # from the repo root (runs this workspace's dev script)
# or, from this directory:
bun run dev
```

The scripts invoke rsbuild via `bunx` so they work regardless of how bun hoists
`@rsbuild/core` in the workspace install.

Then try a command in the terminal, e.g.:

```
list-workspaces
list-workspaces --name-only
```

> Script execution is not wired up yet — this demonstrates input/output and
> read-only project commands (e.g. `list-workspaces`).
