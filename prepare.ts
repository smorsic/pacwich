import { $ } from "bun";

await $`bun init-pacwich-package`;
await $`bun create-readme`;
await $`bun create-agents-md`;
await $`bun create-mise-toml`;
await $`bun create-pnpm-workspace-yaml`;
await $`bun mise`;
