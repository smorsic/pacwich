import fs from "fs";
import path from "path";
import { DOC_CONTENT_BY_SLICE } from "../../ai/docsContent";
import { generateSkills } from "../../ai/skills/generateSkills";
import { logger } from "../../internal/logger";
import {
  commandOutputLogger,
  handleGlobalCommand,
} from "./commandHandlerUtils";

const DEFAULT_SKILLS_DIR = ".agents/skills";

export const addSkills = handleGlobalCommand(
  "addSkills",
  (
    { workingDirectory },
    options: { dir: string | undefined; dryRun: boolean },
  ) => {
    logger.debug(`Options: ${JSON.stringify(options)}`);

    const targetDir = path.resolve(
      workingDirectory,
      options.dir ?? DEFAULT_SKILLS_DIR,
    );
    const targetLabel = path.relative(workingDirectory, targetDir) || ".";

    const files = generateSkills({
      contentByKey: DOC_CONTENT_BY_SLICE,
    });

    const written: string[] = [];

    for (const file of files) {
      const fullPath = path.join(targetDir, file.relPath);
      const rel = path.relative(workingDirectory, fullPath);

      if (!options.dryRun) {
        fs.mkdirSync(path.dirname(fullPath), { recursive: true });
        fs.writeFileSync(fullPath, file.contents);
      }
      written.push(rel);
    }

    const lines = [
      `${options.dryRun ? "Would write" : "Wrote"} ${written.length} skill file(s) to ${targetLabel}:`,
      ...written.map((rel) => ` - ${rel}`),
    ];
    commandOutputLogger.info(lines.join("\n"));
  },
);
