## Project Overview

bun-workspaces is a CLI and TypeScript API to help manage Bun monorepos. It reads `bun.lock` to find all workspaces in the project. It is referred to as "bw" for short, which is also the recommended CLI alias. The overall goal is a monorepo tool that is more lightweight than others, with still powerful comparable features, requiring no special config to get started, only a standard Bun repo using workspaces.

Three main domain terms to know:

- Project: generally represents a monorepo and is defined by the root `package.json` file
- Workspace: a nested package within a project. The root package.json can count as a workspace as well, but by default, only nested packages are considered workspaces.
- Script: an entry in the `scripts` field of a workspace's `package.json` file. bw can also run one-off commands known as "inline scripts," which can use the Bun shell or system shell (`sh -c` or `cmd /d /s /c` for windows).

bw also supports **affected workspace** detection: given a set of changed files (from a git diff or an explicit list), it determines which workspaces are meaningfully changed. This drives `bw list-affected`/`bw run-affected` for orchestrating builds, tests, etc. across only the workspaces that need them.
