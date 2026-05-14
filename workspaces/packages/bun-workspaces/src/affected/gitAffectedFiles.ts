import fs from "fs";
import path from "path";
import { defineErrors } from "../internal/core";
import { createSubprocess } from "../runScript/subprocesses";

export const GIT_AFFECTED_ERRORS = defineErrors(
  "NoGitRepository",
  "GitCommandFailed",
  "InvalidGitRef",
);

/**
 * Reject ref values that look like CLI options to avoid argument injection
 * (e.g. a ref of `--upload-pack=...` being interpreted as a git option when
 * passed as a positional argument). Git itself forbids refs starting with
 * `-` via `git check-ref-format`, so this rejects only inputs that could
 * never be a real ref.
 */
const assertValidGitRef = (ref: string, label: string): void => {
  if (typeof ref !== "string" || ref.length === 0) {
    throw new GIT_AFFECTED_ERRORS.InvalidGitRef(
      `${label} must be a non-empty string`,
    );
  }
  if (ref.startsWith("-")) {
    throw new GIT_AFFECTED_ERRORS.InvalidGitRef(
      `${label} cannot start with "-" (got ${JSON.stringify(ref)})`,
    );
  }
};

export const GIT_AFFECTED_FILE_REASONS = [
  "diff",
  "staged",
  "unstaged",
  "untracked",
] as const;

export type GitAffectedFileReason = (typeof GIT_AFFECTED_FILE_REASONS)[number];

export interface GetGitAffectedFilesOptions {
  /** Project root */
  rootDirectory: string;
  /**
   * Base of the committed-range diff. Should be a single revision (commit
   * SHA, branch name, tag, or `HEAD~n`), not a range expression like
   * `main..feature` or `main...feature` — the two refs are passed as the
   * two endpoints of `git diff`, which is already a two-dot diff.
   */
  baseRef: string;
  /** Head of the committed-range diff. Same constraints as `baseRef`. */
  headRef: string;
  /** Exclude untracked files */
  ignoreUntracked?: boolean;
  /** Ignore staged files */
  ignoreStaged?: boolean;
  /** Ignore unstaged files */
  ignoreUnstaged?: boolean;
  /** Exclude uncommitted files (ignores staged, unstaged, and untracked) */
  ignoreUncommitted?: boolean;
}

export interface GitAffectedFile {
  /** Posix file path relative to the project root */
  projectFilePath: string;
  /**
   * The reasons for the file being affected, in canonical order.
   * A file in the committed range may also appear as staged/unstaged/untracked
   * if it has corresponding working-tree state.
   */
  reasons: GitAffectedFileReason[];
}

export interface GetGitAffectedFilesResult {
  files: GitAffectedFile[];
  /** The full SHA the `baseRef` resolves to */
  baseSha: string;
  /** The full SHA the `headRef` resolves to */
  headSha: string;
}

interface RunGitResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

const runGit = async (args: string[], cwd: string): Promise<RunGitResult> => {
  const proc = createSubprocess(["git", ...args], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { stdout, stderr, exitCode };
};

const runGitOrThrow = async (args: string[], cwd: string): Promise<string> => {
  const { stdout, stderr, exitCode } = await runGit(args, cwd);
  if (exitCode !== 0) {
    throw new GIT_AFFECTED_ERRORS.GitCommandFailed(
      `git ${args.join(" ")} failed (exit ${exitCode}): ${stderr.trim()}`,
    );
  }
  return stdout;
};

/**
 * Git's `-z` flag emits paths separated by NUL bytes with no quoting or
 * escaping, which is the only safe way to parse output containing paths
 * with spaces, newlines, or non-ASCII characters under `core.quotePath`.
 */
const parseNullSeparated = (output: string): string[] =>
  output.split("\0").filter(Boolean);

const resolveGitRoot = async (rootDirectory: string): Promise<string> => {
  let result: RunGitResult;
  try {
    result = await runGit(["rev-parse", "--show-toplevel"], rootDirectory);
  } catch (error) {
    throw new GIT_AFFECTED_ERRORS.NoGitRepository(
      `Not a git repository: ${rootDirectory}${
        error instanceof Error ? ` (${error.message})` : ""
      }`,
    );
  }
  if (result.exitCode !== 0 || !result.stdout.trim()) {
    throw new GIT_AFFECTED_ERRORS.NoGitRepository(
      `Not a git repository: ${rootDirectory}`,
    );
  }
  return result.stdout.trim();
};

/**
 * Read a project-root-relative file's contents at a specific git ref via
 * `git show <ref>:<repo-relative-path>`. Returns `null` if the file does not
 * exist at that ref (e.g. it was added later). Throws on other git errors.
 */
export const readProjectFileAtGitRef = async ({
  rootDirectory,
  ref,
  projectRelativePath,
}: {
  rootDirectory: string;
  ref: string;
  projectRelativePath: string;
}): Promise<string | null> => {
  assertValidGitRef(ref, "ref");

  const gitRoot = fs.realpathSync.native(
    path.resolve(await resolveGitRoot(rootDirectory)),
  );
  const absoluteProjectRoot = fs.realpathSync.native(
    path.resolve(rootDirectory),
  );
  const absoluteFile = path.resolve(absoluteProjectRoot, projectRelativePath);
  const repoRelative = path
    .relative(gitRoot, absoluteFile)
    .split(path.sep)
    .join("/");

  const result = await runGit(["show", `${ref}:${repoRelative}`], gitRoot);
  if (result.exitCode === 0) return result.stdout;
  if (
    result.stderr.includes("does not exist") ||
    result.stderr.includes("exists on disk, but not in")
  ) {
    return null;
  }
  throw new GIT_AFFECTED_ERRORS.GitCommandFailed(
    `git show ${ref}:${repoRelative} failed (exit ${result.exitCode}): ${result.stderr.trim()}`,
  );
};

const toProjectFilePath = ({
  gitRoot,
  absoluteProjectRoot,
  gitRelativePath,
}: {
  gitRoot: string;
  absoluteProjectRoot: string;
  gitRelativePath: string;
}): string | null => {
  const absolute = path.resolve(gitRoot, gitRelativePath);
  const relative = path.relative(absoluteProjectRoot, absolute);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    return null;
  }
  return relative.split(path.sep).join("/");
};

export const getGitAffectedFiles = async (
  options: GetGitAffectedFilesOptions,
): Promise<GetGitAffectedFilesResult> => {
  const {
    rootDirectory,
    baseRef,
    headRef,
    ignoreUntracked,
    ignoreStaged,
    ignoreUnstaged,
    ignoreUncommitted,
  } = options;

  assertValidGitRef(baseRef, "baseRef");
  assertValidGitRef(headRef, "headRef");

  const gitRoot = fs.realpathSync.native(
    path.resolve(await resolveGitRoot(rootDirectory)),
  );
  const absoluteProjectRoot = fs.realpathSync.native(
    path.resolve(rootDirectory),
  );

  const includeStaged = !ignoreUncommitted && !ignoreStaged;
  const includeUnstaged = !ignoreUncommitted && !ignoreUnstaged;
  const includeUntracked = !ignoreUncommitted && !ignoreUntracked;

  const [baseSha, headSha] = await Promise.all([
    runGitOrThrow(["rev-parse", baseRef], gitRoot).then((out) => out.trim()),
    runGitOrThrow(["rev-parse", headRef], gitRoot).then((out) => out.trim()),
  ]);

  type Bucket = { reason: GitAffectedFileReason; paths: string[] };
  const collectors: Promise<Bucket>[] = [
    runGitOrThrow(
      ["diff", "--name-only", "-z", baseRef, headRef],
      gitRoot,
    ).then((out) => ({ reason: "diff", paths: parseNullSeparated(out) })),
  ];

  if (includeStaged) {
    collectors.push(
      runGitOrThrow(["diff", "--cached", "--name-only", "-z"], gitRoot).then(
        (out) => ({ reason: "staged", paths: parseNullSeparated(out) }),
      ),
    );
  }
  if (includeUnstaged) {
    collectors.push(
      runGitOrThrow(["diff", "--name-only", "-z"], gitRoot).then((out) => ({
        reason: "unstaged",
        paths: parseNullSeparated(out),
      })),
    );
  }
  if (includeUntracked) {
    collectors.push(
      runGitOrThrow(
        ["ls-files", "--others", "--exclude-standard", "-z"],
        gitRoot,
      ).then((out) => ({
        reason: "untracked",
        paths: parseNullSeparated(out),
      })),
    );
  }

  const buckets = await Promise.all(collectors);

  const reasonsByPath = new Map<string, Set<GitAffectedFileReason>>();
  for (const { reason, paths } of buckets) {
    for (const gitRelativePath of paths) {
      const projectFilePath = toProjectFilePath({
        gitRoot,
        absoluteProjectRoot,
        gitRelativePath,
      });
      if (!projectFilePath) continue;
      let set = reasonsByPath.get(projectFilePath);
      if (!set) {
        set = new Set();
        reasonsByPath.set(projectFilePath, set);
      }
      set.add(reason);
    }
  }

  const files: GitAffectedFile[] = Array.from(reasonsByPath.entries())
    .map(([projectFilePath, reasonSet]) => ({
      projectFilePath,
      reasons: GIT_AFFECTED_FILE_REASONS.filter((r) => reasonSet.has(r)),
    }))
    .sort((a, b) => a.projectFilePath.localeCompare(b.projectFilePath));

  return { files, baseSha, headSha };
};
