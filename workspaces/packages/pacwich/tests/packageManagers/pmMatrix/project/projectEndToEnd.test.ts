import path from "path";
import { createFileSystemProject } from "../../../../src/project";
import { loadFixture } from "../../../util/fixtures";
import { describeEachPm } from "../../../util/pmMatrix";
import { describe, expect, test } from "../../../util/testFramework";
import { PROJECT_SMOKE_FIXTURES } from "./projectFixtures";

/**
 * Smoke suite: exercises every public Project property/method against a
 * real `FileSystemProject` built by each registered backend's adapter.
 * Catches integration gaps the per-method conformance suite might miss
 * (e.g. an adapter that produces valid `loadRootMetadata` output but
 * trips up `assembleProject` downstream).
 *
 * Coverage axes:
 *  - PM matrix: every registered backend via `describeEachPm`
 *  - Fixture matrix: a variety of project shapes via {@link
 *    PROJECT_SMOKE_FIXTURES} (degenerate single-workspace, dep graphs,
 *    root-as-workspace, weird glob shapes, etc.) so each adapter is
 *    exercised against scenarios it hasn't seen in narrower test
 *    files.
 *
 * Every Project member except the deprecated `mapScriptsToWorkspaces`
 * and `mapTagsToWorkspaces` aliases (covered separately — the surface
 * here is the new `scriptMap` / `tagMap` getters).
 * One test per surface per fixture — happy path only; the goal is
 * breadth, not depth. Surface-specific tests are gated via
 * `test.if(...)` based on whether each fixture spec opts in.
 */

const sortedNames = (workspaces: { name: string }[]): string[] =>
  workspaces.map((w) => w.name).sort();

describeEachPm("smoke: FileSystemProject end-to-end", ({ pm }) => {
  for (const fixture of PROJECT_SMOKE_FIXTURES) {
    describe(`fixture: ${fixture.name} (${fixture.description})`, () => {
      // No explicit packageManager — loadFixture materializes the
      // PM-specific lockfile via the _pm/<pm>/ overlay, and pacwich's
      // auto-detect picks the right backend from that lockfile. This
      // exercises the full selection chain (auto → lockfile probe →
      // adapter) at the same time as the project surface.
      const makeProject = () =>
        createFileSystemProject({
          ...(fixture.createOptions ?? {}),
          rootDirectory: loadFixture(fixture.name, { pm: pm.id }),
        });

      describe("project properties", () => {
        test("name reflects the root package.json name", () => {
          expect(makeProject().name).toBe(fixture.expected.rootName);
        });

        test("rootDirectory is an absolute path", () => {
          expect(path.isAbsolute(makeProject().rootDirectory)).toBe(true);
        });

        test("rootWorkspace is flagged isRoot and named", () => {
          const project = makeProject();
          expect(project.rootWorkspace.isRoot).toBe(true);
          expect(project.rootWorkspace.name).toBe(fixture.expected.rootName);
        });

        test("workspaces enumerates every detected workspace", () => {
          const project = makeProject();
          expect(sortedNames(project.workspaces)).toEqual(
            [...fixture.expected.workspaceNames].sort(),
          );
        });

        test("sourceType is 'fileSystem'", () => {
          expect(makeProject().sourceType).toBe("fileSystem");
        });

        test("config exposes resolved root config", () => {
          expect(makeProject().config.project.defaults).toBeDefined();
        });

        test("packageManager matches the active backend id", () => {
          expect(makeProject().packageManager).toBe(pm.id);
        });
      });

      describe("workspace lookup", () => {
        test("findWorkspaceByName returns null for an unknown name", () => {
          expect(
            makeProject().findWorkspaceByName("does-not-exist"),
          ).toBeNull();
        });

        const firstWorkspaceName = fixture.expected.workspaceNames[0];
        test.if(Boolean(firstWorkspaceName))(
          "findWorkspaceByName resolves a known workspace",
          () => {
            expect(
              makeProject().findWorkspaceByName(firstWorkspaceName)?.name,
            ).toBe(firstWorkspaceName);
          },
        );

        test.if(Boolean(fixture.knownAlias))(
          "findWorkspaceByAlias resolves by alias",
          () => {
            const { alias, resolvesToWorkspace } = fixture.knownAlias!;
            expect(makeProject().findWorkspaceByAlias(alias)?.name).toBe(
              resolvesToWorkspace,
            );
          },
        );

        test.if(Boolean(fixture.knownAlias))(
          "findWorkspaceByNameOrAlias resolves both forms",
          () => {
            const { alias, resolvesToWorkspace } = fixture.knownAlias!;
            const project = makeProject();
            expect(
              project.findWorkspaceByNameOrAlias(resolvesToWorkspace)?.name,
            ).toBe(resolvesToWorkspace);
            expect(project.findWorkspaceByNameOrAlias(alias)?.name).toBe(
              resolvesToWorkspace,
            );
          },
        );

        test.if(Boolean(fixture.namePattern))(
          "findWorkspacesByPattern matches by name pattern",
          () => {
            const { pattern, matches } = fixture.namePattern!;
            const matched = makeProject().findWorkspacesByPattern(pattern);
            expect(sortedNames(matched)).toEqual([...matches].sort());
          },
        );
      });

      describe("script + tag lookups", () => {
        test.if(Boolean(fixture.knownScript))(
          "listWorkspacesWithScript returns workspaces declaring the script",
          () => {
            const { script, workspaces } = fixture.knownScript!;
            const matched = makeProject().listWorkspacesWithScript(script);
            expect(sortedNames(matched)).toEqual([...workspaces].sort());
          },
        );

        test.if(Boolean(fixture.knownTag))(
          "listWorkspacesWithTag returns workspaces tagged accordingly",
          () => {
            const { tag, workspaces } = fixture.knownTag!;
            const matched = makeProject().listWorkspacesWithTag(tag);
            expect(sortedNames(matched)).toEqual([...workspaces].sort());
          },
        );

        test.if(Boolean(fixture.knownScript))(
          "scriptMap exposes the script with its workspaces",
          () => {
            const { script, workspaces } = fixture.knownScript!;
            const entry = makeProject().scriptMap[script];
            expect(entry?.name).toBe(script);
            expect(sortedNames(entry?.workspaces ?? [])).toEqual(
              [...workspaces].sort(),
            );
          },
        );

        test.if(Boolean(fixture.knownTag))(
          "tagMap exposes the tag with its workspaces",
          () => {
            const { tag, workspaces } = fixture.knownTag!;
            const entry = makeProject().tagMap[tag];
            expect(sortedNames(entry?.workspaces ?? [])).toEqual(
              [...workspaces].sort(),
            );
          },
        );
      });

      describe("script execution", () => {
        test.if(Boolean(fixture.scriptExecution))(
          "runWorkspaceScript runs a single workspace's script to success",
          async () => {
            const { workspace, script, stdoutContains } =
              fixture.scriptExecution!;
            const { exit, output } = makeProject().runWorkspaceScript({
              workspaceNameOrAlias: workspace,
              script,
            });
            let stdout = "";
            let stderr = "";
            for await (const { chunk, metadata } of output.text()) {
              if (metadata.streamName === "stdout") stdout += chunk;
              else stderr += chunk;
            }
            const result = await exit;
            expect(
              result.success,
              `runWorkspaceScript(${workspace}, ${script}) exited ${result.exitCode} (signal=${result.signal}); stderr:\n${stderr}\nstdout:\n${stdout}`,
            ).toBe(true);
            expect(stdout).toContain(stdoutContains);
          },
        );

        test.if(Boolean(fixture.fanoutScript))(
          "runScriptAcrossWorkspaces fans out across matching workspaces",
          async () => {
            const { script, expectedSuccessWorkspaceCount } =
              fixture.fanoutScript!;
            const result = makeProject().runScriptAcrossWorkspaces({ script });
            let combined = "";
            for await (const { chunk, metadata } of result.output.text()) {
              combined += `[${metadata.workspace.name}/${metadata.streamName}] ${chunk}`;
            }
            const summary = await result.summary;
            expect(
              summary.allSuccess,
              `runScriptAcrossWorkspaces(${script}) had failures; per-workspace exits: ${summary.scriptResults
                .map(
                  (e) =>
                    `${e.metadata.workspace.name}=${e.exitCode}(signal=${e.signal})`,
                )
                .join(", ")}\noutput:\n${combined}`,
            ).toBe(true);
            expect(result.workspaces.length).toBe(
              expectedSuccessWorkspaceCount,
            );
          },
        );
      });

      describe("affected workflows", () => {
        test.if(Boolean(fixture.affected))(
          "determineAffectedWorkspaces flags workspaces matching file changes",
          async () => {
            const { changedFiles, expectedAffectedNames } = fixture.affected!;
            const result = await makeProject().determineAffectedWorkspaces({
              diffSource: "fileList",
              changedFiles,
            });
            const affectedNames = result.workspaceResults
              .filter((w) => w.isAffected)
              .map((w) => w.workspace.name)
              .sort();
            expect(affectedNames).toEqual([...expectedAffectedNames].sort());
          },
        );

        test.if(Boolean(fixture.affected))(
          "runAffectedWorkspaceScript only runs on affected workspaces",
          async () => {
            const {
              changedFiles,
              runScriptName,
              expectedRunNames,
              ignoreWorkspaceDependencies,
            } = fixture.affected!;
            const result = await makeProject().runAffectedWorkspaceScript({
              affectedOptions: {
                diffSource: "fileList",
                changedFiles,
                ignoreWorkspaceDependencies,
              },
              scriptOptions: { script: runScriptName },
            });
            for await (const _ of result.output.text()) {
              /* drain */
            }
            await result.summary;
            expect(sortedNames(result.workspaces)).toEqual(
              [...expectedRunNames].sort(),
            );
          },
        );
      });
    });
  }
});
