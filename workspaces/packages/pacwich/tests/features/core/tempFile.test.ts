import fs from "fs";
import os from "os";
import { DEFAULT_TEMP_DIR, IS_POSIX } from "../../../src/internal/core";
import { runScript } from "../../../src/runScript";
import { stripANSI } from "../../util/runtime";
import { expect, test, describe } from "../../util/testFramework";

describe("Temp file utils", () => {
  test.if(IS_POSIX)(
    "temp dir is created with mode 0o700 and per-user base name",
    () => {
      DEFAULT_TEMP_DIR.initialize();
      const stat = fs.statSync(DEFAULT_TEMP_DIR.dir);
      // Owner rwx only; no group/other bits.
      expect(stat.mode & 0o777).toBe(0o700);

      const { uid } = os.userInfo();
      expect(DEFAULT_TEMP_DIR.dir).toContain(`pacwich-runtime-${uid}`);
    },
  );

  test("createFile", () => {
    const { filePath, cleanup } = DEFAULT_TEMP_DIR.createFile({
      name: "test.txt",
      content: "test",
    });
    expect(fs.readFileSync(filePath, "utf8")).toBe("test");
    cleanup();
    expect(fs.existsSync(filePath)).toBe(false);
  });

  test("cleanup files", () => {
    const { filePath: a } = DEFAULT_TEMP_DIR.createFile({
      name: "a.txt",
      content: "test a",
    });
    const { filePath: b } = DEFAULT_TEMP_DIR.createFile({
      name: "b.txt",
      content: "test b",
    });
    const { filePath: c } = DEFAULT_TEMP_DIR.createFile({
      name: "c.txt",
      content: "test c",
    });

    expect(fs.readFileSync(a, "utf8")).toBe("test a");
    expect(fs.readFileSync(b, "utf8")).toBe("test b");
    expect(fs.readFileSync(c, "utf8")).toBe("test c");

    DEFAULT_TEMP_DIR.cleanup();

    expect(fs.existsSync(a)).toBe(false);
    expect(fs.existsSync(b)).toBe(false);
    expect(fs.existsSync(c)).toBe(false);
  });

  test("runScript: temp files are cleaned up on exit", async () => {
    const { exit, output } = runScript({
      scriptCommand: {
        command: "bun run ../../fixtures/testScripts/createTempFile.ts",
        workingDirectory: __dirname,
      },
      metadata: {},
      env: {},
    });

    let filePath = "";
    for await (const { chunk } of output.text()) {
      filePath = chunk.trim();
      expect(fs.readFileSync(filePath, "utf8")).toBe("from createTempFile.ts");
    }

    await exit;

    expect(fs.existsSync(filePath)).toBe(false);
  });

  test("runScript: temp files cleans up on interrupt", async () => {
    const { exit, output, kill } = runScript({
      scriptCommand: {
        command: "bun run ../../fixtures/testScripts/createTempFile.ts",
        workingDirectory: __dirname,
      },
      metadata: {},
      env: {},
    });

    let filePath = "";
    for await (const { chunk } of output.text()) {
      filePath = chunk.trim();
      expect(fs.readFileSync(filePath, "utf8")).toBe("from createTempFile.ts");
      kill("SIGINT");
    }

    await exit;

    expect(fs.existsSync(filePath)).toBe(false);
  });

  test("temp files cleans up on crash", async () => {
    const { exit, output } = runScript({
      scriptCommand: {
        command: "bun run ../../fixtures/testScripts/createTempFile.ts",
        workingDirectory: __dirname,
      },
      metadata: {},
      env: {
        CRASH: "true",
      },
    });

    let filePath = "";
    let stderr = "";
    for await (const { chunk, metadata } of output.text()) {
      if (metadata.streamName === "stderr") {
        stderr += stripANSI(chunk.trim());
        continue;
      }

      filePath = chunk.trim();
      expect(fs.readFileSync(filePath, "utf8")).toBe("from createTempFile.ts");
    }

    expect(stderr).toMatch(/error: Test crash/g);
    expect(stderr).toMatch(/throw new Error\("Test crash"\)/g);

    await exit;

    expect(fs.existsSync(filePath)).toBe(false);
  });
});
