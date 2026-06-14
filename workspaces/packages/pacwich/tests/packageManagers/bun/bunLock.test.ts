import path from "path";
import {
  BUN_LOCK_ERRORS,
  parseBunLock,
  readBunLockfile,
  type RelevantBunLock,
} from "../../../src/packageManager/backends/bun/lockfile/parseBunLock";
import { describe, test, expect } from "../../util/testFramework";

const rootDirectory = process.env.PACWICH_PROJECT_PATH as string;

describe("bun.lock utilities", () => {
  describe("parseBunLock", () => {
    test("parses minimal JSONC lockfile", () => {
      expect(
        parseBunLock(`{
        "lockfileVersion": 1, // this is jsonc
        /* this is jsonc */
      }`),
      ).toEqual({
        lockfileVersion: 1,
        workspaces: {},
      });
    });

    test("parses lockfile with workspaces", () => {
      expect(
        parseBunLock(`{
      "lockfileVersion": 1, // this is jsonc
      /* this is jsonc */
      "workspaces": {
        "application-a": {
          "name": "application-a"
        }
      }
    }`),
      ).toEqual({
        lockfileVersion: 1,
        workspaces: {
          "application-a": {
            name: "application-a",
          },
        },
      });
    });

    test("returns error for malformed JSON", () => {
      expect(
        parseBunLock(`{
        "lockfileVersion": 1, // this is jsonc
        /* this is jsonc */
      `),
      ).toBeInstanceOf(BUN_LOCK_ERRORS.MalformedBunLock);
    });

    test("returns error for non-object JSON types", () => {
      expect(parseBunLock(`[]`)).toBeInstanceOf(
        BUN_LOCK_ERRORS.MalformedBunLock,
      );
      expect(parseBunLock(`1`)).toBeInstanceOf(
        BUN_LOCK_ERRORS.MalformedBunLock,
      );
      expect(parseBunLock(`null`)).toBeInstanceOf(
        BUN_LOCK_ERRORS.MalformedBunLock,
      );
    });

    test("parses a newer-than-supported version leniently", () => {
      // Versions above the supported max are parsed anyway (the version
      // is clamped to the max) on the bet that the shape we read stayed
      // compatible. parseBunLock logs a warning in this case.
      expect(
        parseBunLock(`{
        /* this is jsonc */
        "lockfileVersion": 2, // this is jsonc
      }`),
      ).toEqual({
        lockfileVersion: 1,
        workspaces: {},
      });
    });

    test("returns error for older-than-supported version", () => {
      expect(
        parseBunLock(`{
        /* this is jsonc */
        "lockfileVersion": -1, // this is jsonc
      }`),
      ).toBeInstanceOf(BUN_LOCK_ERRORS.UnsupportedBunLockVersion);
    });

    test("returns malformed error for missing lockfile version", () => {
      expect(
        parseBunLock(`{
        /* this is jsonc */
      }`),
      ).toBeInstanceOf(BUN_LOCK_ERRORS.MalformedBunLock);

      expect(
        (
          parseBunLock(`{
        /* this is jsonc */
      }`) as Error
        ).message,
      ).toContain("could not find property lockfileVersion");
    });
  });

  describe("readBunLockfile", () => {
    test("returns error for nonexistent path", () => {
      expect(readBunLockfile("does-not-exist")).toBeInstanceOf(
        BUN_LOCK_ERRORS.BunLockNotFound,
      );
    });

    test("reads project lockfile from directory", () => {
      const projectBunLock = readBunLockfile(rootDirectory) as RelevantBunLock;

      expect(projectBunLock).toEqual({
        lockfileVersion: 1,
        workspaces: expect.any(Object),
      });

      const {
        "workspaces/packages/pacwich": pacwich,
        "workspaces/web/documentation-website": documentationWebsite,
      } = projectBunLock.workspaces;

      expect({ pacwich, documentationWebsite }).toEqual({
        pacwich: expect.any(Object),
        documentationWebsite: expect.any(Object),
      });

      expect(
        projectBunLock.workspaces["workspaces/packages/pacwich"].name,
      ).toBe("pacwich");
      expect(
        projectBunLock.workspaces["workspaces/web/documentation-website"].name,
      ).toBe("@pacwich/documentation-website");
    });

    test("reads project lockfile from file path", () => {
      const projectBunLock = readBunLockfile(rootDirectory) as RelevantBunLock;

      expect(readBunLockfile(path.join(rootDirectory, "bun.lock"))).toEqual(
        projectBunLock,
      );
    });
  });
});
