import { resolvePackageManagerAdapter } from "../../../../src/packageManager/adapter";
import { describeEachPm } from "../../../util/pmMatrix";
import { describe, expect, test } from "../../../util/testFramework";

/**
 * Covers `isDependencyVersionWorkspaceFallback` and `resolveCatalogReference`. The
 * cross-PM contract is: a dep with no matching workspace is never a
 * workspace dep. The `workspace:` prefix is capability-gated (bun
 * and pnpm accept it; npm rejects it at install time so pacwich
 * does too). Vanilla semver matching is also capability-gated
 * (`semverWorkspaceMatch`): bun and npm link locally when the name
 * matches and the range satisfies the workspace's version; pnpm's
 * static fallback does NOT — only the `workspace:` prefix links there.
 *
 * These cases exercise the STATIC `isDependencyVersionWorkspaceFallback` heuristic
 * (the no-lockfile fallback) only. Lockfile-driven classification —
 * which links pnpm semver deps under `linkWorkspacePackages: true` —
 * is covered in `workspaceLinks.test.ts` and the per-backend bucket.
 *
 * Per-backend specifics of how these refs are encoded in package.json
 * are tested in the per-backend bucket.
 */

describeEachPm("adapter conformance: version refs", ({ pm }) => {
  const adapter = resolvePackageManagerAdapter(pm.id);

  describe("isDependencyVersionWorkspaceFallback", () => {
    const candidate = (version?: string) => ({ name: "wsa", version });

    test("returns false when candidateWorkspace is null (no name match)", () => {
      expect(
        adapter.isDependencyVersionWorkspaceFallback({
          depName: "wsa",
          rawVersion: "*",
          candidateWorkspace: null,
        }),
      ).toBe(false);
    });

    test.if(pm.capabilities.semverWorkspaceMatch)(
      "returns true for '*' against a workspace with a version (semverWorkspaceMatch)",
      () => {
        expect(
          adapter.isDependencyVersionWorkspaceFallback({
            depName: "wsa",
            rawVersion: "*",
            candidateWorkspace: candidate("1.0.0"),
          }),
        ).toBe(true);
      },
    );

    test.if(pm.capabilities.semverWorkspaceMatch)(
      "returns true for '*' even when the workspace has no version (semverWorkspaceMatch)",
      () => {
        expect(
          adapter.isDependencyVersionWorkspaceFallback({
            depName: "wsa",
            rawVersion: "*",
            candidateWorkspace: candidate(undefined),
          }),
        ).toBe(true);
      },
    );

    test.if(pm.capabilities.semverWorkspaceMatch)(
      "returns true for an exact-version match (semverWorkspaceMatch)",
      () => {
        expect(
          adapter.isDependencyVersionWorkspaceFallback({
            depName: "wsa",
            rawVersion: "1.0.0",
            candidateWorkspace: candidate("1.0.0"),
          }),
        ).toBe(true);
      },
    );

    test.if(pm.capabilities.semverWorkspaceMatch)(
      "returns true for a satisfying caret range (semverWorkspaceMatch)",
      () => {
        expect(
          adapter.isDependencyVersionWorkspaceFallback({
            depName: "wsa",
            rawVersion: "^1.0.0",
            candidateWorkspace: candidate("1.2.3"),
          }),
        ).toBe(true);
      },
    );

    test("returns false for a range that does not satisfy the workspace's version", () => {
      expect(
        adapter.isDependencyVersionWorkspaceFallback({
          depName: "wsa",
          rawVersion: "^2.0.0",
          candidateWorkspace: candidate("1.0.0"),
        }),
      ).toBe(false);
    });

    test("returns false when the workspace has no version and the range isn't '*'", () => {
      expect(
        adapter.isDependencyVersionWorkspaceFallback({
          depName: "wsa",
          rawVersion: "1.0.0",
          candidateWorkspace: candidate(undefined),
        }),
      ).toBe(false);
    });

    test.if(!pm.capabilities.semverWorkspaceMatch)(
      "returns false for vanilla semver matches when semverWorkspaceMatch is disabled",
      () => {
        // pnpm's static fallback (no lockfile) matches only the
        // `workspace:` prefix, so a vanilla range does NOT link here
        // even when the name and version line up. With a lockfile, the
        // lockfile resolver would catch a semver-linked dep instead.
        expect(
          adapter.isDependencyVersionWorkspaceFallback({
            depName: "wsa",
            rawVersion: "*",
            candidateWorkspace: candidate("1.0.0"),
          }),
        ).toBe(false);
        expect(
          adapter.isDependencyVersionWorkspaceFallback({
            depName: "wsa",
            rawVersion: "^1.0.0",
            candidateWorkspace: candidate("1.2.3"),
          }),
        ).toBe(false);
      },
    );

    test.if(pm.capabilities.workspaceProtocol)(
      "returns true for `workspace:*` (workspaceProtocol capability)",
      () => {
        expect(
          adapter.isDependencyVersionWorkspaceFallback({
            depName: "wsa",
            rawVersion: "workspace:*",
            candidateWorkspace: candidate("1.0.0"),
          }),
        ).toBe(true);
      },
    );

    test.if(pm.capabilities.workspaceProtocol)(
      "returns true for `workspace:^1.0.0` (workspaceProtocol capability)",
      () => {
        expect(
          adapter.isDependencyVersionWorkspaceFallback({
            depName: "wsa",
            rawVersion: "workspace:^1.0.0",
            candidateWorkspace: candidate("1.0.0"),
          }),
        ).toBe(true);
      },
    );

    test.if(!pm.capabilities.workspaceProtocol)(
      "returns false for `workspace:*` when the PM doesn't support the protocol",
      () => {
        expect(
          adapter.isDependencyVersionWorkspaceFallback({
            depName: "wsa",
            rawVersion: "workspace:*",
            candidateWorkspace: candidate("1.0.0"),
          }),
        ).toBe(false);
      },
    );
  });

  describe("resolveCatalogReference", () => {
    test("returns null for a non-catalog version", () => {
      expect(
        adapter.resolveCatalogReference({
          packageName: "lodash",
          rawVersion: "^4.17.0",
          catalogs: { defaultCatalog: {}, namedCatalogs: {} },
        }),
      ).toBeNull();
    });

    test.if(pm.capabilities.catalogs)(
      "resolves `catalog:` to the default-catalog version (catalog.name='')",
      () => {
        const result = adapter.resolveCatalogReference({
          packageName: "lodash",
          rawVersion: "catalog:",
          catalogs: {
            defaultCatalog: { lodash: "^4.17.0" },
            namedCatalogs: {},
          },
        });
        expect(result).toEqual({
          catalog: { name: "" },
          version: "^4.17.0",
        });
      },
    );

    test.if(pm.capabilities.catalogs)(
      "resolves `catalog:<name>` to the named-catalog version",
      () => {
        const result = adapter.resolveCatalogReference({
          packageName: "react",
          rawVersion: "catalog:react17",
          catalogs: {
            defaultCatalog: {},
            namedCatalogs: { react17: { react: "^17.0.0" } },
          },
        });
        expect(result).toEqual({
          catalog: { name: "react17" },
          version: "^17.0.0",
        });
      },
    );

    test.if(pm.capabilities.catalogs)(
      "returns version='' when the ref is recognized but the package isn't in the catalog",
      () => {
        const result = adapter.resolveCatalogReference({
          packageName: "missing",
          rawVersion: "catalog:nope",
          catalogs: { defaultCatalog: {}, namedCatalogs: {} },
        });
        expect(result).toEqual({ catalog: { name: "nope" }, version: "" });
      },
    );
  });
});
