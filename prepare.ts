import { $ } from "bun";
import { createScriptLogger } from "./workspaces/meta/util";

const logger = createScriptLogger({ name: "prepare" });

await $`bun init-pacwich-package`;
await $`bun init-web-cli`;

if (process.env.DISABLE_README_AUTO_UPDATE !== "true") {
  await $`bun create-readme`;
} else {
  logger.info("Skipping README creation (DISABLE_README_AUTO_UPDATE)");
}

await $`bun create-agents-md`;
await $`bun create-mise-toml`;
await $`bun create-claude-skill-links`;
await $`bunx husky`;
await $`bun mise`;
await $`bunx pacwich verify`;
