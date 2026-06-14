import fs from "fs";
import os from "os";
import path from "path";
import { DOC_SLICES } from "@pacwich/common/docs";
import { setupCliTest } from "../util/cliTestUtils";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
} from "../util/testFramework";

const SKILL_PATHS = DOC_SLICES.map((s) => `${s.skillName}/SKILL.md`);

describe("CLI - add-skills command", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pacwich-add-skills-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  const skillsDir = () => path.join(tmpDir, ".agents", "skills");
  const run = () => setupCliTest({ workingDirectory: tmpDir }).run;

  test("writes a SKILL.md for every slice into .agents/skills", async () => {
    const result = await run()("add-skills");
    expect(result.stderr.raw).toBeEmpty();
    expect(result.exitCode).toBe(0);
    expect(result.stdout.sanitized).toContain(
      `Wrote ${SKILL_PATHS.length} skill file(s)`,
    );
    for (const rel of SKILL_PATHS) {
      const full = path.join(skillsDir(), rel);
      expect(fs.existsSync(full)).toBe(true);
    }
    // spot-check frontmatter of one generated skill
    const cli = fs.readFileSync(
      path.join(skillsDir(), "pacwich-cli", "SKILL.md"),
      "utf8",
    );
    expect(cli).toContain("name: pacwich-cli");
  });

  test("--dir overrides the target directory", async () => {
    const result = await run()("add-skills", "--dir", "docs/skills");
    expect(result.exitCode).toBe(0);
    expect(
      fs.existsSync(
        path.join(tmpDir, "docs", "skills", "pacwich-cli", "SKILL.md"),
      ),
    ).toBe(true);
    expect(fs.existsSync(skillsDir())).toBe(false);
  });

  test("re-run overwrites existing files so upgrades take effect", async () => {
    await run()("add-skills");
    const target = path.join(skillsDir(), "pacwich-cli", "SKILL.md");
    fs.writeFileSync(target, "EDITED BY USER");

    const result = await run()("add-skills");
    expect(result.exitCode).toBe(0);
    expect(result.stdout.sanitized).toContain(
      `Wrote ${SKILL_PATHS.length} skill file(s)`,
    );
    expect(fs.readFileSync(target, "utf8")).toContain("name: pacwich-cli");
  });

  test("--dry-run reports a plan without writing anything", async () => {
    const result = await run()("add-skills", "--dry-run");
    expect(result.exitCode).toBe(0);
    expect(result.stdout.sanitized).toContain(
      `Would write ${SKILL_PATHS.length} skill file(s)`,
    );
    expect(fs.existsSync(path.join(tmpDir, ".agents"))).toBe(false);
  });
});
