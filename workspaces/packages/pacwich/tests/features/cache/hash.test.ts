import fs from "fs";
import { hashData, hashFile } from "../../../src/cache/hash";
import { DEFAULT_TEMP_DIR } from "../../../src/internal/core";
import { expect, test, describe } from "../../util/testFramework";

// FIPS 180-2 test vectors
const EMPTY_SHA256 =
  "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
const ABC_SHA256 =
  "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";

const createTempFileFromBytes = (name: string, bytes: Uint8Array) => {
  DEFAULT_TEMP_DIR.initialize();
  const filePath = DEFAULT_TEMP_DIR.createFilePath(name);
  fs.writeFileSync(filePath, bytes);
  return filePath;
};

describe("Cache hash utils", () => {
  describe("hashData", () => {
    test("hashes the empty string to the known vector", () => {
      expect(hashData("")).toBe(EMPTY_SHA256);
    });

    test('hashes "abc" to the known vector', () => {
      expect(hashData("abc")).toBe(ABC_SHA256);
    });

    test("hashes bytes identically to the equivalent string", () => {
      expect(hashData(new TextEncoder().encode("abc"))).toBe(ABC_SHA256);
    });

    test("produces 64 lowercase hex characters", () => {
      expect(hashData("anything")).toMatch(/^[0-9a-f]{64}$/);
    });

    test("different inputs produce different hashes", () => {
      expect(hashData("a")).not.toBe(hashData("b"));
      expect(hashData(new Uint8Array([0, 1, 2]))).not.toBe(
        hashData(new Uint8Array([0, 1, 3])),
      );
    });
  });

  describe("hashFile", () => {
    test("hashes an empty file to the known vector", async () => {
      const filePath = createTempFileFromBytes(
        "hash-empty.bin",
        new Uint8Array(),
      );
      expect(await hashFile(filePath)).toBe(EMPTY_SHA256);
    });

    test("matches hashData for the same text content", async () => {
      const content = "cache hash test content\nwith multiple lines\n";
      const filePath = createTempFileFromBytes(
        "hash-text.txt",
        new TextEncoder().encode(content),
      );
      expect(await hashFile(filePath)).toBe(hashData(content));
    });

    test("matches hashData for the same binary content", async () => {
      const bytes = new Uint8Array([0, 255, 1, 254, 2, 253, 0, 0, 128]);
      const filePath = createTempFileFromBytes("hash-binary.bin", bytes);
      expect(await hashFile(filePath)).toBe(hashData(bytes));
    });

    test("matches hashData for a multi-MB file", async () => {
      const bytes = new Uint8Array(4 * 1024 * 1024);
      for (let i = 0; i < bytes.length; i++) {
        bytes[i] = (i * 31 + (i >> 8)) % 256;
      }
      const filePath = createTempFileFromBytes("hash-large.bin", bytes);
      expect(await hashFile(filePath)).toBe(hashData(bytes));
    });

    test("rejects for a missing file", async () => {
      DEFAULT_TEMP_DIR.initialize();
      const filePath = DEFAULT_TEMP_DIR.createFilePath("hash-missing.bin");
      await expect(hashFile(filePath)).rejects.toThrow();
    });
  });
});
