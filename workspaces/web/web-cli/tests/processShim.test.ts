/**
 * Unit tests for the browser `process` shim, run under bun (see
 * `tests/setup.ts` for the shared fs/subprocess mocking preload).
 */
import { expect, test } from "bun:test";

test("stdout/stderr report a TTY, so pacwich's grouped output style is picked", async () => {
  const { installProcessShim } =
    await import("../src/web-cli-runtime/processShim");

  const proc = installProcessShim();

  expect(proc.stdout.isTTY).toBe(true);
  expect(proc.stderr.isTTY).toBe(true);
});

test("repeat installs return the same object, updating dimensions in place", async () => {
  const { installProcessShim } =
    await import("../src/web-cli-runtime/processShim");

  const first = installProcessShim({ columns: 40, rows: 10 });
  expect(first.stdout.columns).toBe(40);
  expect(first.stdout.rows).toBe(10);
  expect(first.stderr.columns).toBe(40);

  const second = installProcessShim({ columns: 120, rows: 45 });
  expect(second).toBe(first);
  expect(second.stdout.columns).toBe(120);
  expect(second.stdout.rows).toBe(45);
  expect(second.stderr.columns).toBe(120);
  expect(second.stderr.rows).toBe(45);
});

test("a call with no dimensions leaves the existing dimensions untouched", async () => {
  const { installProcessShim } =
    await import("../src/web-cli-runtime/processShim");

  installProcessShim({ columns: 100, rows: 40 });
  const proc = installProcessShim();

  expect(proc.stdout.columns).toBe(100);
  expect(proc.stdout.rows).toBe(40);
});

test("stdin stub tolerates the calls grouped output makes without throwing", async () => {
  const { installProcessShim } =
    await import("../src/web-cli-runtime/processShim");

  const proc = installProcessShim();

  expect(() => {
    proc.stdin.on("data", () => undefined);
    proc.stdin.setRawMode?.(true);
    proc.stdin.pause();
    proc.stdin.setRawMode?.(false);
    proc.stdin.unref?.();
  }).not.toThrow();
});
