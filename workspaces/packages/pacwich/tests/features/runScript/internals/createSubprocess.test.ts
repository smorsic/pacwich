import path from "path";
import { IS_LINUX, IS_WINDOWS } from "../../../../src/internal/core";
import { createProcessOutput } from "../../../../src/runScript/output/processOutput";
import {
  getModuleDir,
  readFileText,
  sleep,
  spawnDetached,
  stripANSI,
} from "../../../util/runtime";
import { describe, test, expect } from "../../../util/testFramework";

const FIXTURE_PATH = path.join(
  getModuleDir(import.meta.url),
  "../../../fixtures/testScripts/createSubprocesses.ts",
);

const SYSTEM_SHELL_FIXTURE_PATH = path.join(
  getModuleDir(import.meta.url),
  "../../../fixtures/testScripts/createSubprocessesSystemShell.ts",
);

/** Returns the direct child PIDs of a process using Linux procfs. */
const getChildPids = async (ppid: number): Promise<number[]> => {
  try {
    const content = await readFileText(`/proc/${ppid}/task/${ppid}/children`);
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

// @todo Windows support for Bun.Subprocess.kill is needed
describe.skipIf(IS_WINDOWS)("createSubprocess", () => {
  test(
    "kills registered subprocesses when main process exits via signal",
    async () => {
      // detached: true gives the fixture its own process group so that
      // process.kill(0, signal) inside the fixture does not reach the test runner.
      const fixtureProcess = spawnDetached(["bun", FIXTURE_PATH], {
        stdout: "pipe",
        stderr: "ignore",
      });

      const pids: number[] = [];
      for await (const { chunk } of createProcessOutput(
        fixtureProcess.stdout!,
        {},
      ).text()) {
        for (const line of stripANSI(chunk).split("\n")) {
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
      await sleep(100);

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

      const fixtureProcess = spawnDetached(["bun", SYSTEM_SHELL_FIXTURE_PATH], {
        stdout: "pipe",
        stderr: "ignore",
      });

      // Collect the sh PIDs printed by the fixture (one per subprocess).
      const shPids: number[] = [];
      for await (const { chunk } of createProcessOutput(
        fixtureProcess.stdout!,
        {},
      ).text()) {
        for (const line of stripANSI(chunk).split("\n")) {
          const pid = parseInt(line.trim(), 10);
          if (Number.isFinite(pid) && pid > 0) shPids.push(pid);
        }
        if (shPids.length >= 2) break;
      }

      expect(shPids).toHaveLength(2);

      // Give sh time to fork its sleep child.
      await sleep(300);

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
      await sleep(100);

      for (const pid of [...shPids, ...grandchildPids]) {
        expect(await pidExists(pid)).toBe(false);
      }
    },
    { timeout: 10000 },
  );
});
