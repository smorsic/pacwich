import { IS_BUN } from "../../src/internal/core";
import {
  detectPackageManagerVersion,
  detectViaShell,
} from "../../src/packageManager";
import { describe, expect, test } from "../util/testFramework";

/**
 * The doctor command's per-PM version probe. Each detector is
 * independent and silent on failure (returns ""), so the doctor info
 * can always render every shipped backend without `try` boilerplate
 * in the renderer.
 */
describe("detectPackageManagerVersion", () => {
  test("bun returns a non-empty version (host runtime exposes Bun.version)", async () => {
    const version = await detectPackageManagerVersion("bun");
    expect(typeof version).toBe("string");
    expect(version.length).toBeGreaterThan(0);
    expect(version).toMatch(/^\d+\.\d+\.\d+/);
  });

  test("on bun runtime, bun's version exactly matches Bun.version (no shell call)", async () => {
    if (!IS_BUN) return; // host-dependent assertion
    const version = await detectPackageManagerVersion("bun");
    expect(version).toBe(Bun.version);
  });

  test("npm returns '' when the binary cannot be resolved on PATH", async () => {
    // Deterministically exercise the detector's failure path without
    // depending on whether npm is installed: blank PATH so `execFile`
    // can't resolve the bare `npm` name and throws ENOENT, which the
    // detector swallows into "".
    const originalPath = process.env.PATH;
    process.env.PATH = "";
    try {
      const version = await detectPackageManagerVersion("npm");
      expect(version).toBe("");
    } finally {
      process.env.PATH = originalPath;
    }
  });
});

describe("detectViaShell", () => {
  test("returns the trimmed version for a real binary (bun)", async () => {
    const version = await detectViaShell("bun");
    expect(version).toMatch(/^\d+\.\d+\.\d+/);
    expect(version).toBe(version.trim());
  });

  test("returns '' for a binary that does not exist on PATH", async () => {
    const version = await detectViaShell(
      "pacwich-nonexistent-binary-for-doctor-test",
    );
    expect(version).toBe("");
  });
});
