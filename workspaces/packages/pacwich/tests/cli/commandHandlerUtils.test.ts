import {
  createScriptInfoLines,
  createWorkspaceInfoLines,
  splitWhitespaceArg,
} from "../../src/cli/commands/commandHandlerUtils";
import type { Workspace } from "../../src/workspaces";
import { describe, expect, test } from "../util/testFramework";

describe("splitWhitespaceArg", () => {
  test("returns an empty array for empty string", () => {
    expect(splitWhitespaceArg("")).toEqual([]);
  });

  test("returns an empty array for whitespace-only input", () => {
    expect(splitWhitespaceArg("   \n\t  ")).toEqual([]);
  });

  test("splits a single space-separated string", () => {
    expect(splitWhitespaceArg("a b c")).toEqual(["a", "b", "c"]);
  });

  test("splits a newline-separated string (matches `$(pacwich ls-affected)` output)", () => {
    expect(splitWhitespaceArg("a\nb\nc")).toEqual(["a", "b", "c"]);
  });

  test("splits a tab-separated string", () => {
    expect(splitWhitespaceArg("a\tb\tc")).toEqual(["a", "b", "c"]);
  });

  test("collapses runs of mixed whitespace", () => {
    expect(splitWhitespaceArg("a   b\n\n  c\t\td")).toEqual([
      "a",
      "b",
      "c",
      "d",
    ]);
  });

  test("trims leading and trailing whitespace", () => {
    expect(splitWhitespaceArg("\n\n  a\nb  \n")).toEqual(["a", "b"]);
  });

  test("preserves a backslash-escaped space within a value", () => {
    expect(splitWhitespaceArg("foo\\ bar baz")).toEqual(["foo bar", "baz"]);
  });

  test("preserves multiple backslash-escaped spaces in one value", () => {
    expect(splitWhitespaceArg("a\\ b\\ c d")).toEqual(["a b c", "d"]);
  });

  test("returns a single value when input has no whitespace", () => {
    expect(splitWhitespaceArg("path:packages/**/*")).toEqual([
      "path:packages/**/*",
    ]);
  });

  test("preserves negation prefix and pattern specifiers", () => {
    expect(
      splitWhitespaceArg("not:tag:app\nalias:my-*\npath:packages/**/*"),
    ).toEqual(["not:tag:app", "alias:my-*", "path:packages/**/*"]);
  });

  test("handles realistic mixed input combining newlines and escaped spaces", () => {
    expect(
      splitWhitespaceArg("workspace-a\npath:packages/with\\ space/*\nname:b"),
    ).toEqual(["workspace-a", "path:packages/with space/*", "name:b"]);
  });
});

describe("output sanitization of external workspace fields", () => {
  const buildWorkspace = (overrides: Partial<Workspace> = {}): Workspace => ({
    name: "good-name",
    isRoot: false,
    path: "packages/good",
    matchPattern: "packages/*",
    scripts: ["build"],
    aliases: [],
    tags: [],
    dependencies: [],
    dependents: [],
    externalDependencies: [],
    ...overrides,
  });

  test("createWorkspaceInfoLines strips ANSI and C0 controls from every field", () => {
    const evil = "\x1b[2J\x1b[H\x07";
    const lines = createWorkspaceInfoLines(
      buildWorkspace({
        name: `${evil}name`,
        path: `${evil}packages/p`,
        matchPattern: `${evil}packages/*`,
        scripts: [`${evil}build`, "lint"],
        aliases: [`${evil}aa`, "bb"],
        tags: [`${evil}t1`, "t2"],
        dependencies: [`${evil}dep`],
        dependents: [`${evil}dependent`],
      }),
    );
    const joined = lines.join("\n");
    expect(joined).not.toContain("\x1b");
    expect(joined).not.toContain("\x07");
    expect(joined).toContain("Workspace: name");
    expect(joined).toContain("Path: packages/p");
    expect(joined).toContain("Glob Match: packages/*");
    expect(joined).toContain("Scripts: build, lint");
    expect(joined).toContain("Aliases: aa, bb");
    expect(joined).toContain("Tags: t1, t2");
    expect(joined).toContain("Dependencies: dep");
    expect(joined).toContain("Dependents: dependent");
  });

  test("createScriptInfoLines strips ANSI and C0 controls from script and workspace names", () => {
    const evil = "\x1b[2J\x07";
    const lines = createScriptInfoLines(`${evil}build`, [
      buildWorkspace({ name: `${evil}alpha` }),
      buildWorkspace({ name: "beta" }),
    ]);
    const joined = lines.join("\n");
    expect(joined).not.toContain("\x1b");
    expect(joined).not.toContain("\x07");
    expect(joined).toContain("Script: build");
    expect(joined).toContain(" - alpha");
    expect(joined).toContain(" - beta");
  });
});
