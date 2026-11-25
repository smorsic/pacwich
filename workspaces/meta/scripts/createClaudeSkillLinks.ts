import { mkdir, readdir, readlink, rm, symlink } from "node:fs/promises";
import path from "path";
import { createScriptLogger } from "../util";

const AGENTS_SKILLS_DIR = ".agents/skills";
const CLAUDE_SKILLS_DIR = ".claude/skills";

/**
 * Mirror every skill under .agents/skills into .claude/skills as a symlink
 */
if (import.meta.main) {
  const root = process.env.PACWICH_PROJECT_PATH as string;

  const logger = createScriptLogger({ name: ".claude/skills" });

  const agentsSkillsPath = path.resolve(root, AGENTS_SKILLS_DIR);
  const claudeSkillsPath = path.resolve(root, CLAUDE_SKILLS_DIR);

  await mkdir(claudeSkillsPath, { recursive: true });

  const sourceNames = (await readdir(agentsSkillsPath, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map(({ name }) => name);
  const sourceNameSet = new Set(sourceNames);

  // Prune links (or leftover pre-migration real dirs) with no matching source
  for (const entry of await readdir(claudeSkillsPath)) {
    if (sourceNameSet.has(entry)) continue;
    logger.debug(`Pruning stale ${CLAUDE_SKILLS_DIR}/${entry}`);
    await rm(path.join(claudeSkillsPath, entry), {
      recursive: true,
      force: true,
    });
  }

  for (const name of sourceNames) {
    const linkPath = path.join(claudeSkillsPath, name);
    const target = path.relative(
      claudeSkillsPath,
      path.join(agentsSkillsPath, name),
    );

    if ((await readlink(linkPath).catch(() => null)) === target) continue;

    // Replaces a stale link or a leftover real directory from before migration
    await rm(linkPath, { recursive: true, force: true });
    await symlink(target, linkPath);
    logger.info(`Linked ${CLAUDE_SKILLS_DIR}/${name} -> ${target}`);
  }

  logger.info("Skill links up to date");
}
