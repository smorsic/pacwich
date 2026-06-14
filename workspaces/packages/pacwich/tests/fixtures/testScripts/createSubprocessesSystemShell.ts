/* eslint-disable no-console */

import { createScriptExecutor } from "../../../src/runScript/scriptExecution";
import { createSubprocess } from "../../../src/runScript/subprocesses";
import { isMainModule } from "../../util/runtime";

if (isMainModule(import.meta.url)) {
  for (let i = 0; i < 2; i++) {
    // Use a compound command to force sh to fork (not exec) the sleep subprocess,
    // creating a grandchild process that the registry does not track directly.
    const { argv, cleanup } = createScriptExecutor("sleep 30; true", "system");
    const subprocess = createSubprocess(argv, {
      cwd: process.cwd(),
      env: process.env as Record<string, string>,
      stdout: "ignore",
      stderr: "ignore",
    });
    console.log(subprocess.pid.toString());
    subprocess.exited.finally(cleanup);
  }
}
