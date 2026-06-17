import fs from "fs";
import path from "path";
import { text } from "stream/consumers";
import { createSubprocess } from "../runScript/subprocesses";
import { toPosixPath } from "./matchWorkspaceInputFiles";

const SKIPPED_DIR_NAMES = new Set(["node_modules", ".git"]);

const parseNullSeparated = (output: string): string[] =>
  output.split("\0").filter(Boolean);

const runGit = async (
  args: string[],
  cwd: string,
): Promise<{ stdout: string; exitCode: number }> => {
  const proc = createSubprocess(["git", ...args], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, exitCode] = await Promise.all([
    proc.stdout ? text(proc.stdout) : Promise.resolve(""),
    proc.exited,
  ]);
  return { stdout, exitCode };
};

/**
 * Walk `rootDirectory` recursively (skipping `node_modules` and `.git`)
 * to produce a flat list of project-relative POSIX file paths. Used as
 * a fallback when the project isn't a git repo so input resolution still
 * works on a plain directory.
 */
const walkFilesystemFallback = (rootDirectory: string): string[] => {
  const results: string[] = [];
  const walk = (dir: string, baseRel: string) => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.isDirectory() && SKIPPED_DIR_NAMES.has(entry.name)) continue;
      const rel = baseRel ? `${baseRel}/${entry.name}` : entry.name;
      const absolute = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(absolute, rel);
      } else if (entry.isFile()) {
        results.push(rel);
      }
    }
  };
  walk(rootDirectory, "");
  return results;
};

/**
 * Enumerate every git-trackable file in the project as a list of
 * project-relative POSIX paths. The union of `git ls-files` (tracked)
 * and `git ls-files --others --exclude-standard` (untracked but not
 * gitignored), the same definition of "trackable" the affected
 * feature uses to filter changed files.
 *
 * Falls back to a plain filesystem walk (skipping `node_modules` and
 * `.git`) when `rootDirectory` isn't inside a git repo, so input
 * resolution remains usable in non-git contexts. Pacwich's gitignore
 * enforcement is the only thing lost in that fallback. The project-level
 * `verify.workspaceDependencies.ignoreInputFiles` config remains the
 * canonical escape hatch.
 */
export const listProjectTrackableFiles = async ({
  rootDirectory,
}: {
  rootDirectory: string;
}): Promise<string[]> => {
  const isRepo = await runGit(
    ["rev-parse", "--is-inside-work-tree"],
    rootDirectory,
  );
  if (isRepo.exitCode !== 0 || isRepo.stdout.trim() !== "true") {
    return walkFilesystemFallback(rootDirectory).sort();
  }

  const gitRootResult = await runGit(
    ["rev-parse", "--show-toplevel"],
    rootDirectory,
  );
  if (gitRootResult.exitCode !== 0 || !gitRootResult.stdout.trim()) {
    return walkFilesystemFallback(rootDirectory).sort();
  }
  const gitRoot = fs.realpathSync.native(
    path.resolve(gitRootResult.stdout.trim()),
  );
  const absoluteProjectRoot = fs.realpathSync.native(
    path.resolve(rootDirectory),
  );

  // If the project root itself sits inside a gitignored path (e.g. a
  // test build under `dist.test/`), `git ls-files` would yield nothing.
  // Fall back to the filesystem walk so input resolution still works.
  const ignoreCheck = await runGit(
    ["check-ignore", "--quiet", absoluteProjectRoot],
    gitRoot,
  );
  if (ignoreCheck.exitCode === 0) {
    return walkFilesystemFallback(rootDirectory).sort();
  }

  const [tracked, untracked] = await Promise.all([
    runGit(["ls-files", "-z"], gitRoot),
    runGit(["ls-files", "--others", "--exclude-standard", "-z"], gitRoot),
  ]);

  const seen = new Set<string>();
  for (const repoRelative of [
    ...parseNullSeparated(tracked.stdout),
    ...parseNullSeparated(untracked.stdout),
  ]) {
    const absolute = path.resolve(gitRoot, repoRelative);
    const projectRelative = path.relative(absoluteProjectRoot, absolute);
    if (
      !projectRelative ||
      projectRelative.startsWith("..") ||
      path.isAbsolute(projectRelative)
    ) {
      continue;
    }
    seen.add(toPosixPath(projectRelative));
  }

  return [...seen].sort();
};
