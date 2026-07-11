# pacwich for VS Code

A VS Code (and [Open VSX](https://open-vsx.org/)-compatible) extension for
[pacwich](https://pacwich.dev), monorepo tooling for Bun, npm, and pnpm workspaces.

## Features

**pacwich Workspaces** - a tree view nested in the Explorer sidebar listing every workspace
in the opened project. Expand a workspace to see its path, aliases, tags, and scripts.
Right-click (or use the inline icons) to reveal a workspace in the Explorer or open its
`package.json` / `pacwich.workspace.*` config. There's also a `pacwich: Go to Workspace`
command (accessible from the Command Palette) for a quick jump list.

The tree refreshes itself automatically - it watches `package.json`, lockfiles, and
`pacwich.project.*`/`pacwich.workspace.*` config files under the project root (debounced, and
paused while the view isn't visible), so there's no manual refresh needed in the common case
(a `pacwich: Refresh Workspaces` command/button is still there as a fallback).

If your pacwich project isn't at the root of the opened folder (e.g. it's nested in a
subdirectory of a larger repo), set the `pacwich.projectRoot` setting to its relative path.

## Development

Open this directory (`workspaces/ide/vscode-extension`) as its own VS Code workspace folder,
then press `F5` to build and launch an Extension Development Host with the extension loaded.

```bash
bun run build   # bundle src/extension.ts -> dist/extension.js via esbuild
bun run watch   # same, in watch mode
bun run lint
bun run type-check
```

## Packaging and publishing

This workspace is named `@pacwich/vscode-extension` for bun/pacwich workspace resolution,
but vsce/ovsx reject a scoped `name` (it becomes the marketplace id `<publisher>.<name>`).
`bun run build` (`scripts/build.ts`) handles this the same way the main `pacwich` package
handles its own npm dist build: it bundles the extension and writes a separate,
publish-ready `dist/package.json` (unscoped `name: "pacwich"`, so the marketplace id is
`smorsic.pacwich`), alongside copies of `README.md`, `CHANGELOG.md`, and the repo's
`LICENSE.md`. Packaging and publishing both run from that `dist/` directory, so there's
nothing to filter with a `.vscodeignore` — `dist/` only ever contains exactly what should ship.

Packaging uses [`@vscode/vsce`](https://github.com/microsoft/vscode-vsce) for the
VS Code Marketplace and [`ovsx`](https://github.com/eclipse/openvsx/tree/master/cli) for the
[Open VSX Registry](https://open-vsx.org/) (used by forks such as Cursor, Windsurf, and VSCodium).

```bash
bun run build          # required first, produces dist/
bun run package         # produce a .vsix locally from dist/
bun run publish:vsce    # publish dist/ to the VS Code Marketplace
bun run publish:ovsx    # publish dist/ to Open VSX
```

Both publish scripts require the respective registry's personal access token
(`VSCE_PAT` / `OVSX_PAT`) to be set in the environment; neither is wired into CI yet.
