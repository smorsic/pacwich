import { normalizeImportSpecifierToPackageName } from "../../../src/verify";
import { describe, expect, test } from "../../util/testFramework";

describe("normalizeImportSpecifierToPackageName", () => {
  test("plain package name passes through", () => {
    expect(normalizeImportSpecifierToPackageName("lodash")).toBe("lodash");
  });

  test("plain package with subpath is normalized to the package name", () => {
    expect(normalizeImportSpecifierToPackageName("lodash/fp")).toBe("lodash");
    expect(normalizeImportSpecifierToPackageName("lodash/fp/get")).toBe(
      "lodash",
    );
  });

  test("scoped package without subpath passes through", () => {
    expect(normalizeImportSpecifierToPackageName("@scope/pkg")).toBe(
      "@scope/pkg",
    );
  });

  test("scoped package with subpath is normalized to @scope/pkg", () => {
    expect(normalizeImportSpecifierToPackageName("@scope/pkg/sub")).toBe(
      "@scope/pkg",
    );
    expect(
      normalizeImportSpecifierToPackageName("@scope/pkg/sub/deep/path"),
    ).toBe("@scope/pkg");
  });

  test("malformed scoped name without a /name segment returns null", () => {
    expect(normalizeImportSpecifierToPackageName("@scope")).toBeNull();
  });

  test("relative imports return null", () => {
    expect(normalizeImportSpecifierToPackageName("./foo")).toBeNull();
    expect(normalizeImportSpecifierToPackageName("../foo/bar")).toBeNull();
    expect(normalizeImportSpecifierToPackageName(".")).toBeNull();
  });

  test("absolute imports return null", () => {
    expect(normalizeImportSpecifierToPackageName("/abs/path")).toBeNull();
  });

  test("protocol/URL specifiers return null", () => {
    expect(normalizeImportSpecifierToPackageName("node:fs")).toBeNull();
    expect(
      normalizeImportSpecifierToPackageName("node:fs/promises"),
    ).toBeNull();
    expect(
      normalizeImportSpecifierToPackageName("https://example.com/m.js"),
    ).toBeNull();
    expect(
      normalizeImportSpecifierToPackageName("file:///abs/path.js"),
    ).toBeNull();
  });

  test("empty string returns null", () => {
    expect(normalizeImportSpecifierToPackageName("")).toBeNull();
  });
});
