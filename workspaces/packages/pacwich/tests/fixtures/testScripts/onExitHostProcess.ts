/* eslint-disable no-console */
import { runOnExit } from "../../../src/internal/core";
import { isMainModule } from "../../util/runtime";

if (isMainModule(import.meta.url)) {
  runOnExit(() => console.log("pacwich cleanup ran"));
  process.on("exit", () => console.log("host exit listener ran"));

  if (process.env.CRASH === "true") {
    throw new Error("Host crash");
  }

  if (process.env.SIGNAL_MODE === "host-handler") {
    let calls = 0;
    process.on("SIGINT", () => {
      calls++;
      if (calls > 1) return;
      // wait so a re-raised signal (the old double-invoke bug) would land
      setTimeout(() => {
        console.log(`host SIGINT calls: ${calls}`);
        process.exit(42);
      }, 300);
    });
    process.kill(process.pid, "SIGINT");
  } else if (process.env.SIGNAL_MODE === "no-handler") {
    setTimeout(() => {
      console.log("keep-alive expired without signal death");
      process.exit(0);
    }, 3000);
    process.kill(process.pid, "SIGTERM");
  }
}
