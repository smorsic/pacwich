import packageJson from "../../package.json";
import { getDoctorInfo } from "../../src/doctor";
import { setupCliTest, assertOutputMatches } from "../util/cliTestUtils";
import { IS_BUN } from "../util/runtime";
import { expect, test, describe } from "../util/testFramework";

describe("CLI - doctor command", () => {
  test("shows human-readable output", async () => {
    const { run } = setupCliTest();
    const result = await run("doctor");
    expect(result.stderr.raw).toBeEmpty();
    expect(result.exitCode).toBe(0);
    assertOutputMatches(
      result.stdout.sanitizedCompactLines,
      new RegExp(
        `^pacwich
Version: ${packageJson.version}
Runtime:
 - Name: ${IS_BUN ? "bun" : "node"}`,
        "m",
      ),
    );
  });

  test("shows JSON output", async () => {
    const { run } = setupCliTest();
    const jsonResult = await run("doctor", "--json", "--pretty");
    expect(jsonResult.stderr.raw).toBeEmpty();
    expect(jsonResult.exitCode).toBe(0);
    const jsonResultObject = JSON.parse(jsonResult.stdout.raw);
    delete jsonResultObject.binary.path;
    const expectedInfo = await getDoctorInfo();
    delete (expectedInfo.binary as { path?: string }).path;
    expect(jsonResultObject).toEqual(expectedInfo);
  });

  test("works without a project", async () => {
    const { run } = setupCliTest({ testProject: "notAProject" });
    const result = await run("doctor");
    expect(result.stderr.raw).toBeEmpty();
    expect(result.exitCode).toBe(0);
    assertOutputMatches(
      result.stdout.sanitizedCompactLines,
      new RegExp(
        `^pacwich
Version: ${packageJson.version}
Runtime:
 - Name: ${IS_BUN ? "bun" : "node"}`,
        "m",
      ),
    );
  });

  describe("Package Managers section", () => {
    test("text output renders a 'Package Managers:' block", async () => {
      const { run } = setupCliTest();
      const result = await run("doctor");
      expect(result.exitCode).toBe(0);
      expect(result.stdout.sanitized).toMatch(/^Package Managers:$/m);
    });

    test("text output lists bun with a real version", async () => {
      const { run } = setupCliTest();
      const result = await run("doctor");
      expect(result.exitCode).toBe(0);
      expect(result.stdout.sanitized).toMatch(/^ - bun: \d+\.\d+\.\d+/m);
    });

    test("text output renders missing PM versions as '(none)'", async () => {
      // npm is not present in this dev/CI env; the detector emits ""
      // and the renderer must translate that to "(none)".
      const { run } = setupCliTest();
      const result = await run("doctor");
      expect(result.exitCode).toBe(0);
      // Either a real npm version OR the "(none)" sentinel; both are
      // valid (env-dependent). The renderer must never emit an empty
      // value (i.e. " - npm: " with nothing after).
      expect(result.stdout.sanitized).toMatch(
        /^ - npm: (?:\(none\)|\d+\.\d+\.\d+)/m,
      );
      expect(result.stdout.sanitized).not.toMatch(/^ - npm: $/m);
    });

    test("--json preserves raw empty strings (never '(none)')", async () => {
      const { run } = setupCliTest();
      const result = await run("doctor", "--json");
      expect(result.exitCode).toBe(0);
      const info = JSON.parse(result.stdout.raw);
      expect(info.packageManagers).toBeDefined();
      // No PM value in JSON is ever the user-facing "(none)" label.
      for (const value of Object.values(info.packageManagers)) {
        expect(value).not.toBe("(none)");
        expect(typeof value).toBe("string");
      }
    });

    test("--json includes every registered backend as a key", async () => {
      const { run } = setupCliTest();
      const result = await run("doctor", "--json");
      expect(result.exitCode).toBe(0);
      const info = JSON.parse(result.stdout.raw);
      expect(Object.keys(info.packageManagers).sort()).toEqual([
        "bun",
        "npm",
        "pnpm",
      ]);
    });
  });
});
