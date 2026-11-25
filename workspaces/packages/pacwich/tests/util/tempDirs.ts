import fs from "fs";

/**
 * Best-effort removal of a temp dir created by a test. On Windows, AV
 * scanners and just-exited child processes (e.g. when the dir was a
 * spawned CLI's cwd) can hold handles long enough that the first unlink
 * attempts fail with EBUSY/EPERM, so retry with backoff.
 */
export const removeTempDirSync = (dirPath: string) => {
  try {
    fs.rmSync(dirPath, {
      force: true,
      recursive: true,
      maxRetries: 20,
      retryDelay: 100,
    });
  } catch {
    /* tmpdir cleanup is best-effort */
  }
};
