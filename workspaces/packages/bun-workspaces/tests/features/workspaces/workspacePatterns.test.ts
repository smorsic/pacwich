import { describe, expect, test } from "bun:test";
import type { Workspace } from "../../../src/workspaces";
import {
  matchWorkspacesByPatterns,
  parseWorkspacePattern,
  WORKSPACE_PATTERN_ERRORS,
} from "../../../src/workspaces/workspacePattern";
import { makeTestWorkspace } from "../../util/testData";

const workspaces: Workspace[] = [
  makeTestWorkspace({
    name: "application-1a",
    path: "applications/applicationA",
    aliases: ["appA"],
    tags: ["app", "frontend"],
  }),
  makeTestWorkspace({
    name: "application-1b",
    path: "applications/applicationB",
    aliases: ["appB"],
    tags: ["app", "backend"],
  }),
  makeTestWorkspace({
    name: "library-1a",
    path: "libraries/libraryA",
    aliases: ["libA"],
    tags: ["lib", "frontend"],
  }),
  makeTestWorkspace({
    name: "library-1b",
    path: "libraries/libraryB",
    aliases: ["libB"],
    tags: ["lib", "backend"],
  }),
];

const names = (matches: Workspace[]) => matches.map((w) => w.name);

describe("parseWorkspacePattern - regex prefix", () => {
  test("re: at start uses default target with regex", () => {
    expect(parseWorkspacePattern("re:app.*")).toEqual({
      target: "default",
      value: "app.*",
      isNegated: false,
      isRegex: true,
      isRootSelector: false,
    });
  });

  test("target:re: uses that target with regex", () => {
    expect(parseWorkspacePattern("name:re:^app")).toEqual({
      target: "name",
      value: "^app",
      isNegated: false,
      isRegex: true,
      isRootSelector: false,
    });
    expect(parseWorkspacePattern("alias:re:.*A$")).toEqual({
      target: "alias",
      value: ".*A$",
      isNegated: false,
      isRegex: true,
      isRootSelector: false,
    });
    expect(parseWorkspacePattern("path:re:libraries/.*")).toEqual({
      target: "path",
      value: "libraries/.*",
      isNegated: false,
      isRegex: true,
      isRootSelector: false,
    });
    expect(parseWorkspacePattern("tag:re:.*end$")).toEqual({
      target: "tag",
      value: ".*end$",
      isNegated: false,
      isRegex: true,
      isRootSelector: false,
    });
  });

  test("re: before target makes the target literal in the regex source", () => {
    // "re:path:foo" → default-target regex over literal source "path:foo"
    expect(parseWorkspacePattern("re:path:foo")).toEqual({
      target: "default",
      value: "path:foo",
      isNegated: false,
      isRegex: true,
      isRootSelector: false,
    });
  });

  test("not:re:... is a negated default-target regex", () => {
    expect(parseWorkspacePattern("not:re:app.*")).toEqual({
      target: "default",
      value: "app.*",
      isNegated: true,
      isRegex: true,
      isRootSelector: false,
    });
  });

  test("!re:... short-form negation works", () => {
    expect(parseWorkspacePattern("!re:app.*")).toEqual({
      target: "default",
      value: "app.*",
      isNegated: true,
      isRegex: true,
      isRootSelector: false,
    });
  });

  test("not:target:re:... combines negation, target, and regex", () => {
    expect(parseWorkspacePattern("not:tag:re:^lib$")).toEqual({
      target: "tag",
      value: "^lib$",
      isNegated: true,
      isRegex: true,
      isRootSelector: false,
    });
  });

  test("re:not:... treats not: as literal regex source", () => {
    expect(parseWorkspacePattern("re:not:something")).toEqual({
      target: "default",
      value: "not:something",
      isNegated: false,
      isRegex: true,
      isRootSelector: false,
    });
  });

  test("invalid regex throws InvalidWorkspacePattern at parse time", () => {
    expect(() => parseWorkspacePattern("re:[unclosed")).toThrow(
      WORKSPACE_PATTERN_ERRORS.InvalidWorkspacePattern,
    );
    expect(() => parseWorkspacePattern("name:re:(?bad")).toThrow(
      WORKSPACE_PATTERN_ERRORS.InvalidWorkspacePattern,
    );
  });

  test("non-regex patterns still parse with isRegex=false", () => {
    expect(parseWorkspacePattern("my-workspace")).toEqual({
      target: "default",
      value: "my-workspace",
      isNegated: false,
      isRegex: false,
      isRootSelector: false,
    });
    expect(parseWorkspacePattern("path:packages/*")).toEqual({
      target: "path",
      value: "packages/*",
      isNegated: false,
      isRegex: false,
      isRootSelector: false,
    });
  });
});

describe("matchWorkspacesByPatterns - regex behavior", () => {
  test("default target regex matches against name or alias", () => {
    expect(names(matchWorkspacesByPatterns(["re:^app"], workspaces))).toEqual([
      "application-1a",
      "application-1b",
    ]);
    // alias-only match: "appA" does not start with "lib" but alias "appA" matches
    expect(names(matchWorkspacesByPatterns(["re:A$"], workspaces))).toEqual([
      "application-1a",
      "library-1a",
    ]);
  });

  test("regex is raw — unanchored by default", () => {
    // Unanchored "1a" matches both "application-1a" and "library-1a"
    expect(names(matchWorkspacesByPatterns(["re:1a"], workspaces))).toEqual([
      "application-1a",
      "library-1a",
    ]);
  });

  test("name:re: only matches against name, not alias", () => {
    // "appA" is an alias, not a name — must not match
    expect(
      names(matchWorkspacesByPatterns(["name:re:^appA$"], workspaces)),
    ).toEqual([]);
    expect(
      names(matchWorkspacesByPatterns(["name:re:^application-"], workspaces)),
    ).toEqual(["application-1a", "application-1b"]);
  });

  test("alias:re: only matches against aliases", () => {
    expect(
      names(matchWorkspacesByPatterns(["alias:re:^app"], workspaces)),
    ).toEqual(["application-1a", "application-1b"]);
    // workspace name "application-1a" should not match an alias-only regex
    expect(
      names(matchWorkspacesByPatterns(["alias:re:application"], workspaces)),
    ).toEqual([]);
  });

  test("path:re: matches against the workspace path verbatim (no slash trim, no glob)", () => {
    expect(
      names(matchWorkspacesByPatterns(["path:re:^libraries/"], workspaces)),
    ).toEqual(["library-1a", "library-1b"]);
    expect(
      names(matchWorkspacesByPatterns(["path:re:B$"], workspaces)),
    ).toEqual(["application-1b", "library-1b"]);
  });

  test("path:re: normalizes backslashes so forward-slash regex works cross-platform", () => {
    // Bypass makeTestWorkspace's withWindowsPath helper to assert the
    // normalization directly, regardless of the host platform.
    const winLikeWorkspaces: Workspace[] = [
      {
        ...workspaces[0]!,
        path: "applications\\applicationA",
      },
      {
        ...workspaces[2]!,
        path: "libraries\\libraryA",
      },
    ];
    expect(
      names(
        matchWorkspacesByPatterns(["path:re:^libraries/"], winLikeWorkspaces),
      ),
    ).toEqual(["library-1a"]);
  });

  test("tag:re: matches against any tag", () => {
    expect(
      names(matchWorkspacesByPatterns(["tag:re:^front"], workspaces)),
    ).toEqual(["application-1a", "library-1a"]);
    expect(
      names(matchWorkspacesByPatterns(["tag:re:end$"], workspaces)),
    ).toEqual(workspaces.map((w) => w.name));
  });

  test("not:re:... excludes matches", () => {
    expect(
      names(matchWorkspacesByPatterns(["*", "not:re:^library"], workspaces)),
    ).toEqual(["application-1a", "application-1b"]);
  });

  test("re: combines with other patterns as a union", () => {
    expect(
      names(
        matchWorkspacesByPatterns(
          ["re:^library-1a$", "application-1b"],
          workspaces,
        ),
      ),
    ).toEqual(["library-1a", "application-1b"]);
  });

  test("re:path:foo without preceding target becomes a default-target regex with literal source", () => {
    // Default target only checks name/alias — no workspace has "path:" in its name/alias
    expect(
      names(matchWorkspacesByPatterns(["re:path:applications"], workspaces)),
    ).toEqual([]);
  });

  test("invalid regex surfaces InvalidWorkspacePattern", () => {
    expect(() => matchWorkspacesByPatterns(["re:[bad"], workspaces)).toThrow(
      WORKSPACE_PATTERN_ERRORS.InvalidWorkspacePattern,
    );
  });
});

describe("parseWorkspacePattern - root selector", () => {
  test("@root parses as a root selector", () => {
    expect(parseWorkspacePattern("@root")).toEqual({
      target: "default",
      value: "@root",
      isNegated: false,
      isRegex: false,
      isRootSelector: true,
    });
  });

  test("not:@root parses as a negated root selector", () => {
    expect(parseWorkspacePattern("not:@root")).toEqual({
      target: "default",
      value: "@root",
      isNegated: true,
      isRegex: false,
      isRootSelector: true,
    });
  });

  test("!@root short form also parses as a negated root selector", () => {
    expect(parseWorkspacePattern("!@root")).toEqual({
      target: "default",
      value: "@root",
      isNegated: true,
      isRegex: false,
      isRootSelector: true,
    });
  });

  test("target-scoped @root is treated as a literal value, not the selector", () => {
    expect(parseWorkspacePattern("name:@root")).toEqual({
      target: "name",
      value: "@root",
      isNegated: false,
      isRegex: false,
      isRootSelector: false,
    });
    expect(parseWorkspacePattern("tag:@root")).toEqual({
      target: "tag",
      value: "@root",
      isNegated: false,
      isRegex: false,
      isRootSelector: false,
    });
  });

  test("re:@root is a regex with literal '@root' source, not the selector", () => {
    expect(parseWorkspacePattern("re:@root")).toEqual({
      target: "default",
      value: "@root",
      isNegated: false,
      isRegex: true,
      isRootSelector: false,
    });
  });
});

describe("matchWorkspacesByPatterns - root selector", () => {
  const rootWorkspace = makeTestWorkspace({
    name: "test-root",
    isRoot: true,
    path: "",
    matchPattern: "",
    aliases: ["root-alias"],
    tags: ["root-tag"],
  });

  test("@root matches the provided root workspace even when not in input", () => {
    expect(
      names(matchWorkspacesByPatterns(["@root"], workspaces, rootWorkspace)),
    ).toEqual(["test-root"]);
  });

  test("@root yields nothing when no rootWorkspace is provided", () => {
    expect(names(matchWorkspacesByPatterns(["@root"], workspaces))).toEqual([]);
  });

  test("@root combines with other patterns", () => {
    expect(
      names(
        matchWorkspacesByPatterns(
          ["application-1a", "@root"],
          workspaces,
          rootWorkspace,
        ),
      ),
    ).toEqual(["application-1a", "test-root"]);
  });

  test("@root dedupes when root is also in the workspaces array", () => {
    const workspacesWithRoot = [...workspaces, rootWorkspace];
    expect(
      names(
        matchWorkspacesByPatterns(
          ["@root", "@root"],
          workspacesWithRoot,
          rootWorkspace,
        ),
      ),
    ).toEqual(["test-root"]);
  });

  test("not:@root excludes the root workspace from the include set", () => {
    const workspacesWithRoot = [...workspaces, rootWorkspace];
    expect(
      names(
        matchWorkspacesByPatterns(
          ["*", "not:@root"],
          workspacesWithRoot,
          rootWorkspace,
        ),
      ),
    ).toEqual(workspaces.map((w) => w.name));
  });

  test("!@root short form negates the root selector", () => {
    expect(
      names(
        matchWorkspacesByPatterns(
          ["@root", "!@root"],
          workspaces,
          rootWorkspace,
        ),
      ),
    ).toEqual([]);
  });

  test("target-scoped @root does not match the root workspace as a selector", () => {
    // "name:@root" treats "@root" as a literal name — no workspace is named "@root"
    expect(
      names(
        matchWorkspacesByPatterns(["name:@root"], workspaces, rootWorkspace),
      ),
    ).toEqual([]);
  });
});
