import { matchWorkspaceInputFiles } from "../../../src/inputs";
import { setLogLevel } from "../../../src/internal/logger";
import { stripANSI } from "../../util/runtime";
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  spyOn,
  test,
} from "../../util/testFramework";

/**
 * Unit tests for the package-manager-agnostic input-matching primitive
 * shared by the `affected` engine and `verify`. These pin the matching
 * contract directly (no project / git / adapter) so the behavior is
 * locked independently of either consumer.
 */
describe("matchWorkspaceInputFiles", () => {
  const filePaths = [
    "packages/a/src/index.ts",
    "packages/a/src/nested/util.ts",
    "packages/a/README.md",
    "packages/a/dist/index.js",
    "packages/b/src/index.ts",
    "root-file.ts",
  ];

  test("directory include matches files under the workspace-relative path", () => {
    const result = matchWorkspaceInputFiles({
      workspaceName: "a",
      workspacePath: "packages/a",
      inputFilePatterns: ["src"],
      projectFilePaths: filePaths,
    });
    expect(result).toEqual([
      { filePath: "packages/a/src/index.ts", inputPattern: "src" },
      { filePath: "packages/a/src/nested/util.ts", inputPattern: "src" },
    ]);
  });

  test("glob include uses glob semantics", () => {
    const result = matchWorkspaceInputFiles({
      workspaceName: "a",
      workspacePath: "packages/a",
      inputFilePatterns: ["src/**/*.ts"],
      projectFilePaths: filePaths,
    });
    expect(result.map((m) => m.filePath)).toEqual([
      "packages/a/src/index.ts",
      "packages/a/src/nested/util.ts",
    ]);
  });

  test("literal file include matches exactly that file", () => {
    const result = matchWorkspaceInputFiles({
      workspaceName: "a",
      workspacePath: "packages/a",
      inputFilePatterns: ["README.md"],
      projectFilePaths: filePaths,
    });
    expect(result).toEqual([
      { filePath: "packages/a/README.md", inputPattern: "README.md" },
    ]);
  });

  test('"." matches the entire workspace', () => {
    const result = matchWorkspaceInputFiles({
      workspaceName: "a",
      workspacePath: "packages/a",
      inputFilePatterns: ["."],
      projectFilePaths: filePaths,
    });
    expect(result.map((m) => m.filePath)).toEqual([
      "packages/a/src/index.ts",
      "packages/a/src/nested/util.ts",
      "packages/a/README.md",
      "packages/a/dist/index.js",
    ]);
  });

  test("`!`-prefixed pattern excludes matched files", () => {
    const result = matchWorkspaceInputFiles({
      workspaceName: "a",
      workspacePath: "packages/a",
      inputFilePatterns: [".", "!dist"],
      projectFilePaths: filePaths,
    });
    expect(result.map((m) => m.filePath)).toEqual([
      "packages/a/src/index.ts",
      "packages/a/src/nested/util.ts",
      "packages/a/README.md",
    ]);
  });

  test("leading `/` makes the pattern project-root-relative", () => {
    const result = matchWorkspaceInputFiles({
      workspaceName: "a",
      workspacePath: "packages/a",
      inputFilePatterns: ["/packages/b/src"],
      projectFilePaths: filePaths,
    });
    expect(result).toEqual([
      {
        filePath: "packages/b/src/index.ts",
        inputPattern: "/packages/b/src",
      },
    ]);
  });

  test("a file matching multiple includes appears once, tagged with the first match", () => {
    const result = matchWorkspaceInputFiles({
      workspaceName: "a",
      workspacePath: "packages/a",
      inputFilePatterns: ["src", "src/index.ts"],
      projectFilePaths: filePaths,
    });
    expect(result).toEqual([
      { filePath: "packages/a/src/index.ts", inputPattern: "src" },
      { filePath: "packages/a/src/nested/util.ts", inputPattern: "src" },
    ]);
  });

  test("root workspace (empty path) with `.` matches every file", () => {
    const result = matchWorkspaceInputFiles({
      workspaceName: "root",
      workspacePath: "",
      inputFilePatterns: ["."],
      projectFilePaths: filePaths,
    });
    expect(result.map((m) => m.filePath)).toEqual(filePaths);
  });

  describe("out-of-project patterns", () => {
    beforeAll(() => setLogLevel("warn"));
    afterAll(() => setLogLevel("silent"));

    test("a pattern that escapes the project root is ignored and warned", () => {
      const stderrSpy = spyOn(process.stderr, "write").mockImplementation(
        () => true,
      );

      const result = matchWorkspaceInputFiles({
        workspaceName: "a",
        workspacePath: "packages/a",
        inputFilePatterns: ["../../../external", "src"],
        projectFilePaths: [...filePaths, "external/x.ts"],
      });

      expect(result.map((m) => m.filePath)).toEqual([
        "packages/a/src/index.ts",
        "packages/a/src/nested/util.ts",
      ]);

      const warnings = stderrSpy.mock.calls
        .map((call) => stripANSI(call[0] as string))
        .filter((message) =>
          message.includes("[pacwich WARN: InputPatternOutsideProject]"),
        );
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toContain("../../../external");
      expect(warnings[0]).toContain('workspace "a"');
      expect(warnings[0]).toContain("outside the project root");

      stderrSpy.mockRestore();
    });

    test("an escaping `!`-exclusion is ignored and warned with the `!` preserved", () => {
      const stderrSpy = spyOn(process.stderr, "write").mockImplementation(
        () => true,
      );

      matchWorkspaceInputFiles({
        workspaceName: "a",
        workspacePath: "packages/a",
        inputFilePatterns: [".", "!../../../external"],
        projectFilePaths: filePaths,
      });

      const warnings = stderrSpy.mock.calls
        .map((call) => stripANSI(call[0] as string))
        .filter((message) =>
          message.includes("[pacwich WARN: InputPatternOutsideProject]"),
        );
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toContain("!../../../external");

      stderrSpy.mockRestore();
    });
  });
});
