import { afterAll, beforeAll, describe, expect, spyOn, test } from "bun:test";
import type { Workspace } from "../../../src";
import {
  getFileAffectedWorkspaces,
  type AffectedWorkspaceInput,
  type ExternalDependencyChange,
} from "../../../src/affected";
import { setLogLevel } from "../../../src/internal/logger";
import { makeTestWorkspace } from "../../util/testData";

const ROOT_DIRECTORY = "/repo";

const makeInput = (
  data: Partial<AffectedWorkspaceInput> & { workspace: Workspace },
): AffectedWorkspaceInput => ({
  inputFilePatterns: [],
  inputWorkspacePatterns: [],
  ...data,
});

describe("getFileAffectedWorkspaces", () => {
  describe("file matching", () => {
    test("matches an exact file path", async () => {
      const workspace = makeTestWorkspace({
        name: "a",
        path: "packages/a",
      });

      const result = await getFileAffectedWorkspaces({
        rootDirectory: ROOT_DIRECTORY,
        rootWorkspace: makeTestWorkspace({ name: "root", isRoot: true }),
        workspaceInputs: [
          makeInput({ workspace, inputFilePatterns: ["src/index.ts"] }),
        ],
        changedFilePaths: [
          "packages/a/src/index.ts",
          "packages/a/src/other.ts",
        ],
      });

      expect(result.affectedWorkspaces).toEqual([
        {
          workspace,
          isAffected: true,
          affectedReasons: {
            changedFiles: [
              {
                filePath: "packages/a/src/index.ts",
                inputPattern: "src/index.ts",
                fileMetadata: undefined,
              },
            ],
            dependencies: [],
            externalDependencies: [],
          },
        },
      ]);
    });

    test("matches a directory without a trailing slash as a prefix", async () => {
      const workspace = makeTestWorkspace({ name: "a", path: "packages/a" });

      const result = await getFileAffectedWorkspaces({
        rootDirectory: ROOT_DIRECTORY,
        rootWorkspace: makeTestWorkspace({ name: "root", isRoot: true }),
        workspaceInputs: [makeInput({ workspace, inputFilePatterns: ["src"] })],
        changedFilePaths: [
          "packages/a/src/index.ts",
          "packages/a/src/nested/deep.ts",
          "packages/a/other.ts",
        ],
      });

      expect(result.affectedWorkspaces[0].affectedReasons.changedFiles).toEqual(
        [
          {
            filePath: "packages/a/src/index.ts",
            inputPattern: "src",
            fileMetadata: undefined,
          },
          {
            filePath: "packages/a/src/nested/deep.ts",
            inputPattern: "src",
            fileMetadata: undefined,
          },
        ],
      );
    });

    test("matches a directory with a trailing slash as a prefix", async () => {
      const workspace = makeTestWorkspace({ name: "a", path: "packages/a" });

      const result = await getFileAffectedWorkspaces({
        rootDirectory: ROOT_DIRECTORY,
        rootWorkspace: makeTestWorkspace({ name: "root", isRoot: true }),
        workspaceInputs: [
          makeInput({ workspace, inputFilePatterns: ["src/"] }),
        ],
        changedFilePaths: ["packages/a/src/index.ts", "packages/a/other.ts"],
      });

      expect(result.affectedWorkspaces[0].affectedReasons.changedFiles).toEqual(
        [
          {
            filePath: "packages/a/src/index.ts",
            inputPattern: "src/",
            fileMetadata: undefined,
          },
        ],
      );
    });

    test("matches a glob pattern", async () => {
      const workspace = makeTestWorkspace({ name: "a", path: "packages/a" });

      const result = await getFileAffectedWorkspaces({
        rootDirectory: ROOT_DIRECTORY,
        rootWorkspace: makeTestWorkspace({ name: "root", isRoot: true }),
        workspaceInputs: [
          makeInput({ workspace, inputFilePatterns: ["src/**/*.ts"] }),
        ],
        changedFilePaths: [
          "packages/a/src/index.ts",
          "packages/a/src/nested/deep.ts",
          "packages/a/src/index.css",
          "packages/a/README.md",
        ],
      });

      expect(result.affectedWorkspaces[0].affectedReasons.changedFiles).toEqual(
        [
          {
            filePath: "packages/a/src/index.ts",
            inputPattern: "src/**/*.ts",
            fileMetadata: undefined,
          },
          {
            filePath: "packages/a/src/nested/deep.ts",
            inputPattern: "src/**/*.ts",
            fileMetadata: undefined,
          },
        ],
      );
    });

    test("matches a brace expansion glob", async () => {
      const workspace = makeTestWorkspace({ name: "a", path: "packages/a" });

      const result = await getFileAffectedWorkspaces({
        rootDirectory: ROOT_DIRECTORY,
        rootWorkspace: makeTestWorkspace({ name: "root", isRoot: true }),
        workspaceInputs: [
          makeInput({ workspace, inputFilePatterns: ["{src,lib}/**/*.ts"] }),
        ],
        changedFilePaths: [
          "packages/a/src/x.ts",
          "packages/a/lib/y.ts",
          "packages/a/test/z.ts",
        ],
      });

      expect(result.affectedWorkspaces[0].affectedReasons.changedFiles).toEqual(
        [
          {
            filePath: "packages/a/src/x.ts",
            inputPattern: "{src,lib}/**/*.ts",
            fileMetadata: undefined,
          },
          {
            filePath: "packages/a/lib/y.ts",
            inputPattern: "{src,lib}/**/*.ts",
            fileMetadata: undefined,
          },
        ],
      );
    });

    test("does not match files outside the workspace path", async () => {
      const workspace = makeTestWorkspace({ name: "a", path: "packages/a" });

      const result = await getFileAffectedWorkspaces({
        rootDirectory: ROOT_DIRECTORY,
        rootWorkspace: makeTestWorkspace({ name: "root", isRoot: true }),
        workspaceInputs: [makeInput({ workspace, inputFilePatterns: ["src"] })],
        changedFilePaths: ["packages/b/src/index.ts", "other/file.ts"],
      });

      expect(result.affectedWorkspaces[0].isAffected).toBe(false);
      expect(result.affectedWorkspaces[0].affectedReasons.changedFiles).toEqual(
        [],
      );
    });

    test("matches workspaces independently when paths overlap", async () => {
      const a = makeTestWorkspace({ name: "a", path: "packages/a" });
      const b = makeTestWorkspace({ name: "b", path: "packages/b" });

      const result = await getFileAffectedWorkspaces({
        rootDirectory: ROOT_DIRECTORY,
        rootWorkspace: makeTestWorkspace({ name: "root", isRoot: true }),
        workspaceInputs: [
          makeInput({ workspace: a, inputFilePatterns: ["src"] }),
          makeInput({ workspace: b, inputFilePatterns: ["src"] }),
        ],
        changedFilePaths: ["packages/a/src/x.ts", "packages/b/src/y.ts"],
      });

      expect(result.affectedWorkspaces[0].affectedReasons.changedFiles).toEqual(
        [
          {
            filePath: "packages/a/src/x.ts",
            inputPattern: "src",
            fileMetadata: undefined,
          },
        ],
      );
      expect(result.affectedWorkspaces[1].affectedReasons.changedFiles).toEqual(
        [
          {
            filePath: "packages/b/src/y.ts",
            inputPattern: "src",
            fileMetadata: undefined,
          },
        ],
      );
    });

    test("uses the first matching pattern when multiple patterns match a file", async () => {
      const workspace = makeTestWorkspace({ name: "a", path: "packages/a" });

      const result = await getFileAffectedWorkspaces({
        rootDirectory: ROOT_DIRECTORY,
        rootWorkspace: makeTestWorkspace({ name: "root", isRoot: true }),
        workspaceInputs: [
          makeInput({
            workspace,
            inputFilePatterns: ["src/index.ts", "src/**/*.ts"],
          }),
        ],
        changedFilePaths: ["packages/a/src/index.ts"],
      });

      expect(result.affectedWorkspaces[0].affectedReasons.changedFiles).toEqual(
        [
          {
            filePath: "packages/a/src/index.ts",
            inputPattern: "src/index.ts",
            fileMetadata: undefined,
          },
        ],
      );
    });

    test("supports multiple input patterns per workspace", async () => {
      const workspace = makeTestWorkspace({ name: "a", path: "packages/a" });

      const result = await getFileAffectedWorkspaces({
        rootDirectory: ROOT_DIRECTORY,
        rootWorkspace: makeTestWorkspace({ name: "root", isRoot: true }),
        workspaceInputs: [
          makeInput({
            workspace,
            inputFilePatterns: ["src", "package.json", "config/*.ts"],
          }),
        ],
        changedFilePaths: [
          "packages/a/src/x.ts",
          "packages/a/package.json",
          "packages/a/config/dev.ts",
          "packages/a/test/x.ts",
        ],
      });

      expect(result.affectedWorkspaces[0].affectedReasons.changedFiles).toEqual(
        [
          {
            filePath: "packages/a/src/x.ts",
            inputPattern: "src",
            fileMetadata: undefined,
          },
          {
            filePath: "packages/a/package.json",
            inputPattern: "package.json",
            fileMetadata: undefined,
          },
          {
            filePath: "packages/a/config/dev.ts",
            inputPattern: "config/*.ts",
            fileMetadata: undefined,
          },
        ],
      );
    });

    test("treats an empty input pattern as the entire workspace path", async () => {
      const workspace = makeTestWorkspace({ name: "a", path: "packages/a" });

      const result = await getFileAffectedWorkspaces({
        rootDirectory: ROOT_DIRECTORY,
        rootWorkspace: makeTestWorkspace({ name: "root", isRoot: true }),
        workspaceInputs: [makeInput({ workspace, inputFilePatterns: [""] })],
        changedFilePaths: [
          "packages/a/src/x.ts",
          "packages/a/README.md",
          "packages/b/x.ts",
        ],
      });

      expect(result.affectedWorkspaces[0].affectedReasons.changedFiles).toEqual(
        [
          {
            filePath: "packages/a/src/x.ts",
            inputPattern: "",
            fileMetadata: undefined,
          },
          {
            filePath: "packages/a/README.md",
            inputPattern: "",
            fileMetadata: undefined,
          },
        ],
      );
    });

    test("matches files for the root workspace when its path is empty", async () => {
      const root = makeTestWorkspace({
        name: "root",
        isRoot: true,
        path: "",
      });

      const result = await getFileAffectedWorkspaces({
        rootDirectory: ROOT_DIRECTORY,
        rootWorkspace: makeTestWorkspace({ name: "root", isRoot: true }),
        workspaceInputs: [
          makeInput({
            workspace: root,
            inputFilePatterns: ["package.json", "scripts/*.ts"],
          }),
        ],
        changedFilePaths: [
          "package.json",
          "scripts/build.ts",
          "packages/a/x.ts",
        ],
      });

      expect(result.affectedWorkspaces[0].affectedReasons.changedFiles).toEqual(
        [
          {
            filePath: "package.json",
            inputPattern: "package.json",
            fileMetadata: undefined,
          },
          {
            filePath: "scripts/build.ts",
            inputPattern: "scripts/*.ts",
            fileMetadata: undefined,
          },
        ],
      );
    });

    test("converts absolute changed file paths to root-relative", async () => {
      const workspace = makeTestWorkspace({ name: "a", path: "packages/a" });

      const result = await getFileAffectedWorkspaces({
        rootDirectory: "/repo",
        rootWorkspace: makeTestWorkspace({ name: "root", isRoot: true }),
        workspaceInputs: [makeInput({ workspace, inputFilePatterns: ["src"] })],
        changedFilePaths: ["/repo/packages/a/src/index.ts"],
      });

      expect(result.affectedWorkspaces[0].affectedReasons.changedFiles).toEqual(
        [
          {
            filePath: "packages/a/src/index.ts",
            inputPattern: "src",
            fileMetadata: undefined,
          },
        ],
      );
    });

    test("ignores absolute changed file paths outside the root directory", async () => {
      const workspace = makeTestWorkspace({ name: "a", path: "packages/a" });

      const result = await getFileAffectedWorkspaces({
        rootDirectory: "/repo",
        rootWorkspace: makeTestWorkspace({ name: "root", isRoot: true }),
        workspaceInputs: [makeInput({ workspace, inputFilePatterns: ["src"] })],
        changedFilePaths: ["/elsewhere/packages/a/src/index.ts"],
      });

      expect(result.affectedWorkspaces[0].isAffected).toBe(false);
    });

    test("handles a trailing slash on the root directory", async () => {
      const workspace = makeTestWorkspace({ name: "a", path: "packages/a" });

      const result = await getFileAffectedWorkspaces({
        rootDirectory: "/repo/",
        rootWorkspace: makeTestWorkspace({ name: "root", isRoot: true }),
        workspaceInputs: [makeInput({ workspace, inputFilePatterns: ["src"] })],
        changedFilePaths: ["/repo/packages/a/src/index.ts"],
      });

      expect(result.affectedWorkspaces[0].affectedReasons.changedFiles).toEqual(
        [
          {
            filePath: "packages/a/src/index.ts",
            inputPattern: "src",
            fileMetadata: undefined,
          },
        ],
      );
    });

    test("normalizes backslashes in changed file paths to forward slashes", async () => {
      const workspace = makeTestWorkspace({ name: "a", path: "packages/a" });

      const result = await getFileAffectedWorkspaces({
        rootDirectory: ROOT_DIRECTORY,
        rootWorkspace: makeTestWorkspace({ name: "root", isRoot: true }),
        workspaceInputs: [makeInput({ workspace, inputFilePatterns: ["src"] })],
        changedFilePaths: ["packages\\a\\src\\index.ts"],
      });

      expect(result.affectedWorkspaces[0].affectedReasons.changedFiles).toEqual(
        [
          {
            filePath: "packages/a/src/index.ts",
            inputPattern: "src",
            fileMetadata: undefined,
          },
        ],
      );
    });
  });

  describe("project-relative input patterns (leading `/`)", () => {
    test("matches a top-level file from a nested workspace", async () => {
      const workspace = makeTestWorkspace({ name: "a", path: "packages/a" });

      const result = await getFileAffectedWorkspaces({
        rootDirectory: ROOT_DIRECTORY,
        rootWorkspace: makeTestWorkspace({ name: "root", isRoot: true }),
        workspaceInputs: [
          makeInput({
            workspace,
            inputFilePatterns: ["src", "/bun.lock"],
          }),
        ],
        changedFilePaths: ["bun.lock"],
      });

      expect(result.affectedWorkspaces[0].affectedReasons.changedFiles).toEqual(
        [
          {
            filePath: "bun.lock",
            inputPattern: "/bun.lock",
            fileMetadata: undefined,
          },
        ],
      );
    });

    test("matches a project-relative directory subtree", async () => {
      const workspace = makeTestWorkspace({ name: "a", path: "packages/a" });

      const result = await getFileAffectedWorkspaces({
        rootDirectory: ROOT_DIRECTORY,
        rootWorkspace: makeTestWorkspace({ name: "root", isRoot: true }),
        workspaceInputs: [
          makeInput({
            workspace,
            inputFilePatterns: ["/scripts"],
          }),
        ],
        changedFilePaths: [
          "scripts/build.ts",
          "scripts/nested/deep.ts",
          "packages/a/scripts/local.ts",
        ],
      });

      expect(result.affectedWorkspaces[0].affectedReasons.changedFiles).toEqual(
        [
          {
            filePath: "scripts/build.ts",
            inputPattern: "/scripts",
            fileMetadata: undefined,
          },
          {
            filePath: "scripts/nested/deep.ts",
            inputPattern: "/scripts",
            fileMetadata: undefined,
          },
        ],
      );
    });

    test("matches a project-relative glob", async () => {
      const workspace = makeTestWorkspace({ name: "a", path: "packages/a" });

      const result = await getFileAffectedWorkspaces({
        rootDirectory: ROOT_DIRECTORY,
        rootWorkspace: makeTestWorkspace({ name: "root", isRoot: true }),
        workspaceInputs: [
          makeInput({
            workspace,
            inputFilePatterns: ["/scripts/**/*.ts"],
          }),
        ],
        changedFilePaths: [
          "scripts/build.ts",
          "scripts/nested/deep.ts",
          "scripts/build.js",
          "packages/a/scripts/local.ts",
        ],
      });

      expect(result.affectedWorkspaces[0].affectedReasons.changedFiles).toEqual(
        [
          {
            filePath: "scripts/build.ts",
            inputPattern: "/scripts/**/*.ts",
            fileMetadata: undefined,
          },
          {
            filePath: "scripts/nested/deep.ts",
            inputPattern: "/scripts/**/*.ts",
            fileMetadata: undefined,
          },
        ],
      );
    });

    test("does not prefix the workspace path on project-relative patterns", async () => {
      const workspace = makeTestWorkspace({ name: "a", path: "packages/a" });

      const result = await getFileAffectedWorkspaces({
        rootDirectory: ROOT_DIRECTORY,
        rootWorkspace: makeTestWorkspace({ name: "root", isRoot: true }),
        workspaceInputs: [
          makeInput({
            workspace,
            inputFilePatterns: ["/tsconfig.base.json"],
          }),
        ],
        changedFilePaths: [
          "tsconfig.base.json",
          "packages/a/tsconfig.base.json",
        ],
      });

      expect(result.affectedWorkspaces[0].affectedReasons.changedFiles).toEqual(
        [
          {
            filePath: "tsconfig.base.json",
            inputPattern: "/tsconfig.base.json",
            fileMetadata: undefined,
          },
        ],
      );
    });

    test("supports `!`-prefixed project-relative exclusions", async () => {
      const workspace = makeTestWorkspace({ name: "a", path: "packages/a" });

      const result = await getFileAffectedWorkspaces({
        rootDirectory: ROOT_DIRECTORY,
        rootWorkspace: makeTestWorkspace({ name: "root", isRoot: true }),
        workspaceInputs: [
          makeInput({
            workspace,
            inputFilePatterns: ["/scripts", "!/scripts/legacy"],
          }),
        ],
        changedFilePaths: ["scripts/build.ts", "scripts/legacy/old.ts"],
      });

      expect(result.affectedWorkspaces[0].affectedReasons.changedFiles).toEqual(
        [
          {
            filePath: "scripts/build.ts",
            inputPattern: "/scripts",
            fileMetadata: undefined,
          },
        ],
      );
    });

    test("mixes workspace-relative and project-relative patterns in the same input list", async () => {
      const workspace = makeTestWorkspace({ name: "a", path: "packages/a" });

      const result = await getFileAffectedWorkspaces({
        rootDirectory: ROOT_DIRECTORY,
        rootWorkspace: makeTestWorkspace({ name: "root", isRoot: true }),
        workspaceInputs: [
          makeInput({
            workspace,
            inputFilePatterns: ["src", "/bun.lock", "/tsconfig.base.json"],
          }),
        ],
        changedFilePaths: [
          "packages/a/src/x.ts",
          "bun.lock",
          "tsconfig.base.json",
          "packages/b/src/y.ts",
        ],
      });

      expect(result.affectedWorkspaces[0].affectedReasons.changedFiles).toEqual(
        [
          {
            filePath: "packages/a/src/x.ts",
            inputPattern: "src",
            fileMetadata: undefined,
          },
          {
            filePath: "bun.lock",
            inputPattern: "/bun.lock",
            fileMetadata: undefined,
          },
          {
            filePath: "tsconfig.base.json",
            inputPattern: "/tsconfig.base.json",
            fileMetadata: undefined,
          },
        ],
      );
    });
  });

  describe("parent-segment (`..`) handling", () => {
    beforeAll(() => {
      setLogLevel("warn");
    });
    afterAll(() => {
      setLogLevel("silent");
    });

    test("workspace-relative `..` resolves to a sibling within the project", async () => {
      const workspace = makeTestWorkspace({ name: "a", path: "packages/a" });

      const result = await getFileAffectedWorkspaces({
        rootDirectory: ROOT_DIRECTORY,
        rootWorkspace: makeTestWorkspace({ name: "root", isRoot: true }),
        workspaceInputs: [
          makeInput({ workspace, inputFilePatterns: ["../shared"] }),
        ],
        changedFilePaths: [
          "packages/shared/src/x.ts",
          "packages/a/src/x.ts",
          "other/x.ts",
        ],
      });

      expect(result.affectedWorkspaces[0].affectedReasons.changedFiles).toEqual(
        [
          {
            filePath: "packages/shared/src/x.ts",
            inputPattern: "../shared",
            fileMetadata: undefined,
          },
        ],
      );
    });

    test("workspace-relative `..` alone resolves to the parent directory", async () => {
      const workspace = makeTestWorkspace({ name: "a", path: "packages/a" });

      const result = await getFileAffectedWorkspaces({
        rootDirectory: ROOT_DIRECTORY,
        rootWorkspace: makeTestWorkspace({ name: "root", isRoot: true }),
        workspaceInputs: [makeInput({ workspace, inputFilePatterns: [".."] })],
        changedFilePaths: ["packages/b/x.ts", "other/x.ts"],
      });

      expect(result.affectedWorkspaces[0].affectedReasons.changedFiles).toEqual(
        [
          {
            filePath: "packages/b/x.ts",
            inputPattern: "..",
            fileMetadata: undefined,
          },
        ],
      );
    });

    test("workspace-relative `..` works in a glob that stays inside the project", async () => {
      const workspace = makeTestWorkspace({ name: "a", path: "packages/a" });

      const result = await getFileAffectedWorkspaces({
        rootDirectory: ROOT_DIRECTORY,
        rootWorkspace: makeTestWorkspace({ name: "root", isRoot: true }),
        workspaceInputs: [
          makeInput({ workspace, inputFilePatterns: ["../shared/**/*.ts"] }),
        ],
        changedFilePaths: [
          "packages/shared/src/x.ts",
          "packages/shared/lib/y.ts",
          "packages/shared/x.css",
        ],
      });

      expect(result.affectedWorkspaces[0].affectedReasons.changedFiles).toEqual(
        [
          {
            filePath: "packages/shared/src/x.ts",
            inputPattern: "../shared/**/*.ts",
            fileMetadata: undefined,
          },
          {
            filePath: "packages/shared/lib/y.ts",
            inputPattern: "../shared/**/*.ts",
            fileMetadata: undefined,
          },
        ],
      );
    });

    test("project-relative pattern with internal `..` collapses within the project", async () => {
      const workspace = makeTestWorkspace({ name: "a", path: "packages/a" });

      const result = await getFileAffectedWorkspaces({
        rootDirectory: ROOT_DIRECTORY,
        rootWorkspace: makeTestWorkspace({ name: "root", isRoot: true }),
        workspaceInputs: [
          makeInput({ workspace, inputFilePatterns: ["/foo/../bar"] }),
        ],
        changedFilePaths: ["bar/x.ts", "foo/x.ts"],
      });

      expect(result.affectedWorkspaces[0].affectedReasons.changedFiles).toEqual(
        [
          {
            filePath: "bar/x.ts",
            inputPattern: "/foo/../bar",
            fileMetadata: undefined,
          },
        ],
      );
    });

    test("workspace-relative pattern that escapes the project is ignored and warned", async () => {
      const workspace = makeTestWorkspace({ name: "a", path: "packages/a" });
      const stderrSpy = spyOn(process.stderr, "write").mockImplementation(
        () => true,
      );

      const result = await getFileAffectedWorkspaces({
        rootDirectory: ROOT_DIRECTORY,
        rootWorkspace: makeTestWorkspace({ name: "root", isRoot: true }),
        workspaceInputs: [
          makeInput({
            workspace,
            inputFilePatterns: ["../../../external", "src"],
          }),
        ],
        changedFilePaths: ["packages/a/src/x.ts", "external/x.ts"],
      });

      expect(result.affectedWorkspaces[0].affectedReasons.changedFiles).toEqual(
        [
          {
            filePath: "packages/a/src/x.ts",
            inputPattern: "src",
            fileMetadata: undefined,
          },
        ],
      );

      const warnings = stderrSpy.mock.calls
        .map((call) => Bun.stripANSI(call[0] as string))
        .filter((message) => message.includes("[bun-workspaces WARN]"));
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toContain("../../../external");
      expect(warnings[0]).toContain('workspace "a"');
      expect(warnings[0]).toContain("outside the project root");

      stderrSpy.mockRestore();
    });

    test("project-relative pattern that escapes the project is ignored and warned", async () => {
      const workspace = makeTestWorkspace({ name: "a", path: "packages/a" });
      const stderrSpy = spyOn(process.stderr, "write").mockImplementation(
        () => true,
      );

      const result = await getFileAffectedWorkspaces({
        rootDirectory: ROOT_DIRECTORY,
        rootWorkspace: makeTestWorkspace({ name: "root", isRoot: true }),
        workspaceInputs: [
          makeInput({
            workspace,
            inputFilePatterns: ["/../external", "src"],
          }),
        ],
        changedFilePaths: ["packages/a/src/x.ts", "external/x.ts"],
      });

      expect(result.affectedWorkspaces[0].affectedReasons.changedFiles).toEqual(
        [
          {
            filePath: "packages/a/src/x.ts",
            inputPattern: "src",
            fileMetadata: undefined,
          },
        ],
      );

      const warnings = stderrSpy.mock.calls
        .map((call) => Bun.stripANSI(call[0] as string))
        .filter((message) => message.includes("[bun-workspaces WARN]"));
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toContain("/../external");

      stderrSpy.mockRestore();
    });

    test("`!`-prefixed exclusion that escapes the project is ignored and warned", async () => {
      const workspace = makeTestWorkspace({ name: "a", path: "packages/a" });
      const stderrSpy = spyOn(process.stderr, "write").mockImplementation(
        () => true,
      );

      const result = await getFileAffectedWorkspaces({
        rootDirectory: ROOT_DIRECTORY,
        rootWorkspace: makeTestWorkspace({ name: "root", isRoot: true }),
        workspaceInputs: [
          makeInput({
            workspace,
            inputFilePatterns: ["src", "!../../../external"],
          }),
        ],
        changedFilePaths: ["packages/a/src/x.ts"],
      });

      expect(result.affectedWorkspaces[0].affectedReasons.changedFiles).toEqual(
        [
          {
            filePath: "packages/a/src/x.ts",
            inputPattern: "src",
            fileMetadata: undefined,
          },
        ],
      );

      const warnings = stderrSpy.mock.calls
        .map((call) => Bun.stripANSI(call[0] as string))
        .filter((message) => message.includes("[bun-workspaces WARN]"));
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toContain("!../../../external");

      stderrSpy.mockRestore();
    });
  });

  describe("file pattern negation with `!`", () => {
    test("excludes files matched by a `!` pattern", async () => {
      const workspace = makeTestWorkspace({ name: "a", path: "packages/a" });

      const result = await getFileAffectedWorkspaces({
        rootDirectory: ROOT_DIRECTORY,
        rootWorkspace: makeTestWorkspace({ name: "root", isRoot: true }),
        workspaceInputs: [
          makeInput({
            workspace,
            inputFilePatterns: ["**/*", "!**/*.test.ts"],
          }),
        ],
        changedFilePaths: [
          "packages/a/src/index.ts",
          "packages/a/src/index.test.ts",
          "packages/a/lib/util.ts",
          "packages/a/lib/util.test.ts",
        ],
      });

      expect(result.affectedWorkspaces[0].affectedReasons.changedFiles).toEqual(
        [
          {
            filePath: "packages/a/src/index.ts",
            inputPattern: "**/*",
            fileMetadata: undefined,
          },
          {
            filePath: "packages/a/lib/util.ts",
            inputPattern: "**/*",
            fileMetadata: undefined,
          },
        ],
      );
    });

    test("excludes a directory subtree", async () => {
      const workspace = makeTestWorkspace({ name: "a", path: "packages/a" });

      const result = await getFileAffectedWorkspaces({
        rootDirectory: ROOT_DIRECTORY,
        rootWorkspace: makeTestWorkspace({ name: "root", isRoot: true }),
        workspaceInputs: [
          makeInput({
            workspace,
            inputFilePatterns: ["src", "!src/generated"],
          }),
        ],
        changedFilePaths: [
          "packages/a/src/index.ts",
          "packages/a/src/generated/types.ts",
          "packages/a/src/generated/api/x.ts",
        ],
      });

      expect(result.affectedWorkspaces[0].affectedReasons.changedFiles).toEqual(
        [
          {
            filePath: "packages/a/src/index.ts",
            inputPattern: "src",
            fileMetadata: undefined,
          },
        ],
      );
    });

    test("matches nothing when only negation patterns are given", async () => {
      const workspace = makeTestWorkspace({ name: "a", path: "packages/a" });

      const result = await getFileAffectedWorkspaces({
        rootDirectory: ROOT_DIRECTORY,
        rootWorkspace: makeTestWorkspace({ name: "root", isRoot: true }),
        workspaceInputs: [
          makeInput({
            workspace,
            inputFilePatterns: ["!**/*.test.ts"],
          }),
        ],
        changedFilePaths: [
          "packages/a/src/index.ts",
          "packages/a/src/index.test.ts",
        ],
      });

      expect(result.affectedWorkspaces[0].isAffected).toBe(false);
      expect(result.affectedWorkspaces[0].affectedReasons.changedFiles).toEqual(
        [],
      );
    });

    test("supports multiple negation patterns", async () => {
      const workspace = makeTestWorkspace({ name: "a", path: "packages/a" });

      const result = await getFileAffectedWorkspaces({
        rootDirectory: ROOT_DIRECTORY,
        rootWorkspace: makeTestWorkspace({ name: "root", isRoot: true }),
        workspaceInputs: [
          makeInput({
            workspace,
            inputFilePatterns: [
              "**/*",
              "!**/*.test.ts",
              "!**/*.snap",
              "!fixtures",
            ],
          }),
        ],
        changedFilePaths: [
          "packages/a/src/index.ts",
          "packages/a/src/index.test.ts",
          "packages/a/__snapshots__/x.snap",
          "packages/a/fixtures/data.json",
          "packages/a/README.md",
        ],
      });

      expect(result.affectedWorkspaces[0].affectedReasons.changedFiles).toEqual(
        [
          {
            filePath: "packages/a/src/index.ts",
            inputPattern: "**/*",
            fileMetadata: undefined,
          },
          {
            filePath: "packages/a/README.md",
            inputPattern: "**/*",
            fileMetadata: undefined,
          },
        ],
      );
    });

    test("`!` exclusion overrides any include match", async () => {
      const workspace = makeTestWorkspace({ name: "a", path: "packages/a" });

      const result = await getFileAffectedWorkspaces({
        rootDirectory: ROOT_DIRECTORY,
        rootWorkspace: makeTestWorkspace({ name: "root", isRoot: true }),
        workspaceInputs: [
          makeInput({
            workspace,
            inputFilePatterns: ["src", "src/**/*.ts", "!src/excluded.ts"],
          }),
        ],
        changedFilePaths: [
          "packages/a/src/index.ts",
          "packages/a/src/excluded.ts",
        ],
      });

      expect(result.affectedWorkspaces[0].affectedReasons.changedFiles).toEqual(
        [
          {
            filePath: "packages/a/src/index.ts",
            inputPattern: "src",
            fileMetadata: undefined,
          },
        ],
      );
    });

    test("negation supports plain file paths", async () => {
      const workspace = makeTestWorkspace({ name: "a", path: "packages/a" });

      const result = await getFileAffectedWorkspaces({
        rootDirectory: ROOT_DIRECTORY,
        rootWorkspace: makeTestWorkspace({ name: "root", isRoot: true }),
        workspaceInputs: [
          makeInput({
            workspace,
            inputFilePatterns: ["src", "!src/excluded.ts"],
          }),
        ],
        changedFilePaths: [
          "packages/a/src/index.ts",
          "packages/a/src/excluded.ts",
        ],
      });

      expect(result.affectedWorkspaces[0].affectedReasons.changedFiles).toEqual(
        [
          {
            filePath: "packages/a/src/index.ts",
            inputPattern: "src",
            fileMetadata: undefined,
          },
        ],
      );
    });
  });

  describe("input workspace patterns", () => {
    test("matches an input workspace dependency by name", async () => {
      const lib = makeTestWorkspace({ name: "lib", path: "packages/lib" });
      const app = makeTestWorkspace({ name: "app", path: "packages/app" });

      const result = await getFileAffectedWorkspaces({
        rootDirectory: ROOT_DIRECTORY,
        rootWorkspace: makeTestWorkspace({ name: "root", isRoot: true }),
        workspaceInputs: [
          makeInput({ workspace: lib, inputFilePatterns: ["src"] }),
          makeInput({
            workspace: app,
            inputFilePatterns: ["src"],
            inputWorkspacePatterns: ["lib"],
          }),
        ],
        changedFilePaths: ["packages/lib/src/x.ts"],
      });

      expect(result.affectedWorkspaces[0].isAffected).toBe(true);
      expect(result.affectedWorkspaces[1].isAffected).toBe(true);
      expect(result.affectedWorkspaces[1].affectedReasons.dependencies).toEqual(
        [
          {
            dependencyName: "lib",
            chain: [
              { workspaceName: "app" },
              { workspaceName: "lib", edgeSource: "input" },
            ],
          },
        ],
      );
    });

    test("matches an input workspace dependency by alias", async () => {
      const lib = makeTestWorkspace({
        name: "lib",
        path: "packages/lib",
        aliases: ["my-lib"],
      });
      const app = makeTestWorkspace({ name: "app", path: "packages/app" });

      const result = await getFileAffectedWorkspaces({
        rootDirectory: ROOT_DIRECTORY,
        rootWorkspace: makeTestWorkspace({ name: "root", isRoot: true }),
        workspaceInputs: [
          makeInput({ workspace: lib, inputFilePatterns: ["src"] }),
          makeInput({
            workspace: app,
            inputWorkspacePatterns: ["my-lib"],
          }),
        ],
        changedFilePaths: ["packages/lib/src/x.ts"],
      });

      expect(result.affectedWorkspaces[1].isAffected).toBe(true);
      expect(result.affectedWorkspaces[1].affectedReasons.dependencies).toEqual(
        [
          {
            dependencyName: "lib",
            chain: [
              { workspaceName: "app" },
              { workspaceName: "lib", edgeSource: "input" },
            ],
          },
        ],
      );
    });

    test("matches an input workspace dependency by `name:` prefix", async () => {
      const lib = makeTestWorkspace({ name: "lib", path: "packages/lib" });
      const app = makeTestWorkspace({ name: "app", path: "packages/app" });

      const result = await getFileAffectedWorkspaces({
        rootDirectory: ROOT_DIRECTORY,
        rootWorkspace: makeTestWorkspace({ name: "root", isRoot: true }),
        workspaceInputs: [
          makeInput({ workspace: lib, inputFilePatterns: ["src"] }),
          makeInput({
            workspace: app,
            inputWorkspacePatterns: ["name:lib"],
          }),
        ],
        changedFilePaths: ["packages/lib/src/x.ts"],
      });

      expect(result.affectedWorkspaces[1].isAffected).toBe(true);
      expect(result.affectedWorkspaces[1].affectedReasons.dependencies).toEqual(
        [
          {
            dependencyName: "lib",
            chain: [
              { workspaceName: "app" },
              { workspaceName: "lib", edgeSource: "input" },
            ],
          },
        ],
      );
    });

    test("matches an input workspace dependency by name glob", async () => {
      const libA = makeTestWorkspace({
        name: "lib-a",
        path: "packages/lib-a",
      });
      const libB = makeTestWorkspace({
        name: "lib-b",
        path: "packages/lib-b",
      });
      const app = makeTestWorkspace({ name: "app", path: "packages/app" });

      const result = await getFileAffectedWorkspaces({
        rootDirectory: ROOT_DIRECTORY,
        rootWorkspace: makeTestWorkspace({ name: "root", isRoot: true }),
        workspaceInputs: [
          makeInput({ workspace: libA, inputFilePatterns: ["src"] }),
          makeInput({ workspace: libB, inputFilePatterns: ["src"] }),
          makeInput({
            workspace: app,
            inputWorkspacePatterns: ["lib-*"],
          }),
        ],
        changedFilePaths: ["packages/lib-a/src/x.ts"],
      });

      expect(result.affectedWorkspaces[2].affectedReasons.dependencies).toEqual(
        [
          {
            dependencyName: "lib-a",
            chain: [
              { workspaceName: "app" },
              { workspaceName: "lib-a", edgeSource: "input" },
            ],
          },
        ],
      );
    });

    test("matches an input workspace dependency by tag", async () => {
      const libA = makeTestWorkspace({
        name: "lib-a",
        path: "packages/lib-a",
        tags: ["lib"],
      });
      const app = makeTestWorkspace({ name: "app", path: "packages/app" });

      const result = await getFileAffectedWorkspaces({
        rootDirectory: ROOT_DIRECTORY,
        rootWorkspace: makeTestWorkspace({ name: "root", isRoot: true }),
        workspaceInputs: [
          makeInput({ workspace: libA, inputFilePatterns: ["src"] }),
          makeInput({
            workspace: app,
            inputWorkspacePatterns: ["tag:lib"],
          }),
        ],
        changedFilePaths: ["packages/lib-a/src/x.ts"],
      });

      expect(result.affectedWorkspaces[1].isAffected).toBe(true);
    });

    test("matches an input workspace dependency by path glob", async () => {
      const lib = makeTestWorkspace({
        name: "lib",
        path: "packages/lib",
      });
      const app = makeTestWorkspace({ name: "app", path: "applications/app" });

      const result = await getFileAffectedWorkspaces({
        rootDirectory: ROOT_DIRECTORY,
        rootWorkspace: makeTestWorkspace({ name: "root", isRoot: true }),
        workspaceInputs: [
          makeInput({ workspace: lib, inputFilePatterns: ["src"] }),
          makeInput({
            workspace: app,
            inputWorkspacePatterns: ["path:packages/**/*"],
          }),
        ],
        changedFilePaths: ["packages/lib/src/x.ts"],
      });

      expect(result.affectedWorkspaces[1].isAffected).toBe(true);
    });

    test("excludes via `not:` negation", async () => {
      const libA = makeTestWorkspace({
        name: "lib-a",
        path: "packages/lib-a",
      });
      const libB = makeTestWorkspace({
        name: "lib-b",
        path: "packages/lib-b",
      });
      const app = makeTestWorkspace({ name: "app", path: "packages/app" });

      const result = await getFileAffectedWorkspaces({
        rootDirectory: ROOT_DIRECTORY,
        rootWorkspace: makeTestWorkspace({ name: "root", isRoot: true }),
        workspaceInputs: [
          makeInput({ workspace: libA, inputFilePatterns: ["src"] }),
          makeInput({ workspace: libB, inputFilePatterns: ["src"] }),
          makeInput({
            workspace: app,
            inputWorkspacePatterns: ["lib-*", "not:lib-b"],
          }),
        ],
        changedFilePaths: [
          "packages/lib-a/src/x.ts",
          "packages/lib-b/src/y.ts",
        ],
      });

      expect(result.affectedWorkspaces[2].affectedReasons.dependencies).toEqual(
        [
          {
            dependencyName: "lib-a",
            chain: [
              { workspaceName: "app" },
              { workspaceName: "lib-a", edgeSource: "input" },
            ],
          },
        ],
      );
    });

    test("excludes via `!` shorthand negation", async () => {
      const libA = makeTestWorkspace({
        name: "lib-a",
        path: "packages/lib-a",
      });
      const libB = makeTestWorkspace({
        name: "lib-b",
        path: "packages/lib-b",
      });
      const app = makeTestWorkspace({ name: "app", path: "packages/app" });

      const result = await getFileAffectedWorkspaces({
        rootDirectory: ROOT_DIRECTORY,
        rootWorkspace: makeTestWorkspace({ name: "root", isRoot: true }),
        workspaceInputs: [
          makeInput({ workspace: libA, inputFilePatterns: ["src"] }),
          makeInput({ workspace: libB, inputFilePatterns: ["src"] }),
          makeInput({
            workspace: app,
            inputWorkspacePatterns: ["lib-*", "!lib-b"],
          }),
        ],
        changedFilePaths: [
          "packages/lib-a/src/x.ts",
          "packages/lib-b/src/y.ts",
        ],
      });

      expect(result.affectedWorkspaces[2].affectedReasons.dependencies).toEqual(
        [
          {
            dependencyName: "lib-a",
            chain: [
              { workspaceName: "app" },
              { workspaceName: "lib-a", edgeSource: "input" },
            ],
          },
        ],
      );
    });

    test("does not include the starting workspace as a self-input", async () => {
      const a = makeTestWorkspace({ name: "a", path: "packages/a" });
      const b = makeTestWorkspace({ name: "b", path: "packages/b" });

      const result = await getFileAffectedWorkspaces({
        rootDirectory: ROOT_DIRECTORY,
        rootWorkspace: makeTestWorkspace({ name: "root", isRoot: true }),
        workspaceInputs: [
          makeInput({
            workspace: a,
            inputFilePatterns: ["src"],
            inputWorkspacePatterns: ["*"],
          }),
          makeInput({ workspace: b, inputFilePatterns: ["src"] }),
        ],
        changedFilePaths: ["packages/a/src/x.ts"],
      });

      // a is affected via its own files, not a self-input chain
      expect(result.affectedWorkspaces[0].affectedReasons.dependencies).toEqual(
        [],
      );
    });
  });

  describe("package dependency propagation", () => {
    test("marks a workspace as affected via a direct package dependency", async () => {
      const dep = makeTestWorkspace({
        name: "dep",
        path: "packages/dep",
        dependents: ["app"],
      });
      const app = makeTestWorkspace({
        name: "app",
        path: "packages/app",
        dependencies: ["dep"],
      });

      const result = await getFileAffectedWorkspaces({
        rootDirectory: ROOT_DIRECTORY,
        rootWorkspace: makeTestWorkspace({ name: "root", isRoot: true }),
        workspaceInputs: [
          makeInput({ workspace: dep, inputFilePatterns: ["src"] }),
          makeInput({ workspace: app, inputFilePatterns: ["src"] }),
        ],
        changedFilePaths: ["packages/dep/src/x.ts"],
      });

      expect(result.affectedWorkspaces).toEqual([
        {
          workspace: dep,
          isAffected: true,
          affectedReasons: {
            changedFiles: [
              {
                filePath: "packages/dep/src/x.ts",
                inputPattern: "src",
                fileMetadata: undefined,
              },
            ],
            dependencies: [],
            externalDependencies: [],
          },
        },
        {
          workspace: app,
          isAffected: true,
          affectedReasons: {
            changedFiles: [],
            dependencies: [
              {
                dependencyName: "dep",
                chain: [
                  { workspaceName: "app" },
                  { workspaceName: "dep", edgeSource: "package" },
                ],
              },
            ],
            externalDependencies: [],
          },
        },
      ]);
    });

    test("propagates through transitive package dependencies with full chain", async () => {
      const c = makeTestWorkspace({
        name: "c",
        path: "packages/c",
        dependents: ["b"],
      });
      const b = makeTestWorkspace({
        name: "b",
        path: "packages/b",
        dependencies: ["c"],
        dependents: ["a"],
      });
      const a = makeTestWorkspace({
        name: "a",
        path: "packages/a",
        dependencies: ["b"],
      });

      const result = await getFileAffectedWorkspaces({
        rootDirectory: ROOT_DIRECTORY,
        rootWorkspace: makeTestWorkspace({ name: "root", isRoot: true }),
        workspaceInputs: [
          makeInput({ workspace: a, inputFilePatterns: ["src"] }),
          makeInput({ workspace: b, inputFilePatterns: ["src"] }),
          makeInput({ workspace: c, inputFilePatterns: ["src"] }),
        ],
        changedFilePaths: ["packages/c/src/x.ts"],
      });

      expect(result.affectedWorkspaces[0]).toEqual({
        workspace: a,
        isAffected: true,
        affectedReasons: {
          changedFiles: [],
          dependencies: [
            {
              dependencyName: "b",
              chain: [
                { workspaceName: "a" },
                { workspaceName: "b", edgeSource: "package" },
                { workspaceName: "c", edgeSource: "package" },
              ],
            },
          ],
          externalDependencies: [],
        },
      });
      expect(result.affectedWorkspaces[1].affectedReasons.dependencies).toEqual(
        [
          {
            dependencyName: "c",
            chain: [
              { workspaceName: "b" },
              { workspaceName: "c", edgeSource: "package" },
            ],
          },
        ],
      );
      expect(result.affectedWorkspaces[2].affectedReasons.dependencies).toEqual(
        [],
      );
    });

    test("includes every directly-affected dep reachable from a workspace", async () => {
      const c = makeTestWorkspace({
        name: "c",
        path: "packages/c",
        dependents: ["a"],
      });
      const d = makeTestWorkspace({
        name: "d",
        path: "packages/d",
        dependents: ["a"],
      });
      const a = makeTestWorkspace({
        name: "a",
        path: "packages/a",
        dependencies: ["c", "d"],
      });

      const result = await getFileAffectedWorkspaces({
        rootDirectory: ROOT_DIRECTORY,
        rootWorkspace: makeTestWorkspace({ name: "root", isRoot: true }),
        workspaceInputs: [
          makeInput({ workspace: a, inputFilePatterns: ["src"] }),
          makeInput({ workspace: c, inputFilePatterns: ["src"] }),
          makeInput({ workspace: d, inputFilePatterns: ["src"] }),
        ],
        changedFilePaths: ["packages/c/src/x.ts", "packages/d/src/y.ts"],
      });

      expect(result.affectedWorkspaces[0].affectedReasons.dependencies).toEqual(
        [
          {
            dependencyName: "c",
            chain: [
              { workspaceName: "a" },
              { workspaceName: "c", edgeSource: "package" },
            ],
          },
          {
            dependencyName: "d",
            chain: [
              { workspaceName: "a" },
              { workspaceName: "d", edgeSource: "package" },
            ],
          },
        ],
      );
    });

    test("chain extends through every affected dep edge regardless of intermediate direct causes", async () => {
      const c = makeTestWorkspace({
        name: "c",
        path: "packages/c",
        dependents: ["b"],
      });
      const b = makeTestWorkspace({
        name: "b",
        path: "packages/b",
        dependencies: ["c"],
        dependents: ["a"],
      });
      const a = makeTestWorkspace({
        name: "a",
        path: "packages/a",
        dependencies: ["b"],
      });

      const result = await getFileAffectedWorkspaces({
        rootDirectory: ROOT_DIRECTORY,
        rootWorkspace: makeTestWorkspace({ name: "root", isRoot: true }),
        workspaceInputs: [
          makeInput({ workspace: a, inputFilePatterns: ["src"] }),
          makeInput({ workspace: b, inputFilePatterns: ["src"] }),
          makeInput({ workspace: c, inputFilePatterns: ["src"] }),
        ],
        changedFilePaths: ["packages/b/src/x.ts", "packages/c/src/y.ts"],
      });

      // Both b and c are direct causes (own files changed). From a, b is the
      // direct dep; the chain still extends through to c so the user can
      // see the full propagation path.
      expect(result.affectedWorkspaces[0].affectedReasons.dependencies).toEqual(
        [
          {
            dependencyName: "b",
            chain: [
              { workspaceName: "a" },
              { workspaceName: "b", edgeSource: "package" },
              { workspaceName: "c", edgeSource: "package" },
            ],
          },
        ],
      );
    });

    test("dependency cycles do not cause infinite recursion", async () => {
      const a = makeTestWorkspace({
        name: "a",
        path: "packages/a",
        dependencies: ["b"],
        dependents: ["c"],
      });
      const b = makeTestWorkspace({
        name: "b",
        path: "packages/b",
        dependencies: ["c"],
        dependents: ["a"],
      });
      const c = makeTestWorkspace({
        name: "c",
        path: "packages/c",
        dependencies: ["a"],
        dependents: ["b"],
      });

      const result = await getFileAffectedWorkspaces({
        rootDirectory: ROOT_DIRECTORY,
        rootWorkspace: makeTestWorkspace({ name: "root", isRoot: true }),
        workspaceInputs: [
          makeInput({ workspace: a, inputFilePatterns: ["src"] }),
          makeInput({ workspace: b, inputFilePatterns: ["src"] }),
          makeInput({ workspace: c, inputFilePatterns: ["src"] }),
        ],
        changedFilePaths: ["packages/b/src/x.ts"],
      });

      // All three workspaces are affected because the cycle propagates through dependents
      expect(result.affectedWorkspaces.map((w) => w.isAffected)).toEqual([
        true,
        true,
        true,
      ]);
    });

    test("dependencies that are not in workspaceInputs are skipped", async () => {
      const app = makeTestWorkspace({
        name: "app",
        path: "packages/app",
        dependencies: ["external-not-in-inputs"],
      });

      const result = await getFileAffectedWorkspaces({
        rootDirectory: ROOT_DIRECTORY,
        rootWorkspace: makeTestWorkspace({ name: "root", isRoot: true }),
        workspaceInputs: [
          makeInput({ workspace: app, inputFilePatterns: ["src"] }),
        ],
        changedFilePaths: ["packages/app/src/x.ts"],
      });

      expect(result.affectedWorkspaces[0].isAffected).toBe(true);
      expect(result.affectedWorkspaces[0].affectedReasons.dependencies).toEqual(
        [],
      );
    });
  });

  describe("input workspace dependency propagation", () => {
    test("propagates through a chain of pure input deps", async () => {
      const c = makeTestWorkspace({ name: "c", path: "packages/c" });
      const b = makeTestWorkspace({ name: "b", path: "packages/b" });
      const a = makeTestWorkspace({ name: "a", path: "packages/a" });

      const result = await getFileAffectedWorkspaces({
        rootDirectory: ROOT_DIRECTORY,
        rootWorkspace: makeTestWorkspace({ name: "root", isRoot: true }),
        workspaceInputs: [
          makeInput({
            workspace: a,
            inputWorkspacePatterns: ["b"],
          }),
          makeInput({
            workspace: b,
            inputWorkspacePatterns: ["c"],
          }),
          makeInput({ workspace: c, inputFilePatterns: ["src"] }),
        ],
        changedFilePaths: ["packages/c/src/x.ts"],
      });

      expect(result.affectedWorkspaces.map((w) => w.isAffected)).toEqual([
        true,
        true,
        true,
      ]);

      expect(result.affectedWorkspaces[0].affectedReasons.dependencies).toEqual(
        [
          {
            dependencyName: "b",
            chain: [
              { workspaceName: "a" },
              { workspaceName: "b", edgeSource: "input" },
              { workspaceName: "c", edgeSource: "input" },
            ],
          },
        ],
      );
    });

    test("input deps respect aliases when matching", async () => {
      const c = makeTestWorkspace({
        name: "c",
        path: "packages/c",
        aliases: ["lib-c"],
      });
      const a = makeTestWorkspace({
        name: "a",
        path: "packages/a",
      });

      const result = await getFileAffectedWorkspaces({
        rootDirectory: ROOT_DIRECTORY,
        rootWorkspace: makeTestWorkspace({ name: "root", isRoot: true }),
        workspaceInputs: [
          makeInput({
            workspace: a,
            inputWorkspacePatterns: ["alias:lib-c"],
          }),
          makeInput({ workspace: c, inputFilePatterns: ["src"] }),
        ],
        changedFilePaths: ["packages/c/src/x.ts"],
      });

      expect(result.affectedWorkspaces[0].isAffected).toBe(true);
    });

    test("input dependency cycles do not cause infinite recursion", async () => {
      const a = makeTestWorkspace({ name: "a", path: "packages/a" });
      const b = makeTestWorkspace({ name: "b", path: "packages/b" });
      const c = makeTestWorkspace({ name: "c", path: "packages/c" });

      const result = await getFileAffectedWorkspaces({
        rootDirectory: ROOT_DIRECTORY,
        rootWorkspace: makeTestWorkspace({ name: "root", isRoot: true }),
        workspaceInputs: [
          makeInput({ workspace: a, inputWorkspacePatterns: ["b"] }),
          makeInput({ workspace: b, inputWorkspacePatterns: ["c"] }),
          makeInput({
            workspace: c,
            inputFilePatterns: ["src"],
            inputWorkspacePatterns: ["a"],
          }),
        ],
        changedFilePaths: ["packages/c/src/x.ts"],
      });

      expect(result.affectedWorkspaces.map((w) => w.isAffected)).toEqual([
        true,
        true,
        true,
      ]);
    });

    test("input dep propagation does not require a starting workspace to have file inputs", async () => {
      const lib = makeTestWorkspace({ name: "lib", path: "packages/lib" });
      const app = makeTestWorkspace({ name: "app", path: "packages/app" });

      const result = await getFileAffectedWorkspaces({
        rootDirectory: ROOT_DIRECTORY,
        rootWorkspace: makeTestWorkspace({ name: "root", isRoot: true }),
        workspaceInputs: [
          makeInput({ workspace: lib, inputFilePatterns: ["src"] }),
          makeInput({
            workspace: app,
            inputWorkspacePatterns: ["lib"],
          }),
        ],
        changedFilePaths: ["packages/lib/src/x.ts"],
      });

      expect(result.affectedWorkspaces[1].isAffected).toBe(true);
    });
  });

  describe("mixed input + package dependency chains", () => {
    test("an input edge followed by a package edge produces a mixed chain", async () => {
      // app --input--> lib --package--> shared, shared changes
      const shared = makeTestWorkspace({
        name: "shared",
        path: "packages/shared",
        dependents: ["lib"],
      });
      const lib = makeTestWorkspace({
        name: "lib",
        path: "packages/lib",
        dependencies: ["shared"],
      });
      const app = makeTestWorkspace({ name: "app", path: "packages/app" });

      const result = await getFileAffectedWorkspaces({
        rootDirectory: ROOT_DIRECTORY,
        rootWorkspace: makeTestWorkspace({ name: "root", isRoot: true }),
        workspaceInputs: [
          makeInput({ workspace: shared, inputFilePatterns: ["src"] }),
          makeInput({ workspace: lib, inputFilePatterns: ["src"] }),
          makeInput({
            workspace: app,
            inputWorkspacePatterns: ["lib"],
          }),
        ],
        changedFilePaths: ["packages/shared/src/x.ts"],
      });

      expect(result.affectedWorkspaces.map((w) => w.isAffected)).toEqual([
        true,
        true,
        true,
      ]);

      expect(result.affectedWorkspaces[2].affectedReasons.dependencies).toEqual(
        [
          {
            dependencyName: "lib",
            chain: [
              { workspaceName: "app" },
              { workspaceName: "lib", edgeSource: "input" },
              { workspaceName: "shared", edgeSource: "package" },
            ],
          },
        ],
      );
    });

    test("a package edge followed by an input edge produces a mixed chain", async () => {
      // app --package--> mid --input--> data, data changes
      const data = makeTestWorkspace({ name: "data", path: "packages/data" });
      const mid = makeTestWorkspace({
        name: "mid",
        path: "packages/mid",
        dependents: ["app"],
      });
      const app = makeTestWorkspace({
        name: "app",
        path: "packages/app",
        dependencies: ["mid"],
      });

      const result = await getFileAffectedWorkspaces({
        rootDirectory: ROOT_DIRECTORY,
        rootWorkspace: makeTestWorkspace({ name: "root", isRoot: true }),
        workspaceInputs: [
          makeInput({ workspace: data, inputFilePatterns: ["src"] }),
          makeInput({
            workspace: mid,
            inputWorkspacePatterns: ["data"],
          }),
          makeInput({ workspace: app }),
        ],
        changedFilePaths: ["packages/data/src/x.ts"],
      });

      expect(result.affectedWorkspaces.map((w) => w.isAffected)).toEqual([
        true,
        true,
        true,
      ]);

      expect(result.affectedWorkspaces[2].affectedReasons.dependencies).toEqual(
        [
          {
            dependencyName: "mid",
            chain: [
              { workspaceName: "app" },
              { workspaceName: "mid", edgeSource: "package" },
              { workspaceName: "data", edgeSource: "input" },
            ],
          },
        ],
      );
    });

    test("input edge wins over package edge when both reach the same dep", async () => {
      const shared = makeTestWorkspace({
        name: "shared",
        path: "packages/shared",
        dependents: ["app"],
      });
      const app = makeTestWorkspace({
        name: "app",
        path: "packages/app",
        dependencies: ["shared"],
      });

      const result = await getFileAffectedWorkspaces({
        rootDirectory: ROOT_DIRECTORY,
        rootWorkspace: makeTestWorkspace({ name: "root", isRoot: true }),
        workspaceInputs: [
          makeInput({ workspace: shared, inputFilePatterns: ["src"] }),
          makeInput({
            workspace: app,
            inputWorkspacePatterns: ["shared"],
          }),
        ],
        changedFilePaths: ["packages/shared/src/x.ts"],
      });

      expect(result.affectedWorkspaces[1].affectedReasons.dependencies).toEqual(
        [
          {
            dependencyName: "shared",
            chain: [
              { workspaceName: "app" },
              { workspaceName: "shared", edgeSource: "input" },
            ],
          },
        ],
      );
    });
  });

  describe("ignoreWorkspaceDependencies", () => {
    test("disables propagation through package edges", async () => {
      const dep = makeTestWorkspace({
        name: "dep",
        path: "packages/dep",
        dependents: ["app"],
      });
      const app = makeTestWorkspace({
        name: "app",
        path: "packages/app",
        dependencies: ["dep"],
      });

      const result = await getFileAffectedWorkspaces({
        rootDirectory: ROOT_DIRECTORY,
        rootWorkspace: makeTestWorkspace({ name: "root", isRoot: true }),
        workspaceInputs: [
          makeInput({ workspace: dep, inputFilePatterns: ["src"] }),
          makeInput({ workspace: app, inputFilePatterns: ["src"] }),
        ],
        changedFilePaths: ["packages/dep/src/x.ts"],
        ignoreWorkspaceDependencies: true,
      });

      expect(result.affectedWorkspaces[0].isAffected).toBe(true);
      expect(result.affectedWorkspaces[1].isAffected).toBe(false);
      expect(result.affectedWorkspaces[1].affectedReasons.dependencies).toEqual(
        [],
      );
    });

    test("input edges still propagate when package deps are ignored", async () => {
      const c = makeTestWorkspace({
        name: "c",
        path: "packages/c",
      });
      const b = makeTestWorkspace({
        name: "b",
        path: "packages/b",
      });
      const a = makeTestWorkspace({ name: "a", path: "packages/a" });

      const result = await getFileAffectedWorkspaces({
        rootDirectory: ROOT_DIRECTORY,
        rootWorkspace: makeTestWorkspace({ name: "root", isRoot: true }),
        workspaceInputs: [
          makeInput({
            workspace: a,
            inputWorkspacePatterns: ["b"],
          }),
          makeInput({
            workspace: b,
            inputWorkspacePatterns: ["c"],
          }),
          makeInput({ workspace: c, inputFilePatterns: ["src"] }),
        ],
        changedFilePaths: ["packages/c/src/x.ts"],
        ignoreWorkspaceDependencies: true,
      });

      expect(result.affectedWorkspaces.map((w) => w.isAffected)).toEqual([
        true,
        true,
        true,
      ]);
      expect(result.affectedWorkspaces[0].affectedReasons.dependencies).toEqual(
        [
          {
            dependencyName: "b",
            chain: [
              { workspaceName: "a" },
              { workspaceName: "b", edgeSource: "input" },
              { workspaceName: "c", edgeSource: "input" },
            ],
          },
        ],
      );
    });

    test("with ignoreWorkspaceDependencies, package transitivity through an input dep is dropped", async () => {
      // app --input--> lib --package--> shared, shared changes
      const shared = makeTestWorkspace({
        name: "shared",
        path: "packages/shared",
        dependents: ["lib"],
      });
      const lib = makeTestWorkspace({
        name: "lib",
        path: "packages/lib",
        dependencies: ["shared"],
      });
      const app = makeTestWorkspace({ name: "app", path: "packages/app" });

      const result = await getFileAffectedWorkspaces({
        rootDirectory: ROOT_DIRECTORY,
        rootWorkspace: makeTestWorkspace({ name: "root", isRoot: true }),
        workspaceInputs: [
          makeInput({ workspace: shared, inputFilePatterns: ["src"] }),
          makeInput({ workspace: lib, inputFilePatterns: ["src"] }),
          makeInput({
            workspace: app,
            inputWorkspacePatterns: ["lib"],
          }),
        ],
        changedFilePaths: ["packages/shared/src/x.ts"],
        ignoreWorkspaceDependencies: true,
      });

      // shared: directly changed
      expect(result.affectedWorkspaces[0].isAffected).toBe(true);
      // lib: would have been affected via package dep on shared, but package is ignored
      expect(result.affectedWorkspaces[1].isAffected).toBe(false);
      // app: input dep on lib (which is not affected) -> not affected
      expect(result.affectedWorkspaces[2].isAffected).toBe(false);
    });

    test("with ignoreWorkspaceDependencies, all chain edges are `input`", async () => {
      const c = makeTestWorkspace({ name: "c", path: "packages/c" });
      const b = makeTestWorkspace({ name: "b", path: "packages/b" });
      const a = makeTestWorkspace({ name: "a", path: "packages/a" });

      const result = await getFileAffectedWorkspaces({
        rootDirectory: ROOT_DIRECTORY,
        rootWorkspace: makeTestWorkspace({ name: "root", isRoot: true }),
        workspaceInputs: [
          makeInput({
            workspace: a,
            inputWorkspacePatterns: ["b"],
          }),
          makeInput({
            workspace: b,
            inputWorkspacePatterns: ["c"],
          }),
          makeInput({ workspace: c, inputFilePatterns: ["src"] }),
        ],
        changedFilePaths: ["packages/c/src/x.ts"],
        ignoreWorkspaceDependencies: true,
      });

      const chainEdges =
        result.affectedWorkspaces[0].affectedReasons.dependencies
          .flatMap((dep) => dep.chain)
          .map((entry) => entry.edgeSource)
          .filter((edgeSource) => edgeSource !== undefined);

      expect(chainEdges.every((edgeSource) => edgeSource === "input")).toBe(
        true,
      );
    });
  });

  describe("edge cases", () => {
    test("returns an empty result for empty workspaceInputs", async () => {
      const result = await getFileAffectedWorkspaces({
        rootDirectory: ROOT_DIRECTORY,
        rootWorkspace: makeTestWorkspace({ name: "root", isRoot: true }),
        workspaceInputs: [],
        changedFilePaths: ["packages/a/src/x.ts"],
      });

      expect(result.affectedWorkspaces).toEqual([]);
    });

    test("returns isAffected=false when there are no changed files", async () => {
      const workspace = makeTestWorkspace({ name: "a", path: "packages/a" });

      const result = await getFileAffectedWorkspaces({
        rootDirectory: ROOT_DIRECTORY,
        rootWorkspace: makeTestWorkspace({ name: "root", isRoot: true }),
        workspaceInputs: [makeInput({ workspace, inputFilePatterns: ["src"] })],
        changedFilePaths: [],
      });

      expect(result.affectedWorkspaces[0]).toEqual({
        workspace,
        isAffected: false,
        affectedReasons: {
          changedFiles: [],
          dependencies: [],
          externalDependencies: [],
        },
      });
    });

    test("a workspace with empty inputs is not directly affected by file changes", async () => {
      const workspace = makeTestWorkspace({ name: "a", path: "packages/a" });

      const result = await getFileAffectedWorkspaces({
        rootDirectory: ROOT_DIRECTORY,
        rootWorkspace: makeTestWorkspace({ name: "root", isRoot: true }),
        workspaceInputs: [makeInput({ workspace })],
        changedFilePaths: ["packages/a/src/x.ts"],
      });

      expect(result.affectedWorkspaces[0].isAffected).toBe(false);
      expect(result.affectedWorkspaces[0].affectedReasons.changedFiles).toEqual(
        [],
      );
    });

    test("a workspace with empty file inputs can still be affected via input deps", async () => {
      const dep = makeTestWorkspace({ name: "dep", path: "packages/dep" });
      const app = makeTestWorkspace({ name: "app", path: "packages/app" });

      const result = await getFileAffectedWorkspaces({
        rootDirectory: ROOT_DIRECTORY,
        rootWorkspace: makeTestWorkspace({ name: "root", isRoot: true }),
        workspaceInputs: [
          makeInput({ workspace: dep, inputFilePatterns: ["src"] }),
          makeInput({
            workspace: app,
            inputWorkspacePatterns: ["dep"],
          }),
        ],
        changedFilePaths: ["packages/dep/src/x.ts"],
      });

      expect(result.affectedWorkspaces[1].isAffected).toBe(true);
      expect(result.affectedWorkspaces[1].affectedReasons.dependencies).toEqual(
        [
          {
            dependencyName: "dep",
            chain: [
              { workspaceName: "app" },
              { workspaceName: "dep", edgeSource: "input" },
            ],
          },
        ],
      );
    });

    test("dedupes a file matched by multiple patterns into a single entry", async () => {
      const workspace = makeTestWorkspace({ name: "a", path: "packages/a" });

      const result = await getFileAffectedWorkspaces({
        rootDirectory: ROOT_DIRECTORY,
        rootWorkspace: makeTestWorkspace({ name: "root", isRoot: true }),
        workspaceInputs: [
          makeInput({
            workspace,
            inputFilePatterns: ["src/**/*.ts", "src"],
          }),
        ],
        changedFilePaths: ["packages/a/src/x.ts"],
      });

      expect(result.affectedWorkspaces[0].affectedReasons.changedFiles).toEqual(
        [
          {
            filePath: "packages/a/src/x.ts",
            inputPattern: "src/**/*.ts",
            fileMetadata: undefined,
          },
        ],
      );
    });

    test("an input workspace pattern matching no workspace is a no-op", async () => {
      const a = makeTestWorkspace({ name: "a", path: "packages/a" });

      const result = await getFileAffectedWorkspaces({
        rootDirectory: ROOT_DIRECTORY,
        rootWorkspace: makeTestWorkspace({ name: "root", isRoot: true }),
        workspaceInputs: [
          makeInput({
            workspace: a,
            inputFilePatterns: ["src"],
            inputWorkspacePatterns: ["nonexistent-*"],
          }),
        ],
        changedFilePaths: ["packages/a/src/x.ts"],
      });

      expect(result.affectedWorkspaces[0].isAffected).toBe(true);
      expect(result.affectedWorkspaces[0].affectedReasons.dependencies).toEqual(
        [],
      );
    });

    test("a directly changed workspace still reports its affected dependencies in the chain", async () => {
      const dep = makeTestWorkspace({
        name: "dep",
        path: "packages/dep",
      });
      const app = makeTestWorkspace({
        name: "app",
        path: "packages/app",
      });

      const result = await getFileAffectedWorkspaces({
        rootDirectory: ROOT_DIRECTORY,
        rootWorkspace: makeTestWorkspace({ name: "root", isRoot: true }),
        workspaceInputs: [
          makeInput({ workspace: dep, inputFilePatterns: ["src"] }),
          makeInput({
            workspace: app,
            inputFilePatterns: ["src"],
            inputWorkspacePatterns: ["dep"],
          }),
        ],
        changedFilePaths: ["packages/dep/src/x.ts", "packages/app/src/x.ts"],
      });

      expect(result.affectedWorkspaces[1].isAffected).toBe(true);
      expect(result.affectedWorkspaces[1].affectedReasons.changedFiles).toEqual(
        [
          {
            filePath: "packages/app/src/x.ts",
            inputPattern: "src",
            fileMetadata: undefined,
          },
        ],
      );
      expect(result.affectedWorkspaces[1].affectedReasons.dependencies).toEqual(
        [
          {
            dependencyName: "dep",
            chain: [
              { workspaceName: "app" },
              { workspaceName: "dep", edgeSource: "input" },
            ],
          },
        ],
      );
    });
  });

  describe("inputExternalDependencyNames filter", () => {
    const makeWorkspaceWithExternals = () =>
      makeTestWorkspace({
        name: "a",
        path: "packages/a",
        externalDependencies: [
          { name: "lodash", version: "^4.0.0", source: "dependencies" },
          { name: "typescript", version: "^5.0.0", source: "devDependencies" },
        ],
      });

    const lockfileChanges = (): Map<string, ExternalDependencyChange[]> =>
      new Map([
        [
          "a",
          [
            {
              name: "lodash",
              source: "dependencies",
              baseVersion: "4.17.0",
              headVersion: "4.17.21",
            },
            {
              name: "typescript",
              source: "devDependencies",
              baseVersion: "5.0.0",
              headVersion: "5.4.0",
            },
          ],
        ],
      ]);

    test("undefined filter lets every declared external dep participate", async () => {
      const workspace = makeWorkspaceWithExternals();
      const result = await getFileAffectedWorkspaces({
        rootDirectory: ROOT_DIRECTORY,
        rootWorkspace: makeTestWorkspace({ name: "root", isRoot: true }),
        workspaceInputs: [makeInput({ workspace })],
        changedFilePaths: [],
        externalDepChangesByWorkspace: lockfileChanges(),
      });

      expect(result.affectedWorkspaces[0].isAffected).toBe(true);
      expect(
        result.affectedWorkspaces[0].affectedReasons.externalDependencies,
      ).toEqual([
        {
          name: "lodash",
          source: "dependencies",
          baseVersion: "4.17.0",
          headVersion: "4.17.21",
        },
        {
          name: "typescript",
          source: "devDependencies",
          baseVersion: "5.0.0",
          headVersion: "5.4.0",
        },
      ]);
    });

    test("empty array filter excludes the workspace from lockfile-driven affectedness", async () => {
      const workspace = makeWorkspaceWithExternals();
      const result = await getFileAffectedWorkspaces({
        rootDirectory: ROOT_DIRECTORY,
        rootWorkspace: makeTestWorkspace({ name: "root", isRoot: true }),
        workspaceInputs: [
          makeInput({ workspace, inputExternalDependencyNames: [] }),
        ],
        changedFilePaths: [],
        externalDepChangesByWorkspace: lockfileChanges(),
      });

      expect(result.affectedWorkspaces[0].isAffected).toBe(false);
      expect(
        result.affectedWorkspaces[0].affectedReasons.externalDependencies,
      ).toEqual([]);
    });

    test("non-empty filter limits participating deps to listed names", async () => {
      const workspace = makeWorkspaceWithExternals();
      const result = await getFileAffectedWorkspaces({
        rootDirectory: ROOT_DIRECTORY,
        rootWorkspace: makeTestWorkspace({ name: "root", isRoot: true }),
        workspaceInputs: [
          makeInput({
            workspace,
            inputExternalDependencyNames: ["lodash"],
          }),
        ],
        changedFilePaths: [],
        externalDepChangesByWorkspace: lockfileChanges(),
      });

      expect(result.affectedWorkspaces[0].isAffected).toBe(true);
      expect(
        result.affectedWorkspaces[0].affectedReasons.externalDependencies,
      ).toEqual([
        {
          name: "lodash",
          source: "dependencies",
          baseVersion: "4.17.0",
          headVersion: "4.17.21",
        },
      ]);
    });

    test("filter names that don't match any declared external are silently ignored", async () => {
      const workspace = makeWorkspaceWithExternals();
      const result = await getFileAffectedWorkspaces({
        rootDirectory: ROOT_DIRECTORY,
        rootWorkspace: makeTestWorkspace({ name: "root", isRoot: true }),
        workspaceInputs: [
          makeInput({
            workspace,
            inputExternalDependencyNames: ["react", "vue"],
          }),
        ],
        changedFilePaths: [],
        externalDepChangesByWorkspace: lockfileChanges(),
      });

      // Neither "react" nor "vue" is a declared external of 'a', so no
      // external-dep change matches the filter and the workspace isn't
      // flagged via the lockfile signal.
      expect(result.affectedWorkspaces[0].isAffected).toBe(false);
      expect(
        result.affectedWorkspaces[0].affectedReasons.externalDependencies,
      ).toEqual([]);
    });

    test("filter applies per-workspace independently", async () => {
      const a = makeWorkspaceWithExternals();
      const b = makeTestWorkspace({
        name: "b",
        path: "packages/b",
        externalDependencies: [
          { name: "lodash", version: "^4.0.0", source: "dependencies" },
        ],
      });
      const result = await getFileAffectedWorkspaces({
        rootDirectory: ROOT_DIRECTORY,
        rootWorkspace: makeTestWorkspace({ name: "root", isRoot: true }),
        workspaceInputs: [
          makeInput({ workspace: a, inputExternalDependencyNames: [] }),
          makeInput({ workspace: b }),
        ],
        changedFilePaths: [],
        externalDepChangesByWorkspace: new Map([
          [
            "a",
            [
              {
                name: "lodash",
                source: "dependencies",
                baseVersion: "4.17.0",
                headVersion: "4.17.21",
              },
            ],
          ],
          [
            "b",
            [
              {
                name: "lodash",
                source: "dependencies",
                baseVersion: "4.17.0",
                headVersion: "4.17.21",
              },
            ],
          ],
        ]),
      });

      // 'a' has the filter set to [] — silenced. 'b' has no filter — flagged.
      expect(result.affectedWorkspaces[0].isAffected).toBe(false);
      expect(result.affectedWorkspaces[1].isAffected).toBe(true);
    });
  });
});
