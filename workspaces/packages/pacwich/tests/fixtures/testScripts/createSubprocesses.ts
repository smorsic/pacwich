/* eslint-disable no-console */

import { createScriptExecutor } from "../../../src/runScript/scriptExecution";
import {
  createSubprocess,
  type Subprocess,
} from "../../../src/runScript/subprocesses";
import { isMainModule } from "../../util/runtime";

if (isMainModule(import.meta.url)) {
  const cleanups: (() => void)[] = [];
  const subprocesses: Subprocess[] = [];
  for (let i = 0; i < 4; i++) {
    const { argv, cleanup } = createScriptExecutor("sleep 10", "bun");
    cleanups.push(cleanup);

    const subprocess = createSubprocess(argv, {
      cwd: process.cwd(),
      env: process.env,
      stdout: "pipe",
      stderr: "pipe",
    });

    console.log(subprocess.pid.toString());

    subprocesses.push(subprocess);
  }
}
