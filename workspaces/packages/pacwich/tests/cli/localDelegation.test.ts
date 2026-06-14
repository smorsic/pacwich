import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { CLI_INVOCATION, setupCliTest } from "../util/cliTestUtils";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
} from "../util/testFramework";

const PACWICH_PKG_ROOT_UNDER_TEST = path.dirname(
  path.dirname(CLI_INVOCATION[1]!),
);

const writeFakeLocalPacwichBin = (rootDir: string, body: string): string => {
  const binDir = path.join(rootDir, "node_modules", "pacwich", "bin");
  fs.mkdirSync(binDir, { recursive: true });
  const binPath = path.join(binDir, "cli.js");
  fs.writeFileSync(binPath, body, { mode: 0o755 });
  return binPath;
};

describe("CLI local delegation", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pacwich-delegation-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { force: true, recursive: true });
  });

  test("invokes project-local bin and forwards argv + exit code", async () => {
    writeFakeLocalPacwichBin(
      tmpDir,
      `#!/usr/bin/env node
console.log("LOCAL_PACWICH_RAN", JSON.stringify(process.argv.slice(2)));
process.exit(42);
`,
    );

    const { run } = setupCliTest({ workingDirectory: tmpDir });
    const result = await run("foo", "--bar=baz");

    expect(result.exitCode).toBe(42);
    expect(result.stdout.raw).toContain("LOCAL_PACWICH_RAN");
    expect(result.stdout.raw).toContain(JSON.stringify(["foo", "--bar=baz"]));
  });

  test("walks up from a nested cwd to find the local install", async () => {
    writeFakeLocalPacwichBin(
      tmpDir,
      `#!/usr/bin/env node
console.log("NESTED_LOCAL_RAN");
process.exit(0);
`,
    );

    const nestedCwd = path.join(tmpDir, "a", "b", "c");
    fs.mkdirSync(nestedCwd, { recursive: true });

    const { run } = setupCliTest({ workingDirectory: nestedCwd });
    const result = await run("anything");

    expect(result.exitCode).toBe(0);
    expect(result.stdout.raw).toContain("NESTED_LOCAL_RAN");
  });

  test("runs the invoked bin directly when no local install is found", async () => {
    const cwdWithoutLocal = fs.mkdtempSync(
      path.join(os.tmpdir(), "pacwich-no-local-"),
    );
    try {
      const { run } = setupCliTest({ workingDirectory: cwdWithoutLocal });
      const result = await run("--version");

      expect(result.exitCode).toBe(0);
      expect(result.stdout.raw.trim()).toMatch(/^\d+\.\d+\.\d+/);
      expect(result.stdout.raw).not.toContain("LOCAL_PACWICH_RAN");
    } finally {
      fs.rmSync(cwdWithoutLocal, { force: true, recursive: true });
    }
  });

  test("PACWICH_DISABLE_LOCAL_DELEGATION=true skips delegation even when a local install is present", async () => {
    writeFakeLocalPacwichBin(
      tmpDir,
      `#!/usr/bin/env node
console.log("LOCAL_RAN_DESPITE_OPT_OUT");
process.exit(0);
`,
    );

    const { run } = setupCliTest({
      workingDirectory: tmpDir,
      env: { PACWICH_DISABLE_LOCAL_DELEGATION: "true" },
    });
    const result = await run("--version");

    expect(result.exitCode).toBe(0);
    expect(result.stdout.raw.trim()).toMatch(/^\d+\.\d+\.\d+/);
    expect(result.stdout.raw).not.toContain("LOCAL_RAN_DESPITE_OPT_OUT");
  });

  test("does not recurse when the entry script is the resolved local bin", async () => {
    // Point node_modules/pacwich at the same pacwich pkg the test runner is
    // invoking. The delegation realpath-compares the resolved local bin
    // against the entry script — when they match it must short-circuit, or
    // this would infinite-loop.
    fs.mkdirSync(path.join(tmpDir, "node_modules"), { recursive: true });
    fs.symlinkSync(
      PACWICH_PKG_ROOT_UNDER_TEST,
      path.join(tmpDir, "node_modules", "pacwich"),
      "junction",
    );

    const { run } = setupCliTest({ workingDirectory: tmpDir });
    const result = await run("--version");

    expect(result.exitCode).toBe(0);
    expect(result.stdout.raw.trim()).toMatch(/^\d+\.\d+\.\d+/);
  });
});
