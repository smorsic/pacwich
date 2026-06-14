import fs from "fs";
import os from "os";
import path from "path";
import { logger } from "../../../src/internal/logger";
import {
  PACKAGE_MANAGER_DOCS_URL,
  PACKAGE_MANAGER_VALUE_ERRORS,
  resolvePackageManagerValue,
} from "../../../src/packageManager/adapter";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  spyOn,
  test,
} from "../../util/testFramework";

/**
 * Lockfile-driven auto-resolution. Concrete values pass through; the
 * `"auto"` branch probes `bun.lock`, `pnpm-lock.yaml`, and
 * `package-lock.json` in the given root directory. Order in
 * PACKAGE_MANAGER_NAMES (bun → pnpm → npm) determines the winner when
 * multiple lockfiles are present.
 */
describe("resolvePackageManagerValue", () => {
  let tmpDir: string;
  let warnSpy: ReturnType<typeof spyOn>;
  let debugSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pacwich-pm-resolve-"));
    // Stub out the log methods so the test output stays clean — return
    // type cast through `unknown` because vitest's mockImplementation
    // wants a `Log<...>` return value and we don't care to fabricate one.
    warnSpy = spyOn(logger, "warn").mockImplementation(
      (() => undefined) as unknown as typeof logger.warn,
    );
    debugSpy = spyOn(logger, "debug").mockImplementation(
      (() => undefined) as unknown as typeof logger.debug,
    );
  });

  afterEach(() => {
    warnSpy.mockRestore();
    debugSpy.mockRestore();
    fs.rmSync(tmpDir, { force: true, recursive: true });
  });

  describe("explicit values pass through unchanged", () => {
    test("bun stays bun", () => {
      expect(
        resolvePackageManagerValue({ value: "bun", rootDirectory: tmpDir }),
      ).toBe("bun");
    });

    test("npm stays npm", () => {
      expect(
        resolvePackageManagerValue({ value: "npm", rootDirectory: tmpDir }),
      ).toBe("npm");
    });

    test("pnpm stays pnpm", () => {
      expect(
        resolvePackageManagerValue({ value: "pnpm", rootDirectory: tmpDir }),
      ).toBe("pnpm");
    });

    test("explicit value never touches the lockfile or logger", () => {
      fs.writeFileSync(path.join(tmpDir, "bun.lock"), "{}");
      fs.writeFileSync(path.join(tmpDir, "pnpm-lock.yaml"), "");
      fs.writeFileSync(path.join(tmpDir, "package-lock.json"), "{}");
      resolvePackageManagerValue({ value: "npm", rootDirectory: tmpDir });
      expect(warnSpy).not.toHaveBeenCalled();
      expect(debugSpy).not.toHaveBeenCalled();
    });
  });

  describe("auto resolution", () => {
    test("defaults to 'auto' when value is omitted (no lockfile → throws)", () => {
      // Behavior matches explicit `value: "auto"`. With no lockfile,
      // auto-detection has nothing to latch onto and surfaces an
      // actionable error rather than silently picking a backend.
      expect(() =>
        resolvePackageManagerValue({ rootDirectory: tmpDir }),
      ).toThrow(PACKAGE_MANAGER_VALUE_ERRORS.PackageManagerAutoDetectFailed);
    });

    test("picks bun when only bun.lock is present", () => {
      fs.writeFileSync(path.join(tmpDir, "bun.lock"), "{}");
      expect(
        resolvePackageManagerValue({ value: "auto", rootDirectory: tmpDir }),
      ).toBe("bun");
      expect(warnSpy).not.toHaveBeenCalled();
    });

    test("picks pnpm when only pnpm-lock.yaml is present", () => {
      fs.writeFileSync(path.join(tmpDir, "pnpm-lock.yaml"), "");
      expect(
        resolvePackageManagerValue({ value: "auto", rootDirectory: tmpDir }),
      ).toBe("pnpm");
      expect(warnSpy).not.toHaveBeenCalled();
    });

    test("picks npm when only package-lock.json is present", () => {
      fs.writeFileSync(path.join(tmpDir, "package-lock.json"), "{}");
      expect(
        resolvePackageManagerValue({ value: "auto", rootDirectory: tmpDir }),
      ).toBe("npm");
      expect(warnSpy).not.toHaveBeenCalled();
    });

    test("throws an actionable error when no lockfile is present", () => {
      let caught: Error | null = null;
      try {
        resolvePackageManagerValue({ value: "auto", rootDirectory: tmpDir });
      } catch (e) {
        caught = e as Error;
      }
      expect(caught).toBeInstanceOf(
        PACKAGE_MANAGER_VALUE_ERRORS.PackageManagerAutoDetectFailed,
      );
      // Message includes install hints and the explicit-pin alternatives.
      expect(caught?.message).toInclude("Could not auto-detect");
      expect(caught?.message).toInclude("bun install");
      expect(caught?.message).toInclude("npm install");
      expect(caught?.message).toInclude("--pm");
      expect(caught?.message).toInclude("PACWICH_PACKAGE_MANAGER");
      expect(caught?.message).toInclude(PACKAGE_MANAGER_DOCS_URL);
      expect(warnSpy).not.toHaveBeenCalled();
    });

    test("warns and picks bun when bun + npm lockfiles are both present", () => {
      fs.writeFileSync(path.join(tmpDir, "bun.lock"), "{}");
      fs.writeFileSync(path.join(tmpDir, "package-lock.json"), "{}");
      const resolved = resolvePackageManagerValue({
        value: "auto",
        rootDirectory: tmpDir,
      });
      expect(resolved).toBe("bun");
      expect(warnSpy).toHaveBeenCalledTimes(1);
      const [message] = warnSpy.mock.calls[0] as [string];
      expect(message).toInclude("bun.lock");
      expect(message).toInclude("package-lock.json");
      expect(message).toInclude(PACKAGE_MANAGER_DOCS_URL);
    });

    test("picks pnpm over npm when both are present", () => {
      fs.writeFileSync(path.join(tmpDir, "pnpm-lock.yaml"), "");
      fs.writeFileSync(path.join(tmpDir, "package-lock.json"), "{}");
      const resolved = resolvePackageManagerValue({
        value: "auto",
        rootDirectory: tmpDir,
      });
      expect(resolved).toBe("pnpm");
      expect(warnSpy).toHaveBeenCalledTimes(1);
      const [message] = warnSpy.mock.calls[0] as [string];
      expect(message).toInclude("pnpm-lock.yaml");
      expect(message).toInclude("package-lock.json");
    });

    test("picks bun first when bun + pnpm + npm lockfiles are all present", () => {
      fs.writeFileSync(path.join(tmpDir, "bun.lock"), "{}");
      fs.writeFileSync(path.join(tmpDir, "pnpm-lock.yaml"), "");
      fs.writeFileSync(path.join(tmpDir, "package-lock.json"), "{}");
      const resolved = resolvePackageManagerValue({
        value: "auto",
        rootDirectory: tmpDir,
      });
      expect(resolved).toBe("bun");
      expect(warnSpy).toHaveBeenCalledTimes(1);
      const [message] = warnSpy.mock.calls[0] as [string];
      expect(message).toInclude("bun.lock");
      expect(message).toInclude("pnpm-lock.yaml");
      expect(message).toInclude("package-lock.json");
    });
  });
});
