import fs from "fs";
import os from "os";
import path from "path";
import { text as readStreamText } from "stream/consumers";
import { createSubprocess } from "../../src/runScript/subprocesses";

const TEMP_BASE = path.join(os.tmpdir(), "pacwich-tests", "git");

let counter = 0;
const nextDir = () =>
  path.join(TEMP_BASE, `${process.pid}-${Date.now()}-${counter++}`);

export interface GitFixtureFile {
  /** Repo-relative posix path */
  path: string;
  content: string;
}

export interface GitFixtureCommit {
  message: string;
  /** Files to write and add before committing */
  files?: GitFixtureFile[];
  /** Repo-relative paths to delete (and stage the deletion) before committing */
  remove?: string[];
}

export interface GitFixtureWorkingState {
  /** Files written to working tree without `git add` (modifies tracked files = unstaged; new paths = untracked) */
  modify?: GitFixtureFile[];
  /** Files written and `git add`ed but not committed */
  stage?: GitFixtureFile[];
  /**
   * Files written and `git add`ed at one content, then overwritten on disk so the working tree
   * differs from the index. Produces both staged and unstaged state on the same path.
   */
  partiallyStage?: {
    path: string;
    staged: string;
    working: string;
  }[];
}

export interface CreateGitFixtureOptions {
  commits: GitFixtureCommit[];
  /** Working tree state applied after all commits (no commit) */
  workingState?: GitFixtureWorkingState;
  /** Subdirectory under the repo root to treat as the pacwich project root */
  projectSubdir?: string;
  /** Initial branch name (default "main") */
  initialBranch?: string;
}

export interface GitFixtureCommitRef {
  message: string;
  sha: string;
}

export interface GitFixture extends AsyncDisposable {
  /** Absolute path to the git repo root */
  repoPath: string;
  /** Absolute path to the project root (equals repoPath unless projectSubdir is set) */
  projectPath: string;
  /** Committed history in order */
  commits: GitFixtureCommitRef[];
  /** Lookup commits by their message */
  shaForMessage: (message: string) => string;
  /** SHA of HEAD after all commits */
  headSha: string;
  /** Run an arbitrary git command in the repo (for setup tweaks not covered by the schema) */
  runGit: (args: string[]) => Promise<string>;
  /**
   * Remove the temp repo. Idempotent. Tests should normally hold the fixture
   * with `await using` so disposal is automatic and per-test, which is
   * required for safe concurrent execution.
   */
  cleanup: () => void;
}

const runGit = async (args: string[], cwd: string): Promise<string> => {
  const proc = createSubprocess(["git", ...args], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: "Test",
      GIT_AUTHOR_EMAIL: "test@example.com",
      GIT_COMMITTER_NAME: "Test",
      GIT_COMMITTER_EMAIL: "test@example.com",
      GIT_CONFIG_GLOBAL: "/dev/null",
      GIT_CONFIG_SYSTEM: "/dev/null",
    },
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    readStreamText(proc.stdout!),
    readStreamText(proc.stderr!),
    proc.exited,
  ]);
  if (exitCode !== 0) {
    throw new Error(
      `git ${args.join(" ")} failed (exit ${exitCode}): ${stderr.trim()}`,
    );
  }
  return stdout;
};

const writeFileAtRepo = (
  repoPath: string,
  relativePath: string,
  content: string,
) => {
  const absolute = path.join(repoPath, ...relativePath.split("/"));
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, content);
};

const removeFileAtRepo = (repoPath: string, relativePath: string) => {
  const absolute = path.join(repoPath, ...relativePath.split("/"));
  if (fs.existsSync(absolute)) fs.unlinkSync(absolute);
};

export const createGitFixture = async (
  options: CreateGitFixtureOptions,
): Promise<GitFixture> => {
  const {
    commits,
    workingState,
    projectSubdir,
    initialBranch = "main",
  } = options;
  if (commits.length === 0) {
    throw new Error("createGitFixture requires at least one commit");
  }

  fs.mkdirSync(TEMP_BASE, { recursive: true });
  const repoPath = nextDir();
  fs.mkdirSync(repoPath, { recursive: true });

  await runGit(["init", "-b", initialBranch], repoPath);
  await runGit(["config", "user.email", "test@example.com"], repoPath);
  await runGit(["config", "user.name", "Test"], repoPath);
  await runGit(["config", "commit.gpgsign", "false"], repoPath);

  const projectPath = projectSubdir
    ? path.join(repoPath, ...projectSubdir.split("/"))
    : repoPath;
  if (projectSubdir) {
    fs.mkdirSync(projectPath, { recursive: true });
  }

  const commitRefs: GitFixtureCommitRef[] = [];
  for (const commit of commits) {
    for (const file of commit.files ?? []) {
      writeFileAtRepo(repoPath, file.path, file.content);
    }
    for (const removePath of commit.remove ?? []) {
      removeFileAtRepo(repoPath, removePath);
    }
    await runGit(["add", "-A"], repoPath);
    await runGit(["commit", "--allow-empty", "-m", commit.message], repoPath);
    const sha = (await runGit(["rev-parse", "HEAD"], repoPath)).trim();
    commitRefs.push({ message: commit.message, sha });
  }

  if (workingState) {
    for (const file of workingState.stage ?? []) {
      writeFileAtRepo(repoPath, file.path, file.content);
      await runGit(["add", "--", file.path], repoPath);
    }
    for (const entry of workingState.partiallyStage ?? []) {
      writeFileAtRepo(repoPath, entry.path, entry.staged);
      await runGit(["add", "--", entry.path], repoPath);
      writeFileAtRepo(repoPath, entry.path, entry.working);
    }
    for (const file of workingState.modify ?? []) {
      writeFileAtRepo(repoPath, file.path, file.content);
    }
  }

  const headSha = (await runGit(["rev-parse", "HEAD"], repoPath)).trim();

  let disposed = false;
  const cleanup = () => {
    if (disposed) return;
    disposed = true;
    // On Windows the git index and AV scanners can hold handles to the
    // freshly-spawned repo's files long enough that the first unlink
    // attempts fail with EPERM. The fixture lives under the OS tmpdir
    // which the OS reaps independently, so if rmSync still can't win
    // after a generous retry window we swallow the error rather than
    // failing an otherwise-passing test on a cleanup-only step.
    try {
      fs.rmSync(repoPath, {
        force: true,
        recursive: true,
        maxRetries: 20,
        retryDelay: 100,
      });
    } catch {
      /* tmpdir cleanup is best-effort */
    }
  };

  return {
    repoPath,
    projectPath,
    commits: commitRefs,
    shaForMessage: (message) => {
      const found = commitRefs.find((c) => c.message === message);
      if (!found) {
        throw new Error(`No commit with message "${message}" in fixture`);
      }
      return found.sha;
    },
    headSha,
    runGit: (args) => runGit(args, repoPath),
    cleanup,
    [Symbol.asyncDispose]: async () => cleanup(),
  };
};
