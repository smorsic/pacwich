import { extractFileImports } from "../../../src/verify";
import { describe, expect, test } from "../../util/testFramework";

describe("extractFileImports", () => {
  test("returns empty array for empty input", () => {
    expect(extractFileImports("")).toEqual([]);
  });

  test("returns empty array for sources with no imports", () => {
    expect(
      extractFileImports("const x = 1;\nexport const y = x + 1;\n"),
    ).toEqual([]);
  });

  test("side-effect import", () => {
    expect(extractFileImports(`import "polyfill";\n`)).toEqual([
      { specifier: "polyfill", line: 1 },
    ]);
  });

  test("default import with from", () => {
    expect(extractFileImports(`import foo from "foo-pkg";\n`)).toEqual([
      { specifier: "foo-pkg", line: 1 },
    ]);
  });

  test("named import with from", () => {
    expect(extractFileImports(`import { a, b } from "foo-pkg";\n`)).toEqual([
      { specifier: "foo-pkg", line: 1 },
    ]);
  });

  test("namespace import with from", () => {
    expect(extractFileImports(`import * as foo from "foo-pkg";\n`)).toEqual([
      { specifier: "foo-pkg", line: 1 },
    ]);
  });

  test("mixed default + named import", () => {
    expect(extractFileImports(`import foo, { bar } from "foo-pkg";\n`)).toEqual(
      [{ specifier: "foo-pkg", line: 1 }],
    );
  });

  test("type-only import", () => {
    expect(extractFileImports(`import type { Foo } from "foo-pkg";\n`)).toEqual(
      [{ specifier: "foo-pkg", line: 1 }],
    );
  });

  test("dynamic import", () => {
    expect(extractFileImports(`const m = await import("foo-pkg");\n`)).toEqual([
      { specifier: "foo-pkg", line: 1 },
    ]);
  });

  test("require call", () => {
    expect(extractFileImports(`const foo = require("foo-pkg");\n`)).toEqual([
      { specifier: "foo-pkg", line: 1 },
    ]);
  });

  test("re-export with from", () => {
    expect(extractFileImports(`export { a } from "foo-pkg";\n`)).toEqual([
      { specifier: "foo-pkg", line: 1 },
    ]);
  });

  test("export-star re-export", () => {
    expect(extractFileImports(`export * from "foo-pkg";\n`)).toEqual([
      { specifier: "foo-pkg", line: 1 },
    ]);
  });

  test("type-only re-export", () => {
    expect(extractFileImports(`export type { Foo } from "foo-pkg";\n`)).toEqual(
      [{ specifier: "foo-pkg", line: 1 }],
    );
  });

  test("export-type-star re-export", () => {
    expect(extractFileImports(`export type * from "foo-pkg";\n`)).toEqual([
      { specifier: "foo-pkg", line: 1 },
    ]);
  });

  test("single quotes work as well as double quotes", () => {
    expect(extractFileImports(`import foo from 'foo-pkg';\n`)).toEqual([
      { specifier: "foo-pkg", line: 1 },
    ]);
  });

  test("scoped package name", () => {
    expect(extractFileImports(`import { a } from "@scope/pkg";\n`)).toEqual([
      { specifier: "@scope/pkg", line: 1 },
    ]);
  });

  test("subpath imports retained verbatim", () => {
    expect(
      extractFileImports(`import { x } from "foo-pkg/lib/util";\n`),
    ).toEqual([{ specifier: "foo-pkg/lib/util", line: 1 }]);
  });

  test("reports accurate line numbers in multi-line source", () => {
    const source = [
      `// header comment`,
      `import a from "pkg-a";`,
      ``,
      `const x = 1;`,
      `import b from "pkg-b";`,
      ``,
      `export { c } from "pkg-c";`,
    ].join("\n");
    expect(extractFileImports(source)).toEqual([
      { specifier: "pkg-a", line: 2 },
      { specifier: "pkg-b", line: 5 },
      { specifier: "pkg-c", line: 7 },
    ]);
  });

  test("ignores imports inside line comments", () => {
    expect(
      extractFileImports(`// import foo from "foo-pkg";\nconst x = 1;\n`),
    ).toEqual([]);
  });

  test("ignores imports inside block comments", () => {
    const source = `/*\n  import foo from "foo-pkg";\n  require("bar-pkg");\n*/\nconst x = 1;\n`;
    expect(extractFileImports(source)).toEqual([]);
  });

  test("ignores import-like text inside string literals", () => {
    expect(
      extractFileImports(`const code = "import foo from 'foo-pkg'";\n`),
    ).toEqual([]);
  });

  test("does not match obj.import(...) as dynamic import", () => {
    expect(extractFileImports(`mod.import("foo-pkg");\n`)).toEqual([]);
  });

  test("does not match optional-chained mod?.import?.(...) as dynamic import", () => {
    expect(extractFileImports(`mod?.import?.("foo-pkg");\n`)).toEqual([]);
  });

  test("does not match myrequire(...) as require", () => {
    expect(extractFileImports(`myrequire("foo-pkg");\n`)).toEqual([]);
  });

  test("does not match obj.require(...) as require", () => {
    expect(extractFileImports(`mod.require("foo-pkg");\n`)).toEqual([]);
  });

  test("ignores require with non-string-literal argument", () => {
    expect(
      extractFileImports(`require(name);\nrequire(\`foo-\${suffix}\`);\n`),
    ).toEqual([]);
  });

  test("ignores dynamic import with non-string-literal argument", () => {
    expect(extractFileImports(`await import(name);\n`)).toEqual([]);
  });

  test("does not match export const declarations", () => {
    expect(
      extractFileImports(
        `export const greet = "hello";\nexport default "foo";\n`,
      ),
    ).toEqual([]);
  });

  test("multiple imports on same line are all captured", () => {
    expect(
      extractFileImports(`import a from "a-pkg"; import b from "b-pkg";\n`),
    ).toEqual([
      { specifier: "a-pkg", line: 1 },
      { specifier: "b-pkg", line: 1 },
    ]);
  });

  test("deduplicates exact line+specifier overlaps from multiple regex patterns", () => {
    // A single `require("foo")` should be reported once, not twice (once
    // by REQUIRE_PATTERN and again if any other pattern also caught it).
    const results = extractFileImports(`const foo = require("foo-pkg");\n`);
    expect(results.filter((r) => r.specifier === "foo-pkg")).toHaveLength(1);
  });

  test("captures both a static import and a require in the same file", () => {
    const source = [
      `import a from "pkg-a";`,
      `const b = require("pkg-b");`,
    ].join("\n");
    expect(extractFileImports(source)).toEqual([
      { specifier: "pkg-a", line: 1 },
      { specifier: "pkg-b", line: 2 },
    ]);
  });

  test("multi-line import with braced bindings, line attributed to import keyword", () => {
    const source = `import {\n  a,\n  b,\n} from "foo-pkg";\n`;
    expect(extractFileImports(source)).toEqual([
      { specifier: "foo-pkg", line: 1 },
    ]);
  });

  test("does not match strings inside template literals", () => {
    // Documented v1 limitation: contents of template literals (including
    // interpolations) are treated as opaque string content.
    expect(
      extractFileImports('const s = `import foo from "foo-pkg"`;\n'),
    ).toEqual([]);
  });

  test("escaped quote inside a string does not end the string early", () => {
    // The literal contains an escaped quote — the import-like text after
    // it is still inside the string and must not be matched.
    expect(
      extractFileImports(`const s = "a\\" import foo from \\"foo-pkg\\"";\n`),
    ).toEqual([]);
  });

  test("import preceded by identifier character is not matched (xexport)", () => {
    expect(extractFileImports(`const xexport = "foo-pkg";\n`)).toEqual([]);
  });

  test("block comment between require( and the specifier", () => {
    const source = `const x = require(/* lazy */ "foo-pkg");\n`;
    expect(extractFileImports(source)).toEqual([
      { specifier: "foo-pkg", line: 1 },
    ]);
  });

  test("multi-line require with multi-line block comment before specifier", () => {
    const source = [
      `const x = require(`,
      `  /* big`,
      `     multi-line`,
      `     comment */`,
      `  "foo-pkg"`,
      `);`,
    ].join("\n");
    expect(extractFileImports(source)).toEqual([
      { specifier: "foo-pkg", line: 1 },
    ]);
  });

  test("block comment between import keyword and from clause", () => {
    const source = `import x /* from "fake-pkg" */ from "real-pkg";\n`;
    expect(extractFileImports(source)).toEqual([
      { specifier: "real-pkg", line: 1 },
    ]);
  });

  test("block comment after specifier and before closing paren", () => {
    const source = `require("foo-pkg" /* note */);\n`;
    expect(extractFileImports(source)).toEqual([
      { specifier: "foo-pkg", line: 1 },
    ]);
  });

  test("line break between import keyword and from-quoted specifier", () => {
    const source = `import x\n  from\n  "foo-pkg";\n`;
    expect(extractFileImports(source)).toEqual([
      { specifier: "foo-pkg", line: 1 },
    ]);
  });

  test("import attributes after specifier are ignored", () => {
    const source = `import json from "data.json" with { type: "json" };\n`;
    expect(extractFileImports(source)).toEqual([
      { specifier: "data.json", line: 1 },
    ]);
  });

  test("require keyword inside string literals does not match", () => {
    const source = `const name = "require"; Symbol.for("require");\n`;
    expect(extractFileImports(source)).toEqual([]);
  });

  test("results are sorted by line, then specifier", () => {
    // add a third import to test secondary sort by specifier
    const source = [
      `import b from "pkg-b";`,
      `import c from "pkg-c";import a from "pkg-a";`,
    ].join("\n");
    expect(extractFileImports(source)).toEqual([
      { specifier: "pkg-b", line: 1 },
      { specifier: "pkg-a", line: 2 },
      { specifier: "pkg-c", line: 2 },
    ]);
  });
});
