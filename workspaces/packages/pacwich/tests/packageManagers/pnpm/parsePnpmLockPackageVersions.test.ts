import { PacwichError } from "../../../src/internal/core";
import { PNPM_ERRORS } from "../../../src/packageManager/backends/pnpm";
import {
  type PnpmLockVersionMap,
  parsePnpmLockPackageVersions,
} from "../../../src/packageManager/backends/pnpm/pnpmLock";
import { describe, expect, test } from "../../util/testFramework";

/**
 * pnpm-specific tests for `parsePnpmLockPackageVersions` — extracts
 * `<pkg> → <resolvedVersion>` from a `pnpm-lock.yaml` v9 `packages`
 * block. The PM-agnostic comparator that consumes this output lives
 * in tests/features/affected/externalDependencyChanges.test.ts.
 */
describe("parsePnpmLockPackageVersions", () => {
  test("extracts name and version from packages keys", () => {
    const lock = `lockfileVersion: '9.0'

settings:
  autoInstallPeers: true
  excludeLinksFromLockfile: false

importers:
  .: {}

packages:

  lodash@4.17.21:
    resolution: {integrity: sha512-fake}

  react@18.0.0:
    resolution: {integrity: sha512-fake}
`;
    const result = parsePnpmLockPackageVersions(lock) as PnpmLockVersionMap;
    expect(result.get("lodash")).toBe("4.17.21");
    expect(result.get("react")).toBe("18.0.0");
  });

  test("handles scoped names (split on the last @)", () => {
    const lock = `lockfileVersion: '9.0'

importers:
  .: {}

packages:

  '@scope/foo@1.2.3':
    resolution: {integrity: sha512-fake}

  '@types/node@20.10.0':
    resolution: {integrity: sha512-fake}
`;
    const result = parsePnpmLockPackageVersions(lock) as PnpmLockVersionMap;
    expect(result.get("@scope/foo")).toBe("1.2.3");
    expect(result.get("@types/node")).toBe("20.10.0");
  });

  test("strips peer-disambiguation suffixes from package keys", () => {
    const lock = `lockfileVersion: '9.0'

importers:
  .: {}

packages:

  chalk@5.6.2(react@18.0.0):
    resolution: {integrity: sha512-fake}
`;
    const result = parsePnpmLockPackageVersions(lock) as PnpmLockVersionMap;
    expect(result.get("chalk")).toBe("5.6.2");
  });

  test("first occurrence wins for duplicate names (different peer hashes)", () => {
    const lock = `lockfileVersion: '9.0'

importers:
  .: {}

packages:

  chalk@5.6.2(a@1):
    resolution: {integrity: sha512-fake}

  chalk@5.6.5(b@2):
    resolution: {integrity: sha512-fake}
`;
    const result = parsePnpmLockPackageVersions(lock) as PnpmLockVersionMap;
    expect(result.get("chalk")).toBe("5.6.2");
  });

  test("returns an empty map when packages block is absent", () => {
    const lock = `lockfileVersion: '9.0'

importers:
  .: {}
`;
    const result = parsePnpmLockPackageVersions(lock) as PnpmLockVersionMap;
    expect(result.size).toBe(0);
  });

  test("returns MalformedPnpmLock for invalid YAML", () => {
    const result = parsePnpmLockPackageVersions("::: not valid yaml :::");
    expect(result).toBeInstanceOf(PNPM_ERRORS.MalformedPnpmLock);
    expect(result).toBeInstanceOf(PacwichError);
  });

  test("returns UnsupportedPnpmLockVersion for an old (v5) lockfile", () => {
    const lock = `lockfileVersion: 5.4

importers:
  .: {}
`;
    const result = parsePnpmLockPackageVersions(lock);
    expect(result).toBeInstanceOf(PNPM_ERRORS.UnsupportedPnpmLockVersion);
  });

  test("accepts the v6 lower boundary lockfile", () => {
    const lock = `lockfileVersion: '6.0'

importers:
  .: {}

packages:

  lodash@4.17.21:
    resolution: {integrity: sha512-fake}
`;
    const result = parsePnpmLockPackageVersions(lock) as PnpmLockVersionMap;
    expect(result.get("lodash")).toBe("4.17.21");
  });

  test("parses a too-high future version leniently (> 9)", () => {
    // Newer majors are parsed anyway on the bet that the importers/
    // packages shapes stayed compatible. parsePnpmLock logs a warning.
    const lock = `lockfileVersion: '10.0'

importers:
  .: {}

packages:

  lodash@4.17.21:
    resolution: {integrity: sha512-fake}
`;
    const result = parsePnpmLockPackageVersions(lock) as PnpmLockVersionMap;
    expect(result.get("lodash")).toBe("4.17.21");
  });

  test("accepts a numeric lockfileVersion (not just a quoted string)", () => {
    const lock = `lockfileVersion: 9

importers:
  .: {}

packages:

  lodash@4.17.21:
    resolution: {integrity: sha512-fake}
`;
    const result = parsePnpmLockPackageVersions(lock) as PnpmLockVersionMap;
    expect(result.get("lodash")).toBe("4.17.21");
  });
});
