## pacwich npm package: Overview

`pacwich` is a CLI and TypeScript API to help manage JavaScript/TypeScript monorepos, working directly on top of Bun, npm, and pnpm workspaces. The pm is auto-detected from the project's lockfile (or pinned explicitly via config, env var, or `--pm` flag). The overall goal is a monorepo tool that is more lightweight than others while still offering powerful comparable features, requiring only a standard repo using the chosen package manager's workspaces.

The CLI is recommended to be installed globally (which delegates to a local install if present), and/or installed locally in a project. Installation is required to use the TS API.

Main terms to know:

- Project: generally the root of a repo, located at the directory containing the lockfile and root package.json.
- Workspace: a nested package within a project. Synonymous with pm's workspaces but can be enriched via `pacwich`'s optional configuration. The root package.json can count as a workspace as well, but by default, only nested packages are considered workspaces.
- Inputs: files considered to be part of a workspace's source code, configurable per-workspace or per-workspace-script, by default all git-trackable files in a workspace's directory.
- Script: an entry in the `scripts` field of a workspace's `package.json` file. pacwich can also run one-off commands known as "inline scripts," which can use the system shell (`sh -c` or `cmd /d /s /c` for windows, the default) or the Bun shell when opted in.

pacwich also supports **affected workspace** detection: given a set of changed files (from a git diff or an explicit list), it determines which workspaces are meaningfully changed. This drives `pacwich list-affected`/`pacwich run-affected` for orchestrating builds, tests, etc. across only the workspaces that need them.

pacwich additionally provides a `verify` command that detects "implicit workspace dependencies" (imports of other workspaces' package names that aren't declared in the importing workspace's `package.json`), closing a safety-net gap that opens once a project uses a package manager (notably npm) that resolves workspace imports regardless of declaration. Verify reuses each workspace's "inputs" (`defaultInputs.files`, defaulting to `["."]`) to decide what to scan, so it is bound to git-trackable files just like affected resolution. A project that lives entirely outside its enclosing git index (for example, nested under an outer `.gitignore`) silently scans zero files.

Optional config files: `pacwich.project.{ts,js,jsonc,json}` at root or `pacwich.workspace.{ts,js,jsonc,json}` at any workspace root.

<!--End pacwich overview-->
