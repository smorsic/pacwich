import {
  parseOutputBufferBytes,
  DEFAULT_OUTPUT_BUFFER_BYTES,
} from "../../../../src/runScript/outputBuffer";
import { describe, test, expect } from "../../../util/testFramework";

describe("parseOutputBufferBytes", () => {
  test("plain byte counts", () => {
    expect(parseOutputBufferBytes(1024)).toBe(1024);
    expect(parseOutputBufferBytes("1024")).toBe(1024);
    expect(parseOutputBufferBytes(1)).toBe(1);
  });

  test("human sizes (1024-based, case-insensitive)", () => {
    expect(parseOutputBufferBytes("1B")).toBe(1);
    expect(parseOutputBufferBytes("1kb")).toBe(1024);
    expect(parseOutputBufferBytes("512KB")).toBe(512 * 1024);
    expect(parseOutputBufferBytes("16MB")).toBe(16 * 1024 * 1024);
    expect(parseOutputBufferBytes("1gb")).toBe(1024 * 1024 * 1024);
    expect(parseOutputBufferBytes("1.5MB")).toBe(Math.floor(1.5 * 1024 * 1024));
    expect(parseOutputBufferBytes("16 MB")).toBe(16 * 1024 * 1024);
  });

  test("unbounded and Infinity", () => {
    expect(parseOutputBufferBytes("unbounded")).toBe(Infinity);
    expect(parseOutputBufferBytes("UNBOUNDED")).toBe(Infinity);
    expect(parseOutputBufferBytes(Infinity)).toBe(Infinity);
  });

  test("the default constant is 16 MiB", () => {
    expect(DEFAULT_OUTPUT_BUFFER_BYTES).toBe(16 * 1024 * 1024);
  });

  test("rejects invalid values", () => {
    expect(() => parseOutputBufferBytes("notasize")).toThrow();
    expect(() => parseOutputBufferBytes("10tb")).toThrow();
    expect(() => parseOutputBufferBytes("MB")).toThrow();
    expect(() => parseOutputBufferBytes("")).toThrow();
    expect(() => parseOutputBufferBytes(0)).toThrow();
    expect(() => parseOutputBufferBytes(-1)).toThrow();
    expect(() => parseOutputBufferBytes(NaN)).toThrow();
    expect(() => parseOutputBufferBytes("0")).toThrow();
    expect(() => parseOutputBufferBytes("0.4")).toThrow();
  });
});
