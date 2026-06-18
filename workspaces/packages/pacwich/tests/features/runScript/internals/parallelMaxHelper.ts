/**
 * Helper invoked by the `parallel max count` test. Records the start
 * and end timestamp of this script's body to a per-script JSON file
 * so the test can compute the maximum number of overlapping intervals
 * post-hoc rather than racing to observe peak concurrency in real time.
 *
 * Usage: bun parallelMaxHelper.ts <outputJsonPath> <sleepMs>
 */
import fs from "fs";

const [, , outputJsonPath, sleepMsArg] = process.argv;

if (!outputJsonPath || !sleepMsArg) {
  console.error("Usage: parallelMaxHelper.ts <outputJsonPath> <sleepMs>");
  process.exit(2);
}

const sleepMs = Number.parseInt(sleepMsArg, 10);
if (!Number.isFinite(sleepMs) || sleepMs < 0) {
  console.error(`Invalid sleepMs: ${sleepMsArg}`);
  process.exit(2);
}

const start = Date.now();
await new Promise<void>((resolve) => setTimeout(resolve, sleepMs));
const end = Date.now();

fs.writeFileSync(outputJsonPath, JSON.stringify({ start, end }));
