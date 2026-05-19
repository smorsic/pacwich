/* eslint-disable no-console */

import { createScriptExecutor } from "../../../src/runScript/scriptExecution";
import { createSubprocess } from "../../../src/runScript/subprocesses";

if (import.meta.main) {
  // Sibling that shares this fixture's process group (no `detached`).
  // Pre-fix, the SIGTERM handler in onExit.ts called `process.kill(0, SIGTERM)`
  // which broadcast across the whole pgid, killing this sibling too. Post-fix,
  // only directly tracked subprocesses are signalled (each via its own pgid),
  // and the fixture re-raises the signal only on itself — so this sibling
  // must survive a SIGTERM to the fixture.
  const sibling = Bun.spawn(["sleep", "60"], {
    stdout: "ignore",
    stderr: "ignore",
    stdin: "ignore",
  });

  const { argv } = createScriptExecutor("sleep 30", "bun");
  const worker = createSubprocess(argv, {
    cwd: process.cwd(),
    env: process.env as Record<string, string>,
    stdout: "ignore",
    stderr: "ignore",
  });

  console.log(`SIBLING:${sibling.pid}`);
  console.log(`WORKER:${worker.pid}`);
  console.log("READY");
}
