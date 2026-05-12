<a href="https://bunworkspaces.com">
<img src="./workspaces/web/documentation-website/src/pages/public/images/png/bwunster-bg-banner-wide_3000x900.png" alt="bun-workspaces" width="100%" />
</a>

<br/>

Full Documentation: [https://bunworkspaces.com](https://bunworkspaces.com)

Changelog: [GitHub Releases](https://github.com/bun-workspaces/bun-workspaces/releases)

# bun-workspaces

A [monorepo](http://sonarsource.com/resources/library/monorepo/) tool that enhances native [Bun workspaces](https://bun.sh/docs/install/workspaces).

- Works right away, with **no boilerplate required** 🍽️
- Get **rich metadata** about your monorepo 🤖
- **Orchestrate** your workspaces' package.json scripts 🎻
- Run one-off [**Bun Shell**](https://bun.com/docs/runtime/shell) commands in your workspaces 🐚
- Use with Bun as your package manager for **Node** projects 🎁
- Determine **affected workspaces** based on changed files 🕸️
- AI: Provides an [AGENTS.md](https://bunworkspaces.com/ai/agents) file and an [MCP server](https://bunworkspaces.com/ai/mcp)! 🛠️

To get started, all you need is a repo using Bun's workspaces feature for nested JavaScript/TypeScript packages. This adds enhanced features on top of plain workspaces.

Start running some [CLI commands](https://bunworkspaces.com/cli) right away in your repo, or take full advantage of the [TypeScript API](https://bunworkspaces.com/api) and its features.

This package is unopinionated and works with any project structure you want. Think of this as a power suit you can snap onto native workspaces, rather than whole new monorepo framework.

## Quick Start

Installation:

```bash
$ # Install to use the API and/or lock your CLI version for your project
$ bun add --dev bun-workspaces
$ # Start using the CLI with or without the installation step
$ bunx bun-workspaces --help
```

Note that you need to run `bun install` in your project for `bun-workspaces` to find your project's workspaces. This is because it reads `bun.lock`. This also means that if you update your workspaces, such as changing their name, you must run `bun install` for the change to reflect.

### CLI

[Full CLI documentation here](https://bunworkspaces.com/cli)

```bash
<<CLI_QUICKSTART>>
```

### API

[Full API documentation here](https://bunworkspaces.com/api)

```typescript
<<API_QUICKSTART>>
```

### Configuration

`bun-workspaces` has no required configuration, but there are optional config files.

#### Workspace Config

Workspace configs can be placed in a workspace's directory at `bw.workspace.ts`.

[Workspace configuration documentation here](https://bunworkspaces.com/config/workspace)

```typescript
<<WORKSPACE_CONFIG_QUICKSTART>>
```

#### Root Config

A root config can be placed in the project root directory at `bw.root.ts`,
which can also apply workspace configs in bulk by using workspace patterns.

[Root configuration documentation here](https://bunworkspaces.com/config/root)

[More on workspace pattern configs here](https://bunworkspaces.com/config/workspace-pattern-configs)

```typescript
<<ROOT_CONFIG_QUICKSTART>>
```

_`bun-workspaces` is independent from the [Bun](https://bun.sh) project and is not affiliated with or endorsed by Anthropic. This project aims to enhance the experience of Bun for its users._

Developed By:

<a href="https://smorsic.io" target="_blank" rel="noopener noreferrer">
  <img src="./workspaces/web/documentation-website/src/pages/public/images/png/smorsic-banner_light_803x300.png" alt="Smorsic Labs logo" width="280" />
</a>
