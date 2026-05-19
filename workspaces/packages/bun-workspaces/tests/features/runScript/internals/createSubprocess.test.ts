import path from "path";
import { describe, test, expect } from "bun:test";
import { IS_LINUX, IS_WINDOWS } from "../../../../src/internal/core";
import { createProcessOutput } from "../../../../src/runScript/output/processOutput";

const FIXTURE_PATH = path.join(
  import.meta.dir,
  "../../../fixtures/testScripts/createSubprocesses.ts",
);

const SYSTEM_SHELL_FIXTURE_PATH = path.join(
  import.meta.dir,
  "../../../fixtures/testScripts/createSubprocessesSystemShell.ts",
);

const PGID_ISOLATION_FIXTURE_PATH = path.join(
  import.meta.dir,
  "../../../fixtures/testScripts/createSubprocessesPgidIsolation.ts",
);

/** Returns the direct child PIDs of a process using Linux procfs. */
const getChildPids = async (ppid: number): Promise<number[]> => {
  try {
    const content = await Bun.file(
      `/proc/${ppid}/task/${ppid}/children`,
    ).text();
    return content
      .trim()
      .split(/\s+/)
      .map(Number)
      .filter((n) => n > 0);
  } catch {
    return [];
  }
};

const pidExists = async (pid: number): Promise<boolean> => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

describe("createSubprocess", () => {
  if (IS_WINDOWS) {
    /** @todo Windows support for Bun.Subprocess.kill is needed */
    return;
  }

  test(
    "kills registered subprocesses when main process exits via signal",
    async () => {
      // detached: true gives the fixture its own process group so that
      // process.kill(0, signal) inside the fixture does not reach the test runner.
      const fixtureProcess = Bun.spawn(["bun", FIXTURE_PATH], {
        stdout: "pipe",
        stderr: "ignore",
        detached: true,
      });

      const pids: number[] = [];
      for await (const { chunk } of createProcessOutput(
        fixtureProcess.stdout,
        {},
      ).text()) {
        for (const line of Bun.stripANSI(chunk).split("\n")) {
          const pid = parseInt(line.trim(), 10);
          if (Number.isFinite(pid) && pid > 0) pids.push(pid);
        }
        if (pids.length >= 4) break;
      }

      expect(pids).toHaveLength(4);
      expect(pids.every((pid) => Number.isFinite(pid) && pid > 0)).toBe(true);

      for (const pid of pids) {
        expect(await pidExists(pid)).toBe(true);
      }

      fixtureProcess.kill("SIGINT");
      await fixtureProcess.exited;

      // Allow kill signals sent to subprocesses to be processed
      await Bun.sleep(100);

      for (const pid of pids) {
        expect(await pidExists(pid)).toBe(false);
      }
    },
    { timeout: 10000 },
  );

  test(
    "kills grandchild processes (system shell) when main process exits via SIGTERM",
    async () => {
      if (!IS_LINUX) {
        // getChildPids relies on Linux procfs; skip grandchild assertion elsewhere.
        return;
      }

      const fixtureProcess = Bun.spawn(["bun", SYSTEM_SHELL_FIXTURE_PATH], {
        stdout: "pipe",
        stderr: "ignore",
        detached: true,
      });

      // Collect the sh PIDs printed by the fixture (one per subprocess).
      const shPids: number[] = [];
      for await (const { chunk } of createProcessOutput(
        fixtureProcess.stdout,
        {},
      ).text()) {
        for (const line of Bun.stripANSI(chunk).split("\n")) {
          const pid = parseInt(line.trim(), 10);
          if (Number.isFinite(pid) && pid > 0) shPids.push(pid);
        }
        if (shPids.length >= 2) break;
      }

      expect(shPids).toHaveLength(2);

      // Give sh time to fork its sleep child.
      await Bun.sleep(300);

      // Collect grandchild PIDs (the sleep processes sh forked).
      const grandchildPids: number[] = [];
      for (const shPid of shPids) {
        grandchildPids.push(...(await getChildPids(shPid)));
      }

      expect(grandchildPids.length).toBeGreaterThan(0);

      for (const pid of [...shPids, ...grandchildPids]) {
        expect(await pidExists(pid)).toBe(true);
      }

      fixtureProcess.kill("SIGTERM");
      await fixtureProcess.exited;

      // Allow kill signals sent to the process group to be processed.
      await Bun.sleep(100);

      for (const pid of [...shPids, ...grandchildPids]) {
        expect(await pidExists(pid)).toBe(false);
      }
    },
    { timeout: 10000 },
  );

  test(
    "SIGTERM to a bw-using process does not propagate to its process-group siblings",
    async () => {
      // detached: true gives the fixture its own process group. A sibling
      // spawned inside the fixture (without detached) inherits that pgid,
      // so it sits in the same group as the fixture's own bw exit handler.
      const fixtureProcess = Bun.spawn(["bun", PGID_ISOLATION_FIXTURE_PATH], {
        stdout: "pipe",
        stderr: "ignore",
        detached: true,
      });

      let siblingPid: number | undefined;
      let workerPid: number | undefined;
      let ready = false;

      for await (const { chunk } of createProcessOutput(
        fixtureProcess.stdout,
        {},
      ).text()) {
        for (const rawLine of Bun.stripANSI(chunk).split("\n")) {
          const line = rawLine.trim();
          if (line.startsWith("SIBLING:")) {
            siblingPid = parseInt(line.slice("SIBLING:".length), 10);
          } else if (line.startsWith("WORKER:")) {
            workerPid = parseInt(line.slice("WORKER:".length), 10);
          } else if (line === "READY") {
            ready = true;
          }
        }
        if (ready) break;
      }

      expect(siblingPid).toBeGreaterThan(0);
      expect(workerPid).toBeGreaterThan(0);
      expect(await pidExists(siblingPid!)).toBe(true);
      expect(await pidExists(workerPid!)).toBe(true);

      try {
        // SIGTERM the fixture only — Bun.Subprocess.kill targets the pid,
        // not the pgid, mirroring what an external runner (e.g. vitest)
        // does to its workers during shutdown.
        fixtureProcess.kill("SIGTERM");
        await fixtureProcess.exited;

        // Allow signal delivery to settle.
        await Bun.sleep(150);

        // The tracked worker (and its tree) must die — that's the cleanup
        // guarantee preserved by per-pgid kill in the registry sweep.
        expect(await pidExists(workerPid!)).toBe(false);

        // The sibling shares the fixture's pgid but is NOT a tracked
        // subprocess. Pre-fix, kill(0, SIGTERM) inside the exit handler
        // would have signalled it; post-fix, only the fixture itself is
        // re-signalled, so the sibling must still be alive.
        expect(await pidExists(siblingPid!)).toBe(true);
      } finally {
        if (siblingPid && (await pidExists(siblingPid))) {
          try {
            process.kill(siblingPid, "SIGKILL");
          } catch {
            /* already gone */
          }
        }
      }
    },
    { timeout: 10000 },
  );
});
