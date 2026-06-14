/* eslint-disable no-console */
import { DEFAULT_TEMP_DIR } from "../../../src/internal/core";
import { isMainModule, sleep } from "../../util/runtime";

if (isMainModule(import.meta.url)) {
  const fileName = `test-${crypto.randomUUID()}.txt`;
  const { filePath } = DEFAULT_TEMP_DIR.createFile({
    name: fileName,
    content: "from createTempFile.ts",
  });
  console.log(filePath);
  if (process.env.CRASH === "true") {
    await sleep(250);
    throw new Error("Test crash");
  }
  await sleep(500); // So file can be read before exit cleanup
}
