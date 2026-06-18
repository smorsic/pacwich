<a href="https://pacwich.dev">
<img src="./workspaces/web/documentation-website/src/pages/public/images/png/bwunster-pacwich-subtitled-wide_1400x400.png" alt="pacwich logo" width="100%" />
</a>

<br/>

# pacwich

<sub>Latest: <<PACWICH_VERSION>></sub>

Monorepo tooling that works on top of **Bun**, **npm**, and **pnpm** workspaces. Zero config required. [AI-friendly](https://pacwich.dev/ai) and human-friendly documentation. Has an [affected graph](https://pacwich.dev/concepts/affected) and [rules for workspace code sharing](https://pacwich.dev/config/workspace#workspace-dependency-rules). Comes with a CLI and TypeScript API.

To get started, all you need is a repo using workspaces for nested JavaScript/TypeScript packages. This adds enhanced features on top of plain workspaces.

Start running some [CLI commands](https://pacwich.dev/cli) right away in your repo, or take full advantage of the [TypeScript API](https://pacwich.dev/api) and its features.

**Full Documentation**: [https://pacwich.dev](https://pacwich.dev)

- [Overview page](https://pacwich.dev/intro/overview)
- [Getting Started Guide](https://pacwich.dev/intro/getting-started)
- Changelog: [GitHub Releases](https://github.com/smorsic/pacwich/releases)

#### Note: bun-workspaces

This is the continuation of the `bun-workspaces` package that only worked with Bun.
See the [migration guide](https://pacwich.dev/intro/bun-workspaces-migration) for more information. [Read the blog post](https://smorsic.io/blog/pacwich-launch) about motivations and development strategy.

You can also instruct an agent to read `https://pacwich.dev/intro/bun-workspaces-migration/index.md`
to assist with migration.

Thanks to most core code and tests carrying over from `bun-workspaces`, `pacwich` inherits its maturity to a large degree.

## Quick Start

### Installation

Use the global install and/or local install. The global install gives you a convenient
`pacwich` binary, which will still delegate to a local install's CLI, if available,
while the local install locks the version for your project.

If you only use a local install, you can still invoke the `pacwich` command within `package.json` scripts, potentially using your root `package.json` scripts for common `pacwich` operations
you need in your project.

```bash
# Use the global install command of choice below
bun add -g pacwich
# or
pnpm add -g pacwich
# or
npm install -g pacwich

# And/or local install in your project
bun add -d pacwich
# or
pnpm add -D pacwich
# or
npm install -D pacwich
```

#### Stale workspace data

Note that you need to run your package manager's install for pacwich to have current workspace data available, e.g. via `bun install`, `pnpm install`, or `npm install`. If you've added/removed/updated any workspace package.json, you'll likely need to run this again.

#### Calling the CLI

You might optionally [alias](https://www.geeksforgeeks.org/linux-unix/alias-command-in-linux-with-examples/) your most used invocation to `pw`,
especially if you area `bun-workspaces` user that had a `bw` alias.

```bash
# Use the global command if installed
# This will use a local install's CLI, if available
pacwich --help

# Or use a one-off/local invocation
npx pacwich --help
bunx pacwich --help
pnpm exec pacwich --help
```

### CLI

[Full CLI documentation here](https://pacwich.dev/cli)

```bash
<<CLI_QUICKSTART>>
```

### API

[Full API documentation here](https://pacwich.dev/api)

```typescript
<<API_QUICKSTART>>
```

### Configuration

`pacwich` has no required configuration, but there are optional config files.

#### Workspace Config

Workspace configs can be placed in a workspace's directory at `pacwich.workspace.ts`.

[Workspace configuration documentation here](https://pacwich.dev/config/workspace)

```typescript
<<WORKSPACE_CONFIG_QUICKSTART>>
```

#### Project Config

A project-level config can be placed in the project root directory at `pacwich.project.ts`,
which can also apply workspace configs in bulk by using workspace patterns.

[Project configuration documentation here](https://pacwich.dev/config/project)

[More on workspace pattern configs here](https://pacwich.dev/config/workspace-pattern-configs)

```typescript
<<PROJECT_CONFIG_QUICKSTART>>
```
