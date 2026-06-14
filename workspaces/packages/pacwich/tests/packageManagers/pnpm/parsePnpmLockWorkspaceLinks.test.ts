import { PacwichError } from "../../../src/internal/core";
import { PNPM_ERRORS } from "../../../src/packageManager/backends/pnpm";
import {
  type PnpmWorkspaceLinkMap,
  parsePnpmLockWorkspaceLinks,
} from "../../../src/packageManager/backends/pnpm/pnpmLock";
import { describe, expect, test } from "../../util/testFramework";

/**
 * Tests for `parsePnpmLockWorkspaceLinks` — derives, per importer
 * (consuming workspace), which deps pnpm resolved to a local workspace
 * (`version: link:…`) vs the registry. This is the source of truth that
 * lets pacwich classify semver-ranged deps linked under
 * `linkWorkspacePackages: true`, which the static heuristic can't.
 */
describe("parsePnpmLockWorkspaceLinks", () => {
  test("classifies a plain-semver dep with a link: version as a link", () => {
    const lock = `lockfileVersion: '9.0'

importers:
  .: {}

  packages/pkg-a: {}

  packages/pkg-b:
    dependencies:
      pkg-a:
        specifier: ^1.0.0
        version: link:../pkg-a
`;
    const result = parsePnpmLockWorkspaceLinks(lock) as PnpmWorkspaceLinkMap;
    expect(result.get("packages/pkg-b")?.get("pkg-a")).toBe(true);
  });

  test("classifies a registry-resolved dep as not a link", () => {
    const lock = `lockfileVersion: '9.0'

importers:
  .: {}

  packages/pkg-b:
    dependencies:
      lodash:
        specifier: ^4.0.0
        version: 4.17.21
`;
    const result = parsePnpmLockWorkspaceLinks(lock) as PnpmWorkspaceLinkMap;
    expect(result.get("packages/pkg-b")?.get("lodash")).toBe(false);
  });

  test("covers devDependencies and optionalDependencies groups", () => {
    const lock = `lockfileVersion: '9.0'

importers:
  .: {}

  packages/pkg-b:
    devDependencies:
      pkg-c:
        specifier: workspace:*
        version: link:../pkg-c
    optionalDependencies:
      pkg-d:
        specifier: '*'
        version: link:../pkg-d
`;
    const result = parsePnpmLockWorkspaceLinks(lock) as PnpmWorkspaceLinkMap;
    expect(result.get("packages/pkg-b")?.get("pkg-c")).toBe(true);
    expect(result.get("packages/pkg-b")?.get("pkg-d")).toBe(true);
  });

  test("normalizes the root importer key '.' to ''", () => {
    const lock = `lockfileVersion: '9.0'

importers:
  .:
    dependencies:
      pkg-a:
        specifier: ^1.0.0
        version: link:packages/pkg-a
`;
    const result = parsePnpmLockWorkspaceLinks(lock) as PnpmWorkspaceLinkMap;
    expect(result.has("")).toBe(true);
    expect(result.get("")?.get("pkg-a")).toBe(true);
  });

  test("records an empty dep map for importers with no deps", () => {
    const lock = `lockfileVersion: '9.0'

importers:
  .: {}

  packages/pkg-a: {}
`;
    const result = parsePnpmLockWorkspaceLinks(lock) as PnpmWorkspaceLinkMap;
    expect(result.get("packages/pkg-a")?.size).toBe(0);
  });

  test("returns MalformedPnpmLock for invalid YAML", () => {
    const result = parsePnpmLockWorkspaceLinks("::: not valid yaml :::");
    expect(result).toBeInstanceOf(PNPM_ERRORS.MalformedPnpmLock);
    expect(result).toBeInstanceOf(PacwichError);
  });
});
