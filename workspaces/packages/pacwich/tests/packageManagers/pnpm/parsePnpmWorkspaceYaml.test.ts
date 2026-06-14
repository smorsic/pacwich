import { PacwichError } from "../../../src/internal/core";
import { PNPM_ERRORS } from "../../../src/packageManager/backends/pnpm";
import { parsePnpmWorkspaceYaml } from "../../../src/packageManager/backends/pnpm/pnpmWorkspaceYaml";
import { describe, expect, test } from "../../util/testFramework";

/**
 * pnpm-specific tests for `parsePnpmWorkspaceYaml` — extracts workspace
 * globs and catalog data from `pnpm-workspace.yaml`. pnpm reads
 * workspace globs ONLY from this file (NOT from
 * `package.json.workspaces`), so this is the analogue of the
 * `loadRootMetadata` parser tests on the bun and npm side.
 */
describe("parsePnpmWorkspaceYaml", () => {
  test("extracts the packages array", () => {
    const yaml = `packages:
  - "packages/*"
  - "apps/*"
`;
    const result = parsePnpmWorkspaceYaml(yaml);
    expect(result).not.toBeInstanceOf(PacwichError);
    if (result instanceof PacwichError) return;
    expect(result.packages).toEqual(["packages/*", "apps/*"]);
  });

  test("supports negation globs (leading !)", () => {
    const yaml = `packages:
  - "packages/*"
  - "!packages/excluded"
`;
    const result = parsePnpmWorkspaceYaml(yaml);
    if (result instanceof PacwichError) throw result;
    expect(result.packages).toEqual(["packages/*", "!packages/excluded"]);
  });

  test("parses the default catalog (top-level catalog key)", () => {
    const yaml = `packages:
  - "packages/*"

catalog:
  lodash: "^4.17.0"
  react: "^18.0.0"
`;
    const result = parsePnpmWorkspaceYaml(yaml);
    if (result instanceof PacwichError) throw result;
    expect(result.catalogs.defaultCatalog).toEqual({
      lodash: "^4.17.0",
      react: "^18.0.0",
    });
    expect(result.catalogs.namedCatalogs).toEqual({});
  });

  test("parses named catalogs (top-level catalogs key)", () => {
    const yaml = `packages:
  - "packages/*"

catalogs:
  react17:
    react: "^17.0.0"
  react18:
    react: "^18.0.0"
`;
    const result = parsePnpmWorkspaceYaml(yaml);
    if (result instanceof PacwichError) throw result;
    expect(result.catalogs.namedCatalogs).toEqual({
      react17: { react: "^17.0.0" },
      react18: { react: "^18.0.0" },
    });
    expect(result.catalogs.defaultCatalog).toEqual({});
  });

  test("parses catalog: and catalogs: simultaneously", () => {
    const yaml = `packages:
  - "packages/*"

catalog:
  lodash: "^4.17.0"

catalogs:
  react17:
    react: "^17.0.0"
  react18:
    react: "^18.0.0"
`;
    const result = parsePnpmWorkspaceYaml(yaml);
    if (result instanceof PacwichError) throw result;
    expect(result.catalogs.defaultCatalog).toEqual({ lodash: "^4.17.0" });
    expect(result.catalogs.namedCatalogs).toEqual({
      react17: { react: "^17.0.0" },
      react18: { react: "^18.0.0" },
    });
  });

  test("returns empty config for an empty document", () => {
    const result = parsePnpmWorkspaceYaml("");
    if (result instanceof PacwichError) throw result;
    expect(result.packages).toEqual([]);
    expect(result.catalogs.defaultCatalog).toEqual({});
    expect(result.catalogs.namedCatalogs).toEqual({});
  });

  test("rejects a top-level array", () => {
    const result = parsePnpmWorkspaceYaml("- foo\n- bar\n");
    expect(result).toBeInstanceOf(PNPM_ERRORS.MalformedPnpmWorkspaceYaml);
  });

  test("rejects a non-array packages field", () => {
    const result = parsePnpmWorkspaceYaml("packages: hello\n");
    expect(result).toBeInstanceOf(PNPM_ERRORS.MalformedPnpmWorkspaceYaml);
  });

  test("rejects non-string entries in packages", () => {
    const result = parsePnpmWorkspaceYaml("packages:\n  - 42\n  - true\n");
    expect(result).toBeInstanceOf(PNPM_ERRORS.MalformedPnpmWorkspaceYaml);
  });

  test("rejects a malformed catalog map", () => {
    const result = parsePnpmWorkspaceYaml("catalog:\n  lodash: 42\n");
    expect(result).toBeInstanceOf(PNPM_ERRORS.MalformedPnpmWorkspaceYaml);
  });

  test("rejects a malformed catalogs entry", () => {
    const result = parsePnpmWorkspaceYaml("catalogs:\n  bad:\n    react: 42\n");
    expect(result).toBeInstanceOf(PNPM_ERRORS.MalformedPnpmWorkspaceYaml);
  });

  test("skips empty-string packages entries", () => {
    const yaml = `packages:
  - "packages/*"
  - ""
  - "apps/*"
`;
    const result = parsePnpmWorkspaceYaml(yaml);
    if (result instanceof PacwichError) throw result;
    expect(result.packages).toEqual(["packages/*", "apps/*"]);
  });
});
