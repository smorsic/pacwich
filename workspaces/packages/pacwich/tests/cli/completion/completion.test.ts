import {
  SUPPORTED_COMPLETION_SHELLS,
  filterCompletionCandidates,
  getCompletionScript,
  planCompletion,
  type CompletionGroup,
  type ProjectGroup,
  type StaticGroup,
} from "@pacwich/common/cli";
import { describe, expect, test } from "../../util/testFramework";

/**
 * `planCompletion` is the project-free brain of shell completion: it turns
 * the words on the command line (last = the partial under the cursor) into
 * ordered candidate groups. These tests pin its grammar without a shell or
 * a loaded project, since dynamic groups only name a source to resolve.
 */

const staticGroup = (
  groups: CompletionGroup[],
  label: string,
): StaticGroup | undefined =>
  groups.find(
    (group): group is StaticGroup =>
      group.kind === "static" && group.label === label,
  );

const projectGroup = (
  groups: CompletionGroup[],
  source: ProjectGroup["source"],
): ProjectGroup | undefined =>
  groups.find(
    (group): group is ProjectGroup =>
      group.kind === "dynamic" && group.source === source,
  );

const staticValues = (group: StaticGroup | undefined): string[] =>
  (group?.items ?? []).map((item) => item.value);

describe("filterCompletionCandidates", () => {
  test("keeps prefix matches, de-duplicates, and sorts", () => {
    expect(
      filterCompletionCandidates(
        ["build", "build:dev", "lint", "build"],
        "bui",
      ),
    ).toEqual(["build", "build:dev"]);
  });

  test("empty prefix keeps everything (still de-duped and sorted)", () => {
    expect(filterCompletionCandidates(["b", "a", "a"], "")).toEqual(["a", "b"]);
  });

  test("scoped @names cluster together, ahead of plain names", () => {
    // Not interleaved as if the leading @ were absent: all @scope/* first
    // (sorted), then plain names (sorted).
    expect(
      filterCompletionCandidates(
        ["pacwich", "@demo/utils", "demo-monorepo", "@demo/core", "@acme/ui"],
        "",
      ),
    ).toEqual([
      "@acme/ui",
      "@demo/core",
      "@demo/utils",
      "demo-monorepo",
      "pacwich",
    ]);
  });
});

describe("getCompletionScript", () => {
  for (const shell of SUPPORTED_COMPLETION_SHELLS) {
    test(`${shell} script is non-empty and calls the __complete backend`, () => {
      const script = getCompletionScript(shell);
      expect(script.length).toBeGreaterThan(0);
      expect(script).toContain("pacwich __complete --");
    });
  }

  test("each shell registers its completion the shell's way", () => {
    expect(getCompletionScript("bash")).toContain(
      "complete -F _pacwich_complete pacwich",
    );
    expect(getCompletionScript("zsh")).toContain("#compdef pacwich");
    expect(getCompletionScript("fish")).toContain("complete -c pacwich");
  });

  test("zsh script registers via compdef when sourced, not by self-invoking", () => {
    // Under `eval "$(pacwich completion zsh)"` the function runs at top level
    // with no completion context ($CURRENT unset), so it must register with
    // compdef rather than call itself unconditionally. Regression guard.
    const script = getCompletionScript("zsh");
    expect(script).toContain("compdef _pacwich pacwich");
    expect(script).not.toMatch(/^_pacwich "\$@"$/m);
  });

  test("zsh script enables titled groups and honors nospace", () => {
    const script = getCompletionScript("zsh");
    expect(script).toContain("group-name ''"); // separate titled sections
    expect(script).toContain("_describe -t"); // per-label grouping
    expect(script).toContain("-S ''"); // no trailing space for nospace groups
  });

  test("bash script honors nospace via compopt", () => {
    // bash can't show groups, but it can suppress the trailing space.
    expect(getCompletionScript("bash")).toContain("compopt -o nospace");
  });

  test("zsh option group headings read 'options' and 'global options'", () => {
    const script = getCompletionScript("zsh");
    expect(script).toContain("command-option 'options'");
    expect(script).toContain("global-option 'global options'");
  });

  test("zsh script heading reads 'workspace scripts'", () => {
    expect(getCompletionScript("zsh")).toContain("script 'workspace scripts'");
  });

  test("zsh pattern group headings read 'workspace patterns' and 'root selector'", () => {
    const script = getCompletionScript("zsh");
    expect(script).toContain("specifier 'workspace patterns'");
    expect(script).toContain("root-selector 'root selector'");
  });

  test("zsh derives a specific heading for option value groups", () => {
    // value-output-style -> "output style value", generically.
    const script = getCompletionScript("zsh");
    expect(script).toContain("value-*");
    expect(script).toContain('} value"');
  });

  test("zsh names workspace groups and preserves their scoped order", () => {
    const script = getCompletionScript("zsh");
    expect(script).toContain("'workspace names'");
    expect(script).toContain("'workspace aliases'");
    // Backend order (scoped @names clustered) is kept for these tags.
    expect(script).toContain(":workspace' sort false");
    expect(script).toContain(":alias' sort false");
  });
});

describe("planCompletion — commands", () => {
  test("empty line offers command names and aliases", () => {
    const group = staticGroup(planCompletion([""]), "command");
    const values = staticValues(group);
    expect(values).toContain("run-script");
    expect(values).toContain("run"); // alias
    expect(values).toContain("doctor");
    expect(values).toContain("completion");
    expect(values).toContain("affected");
    // A subcommand-only word never leaks into the top-level offering.
    expect(values).not.toContain("install");
  });

  test("a partial command still offers the command group (shell filters)", () => {
    expect(staticGroup(planCompletion(["ru"]), "command")).toBeDefined();
  });

  test("a leading dash with no command offers only global options", () => {
    const group = staticGroup(planCompletion(["-"]), "global-option");
    const values = staticValues(group);
    expect(values).toContain("--log-level");
    expect(values).toContain("--cwd");
    // No command yet, so there is no command-option group at all.
    expect(
      staticGroup(planCompletion(["-"]), "command-option"),
    ).toBeUndefined();
    expect(values).not.toContain("--script"); // command-scoped, no command yet
  });
});

describe("planCompletion — scripts", () => {
  test("run <TAB> completes scripts, project-wide", () => {
    const group = projectGroup(planCompletion(["run", ""]), "script");
    expect(group).toBeDefined();
    expect(group?.workspaceScope).toBeUndefined();
    expect(group?.prefix).toBe("");
  });

  test("-W scopes script completion to those workspace patterns", () => {
    const group = projectGroup(
      planCompletion(["run", "-W", "my-lib", ""]),
      "script",
    );
    expect(group?.workspaceScope).toEqual(["my-lib"]);
  });

  test("a value that follows -S is not mistaken for the command", () => {
    // `--log-level info run <TAB>`: the enum value is consumed, `run` is the
    // command, so we land on the script slot.
    expect(
      projectGroup(
        planCompletion(["--log-level", "info", "run", ""]),
        "script",
      ),
    ).toBeDefined();
  });
});

describe("planCompletion — workspace patterns", () => {
  test("bare pattern slot offers names, aliases, and pattern prefixes", () => {
    const groups = planCompletion(["run", "build", ""]);
    expect(projectGroup(groups, "workspaceName")).toBeDefined();
    expect(projectGroup(groups, "workspaceAlias")).toBeDefined();
    // Targets, the re: regex modifier, and negation are all surfaced.
    expect(staticValues(staticGroup(groups, "specifier"))).toEqual(
      expect.arrayContaining([
        "path:",
        "alias:",
        "name:",
        "tag:",
        "re:",
        "not:",
      ]),
    );
    // Pattern prefixes leave no trailing space (a value is typed after).
    expect(staticGroup(groups, "specifier")?.noSpace).toBe(true);
    // Actual workspace/alias values are complete, so they keep the space.
    expect(projectGroup(groups, "workspaceName")?.noSpace).toBeFalsy();
    expect(projectGroup(groups, "workspaceAlias")?.noSpace).toBeFalsy();
  });

  test("the @root selector is offered as a complete value (keeps its space)", () => {
    const groups = planCompletion(["run", "build", ""]);
    const root = staticGroup(groups, "root-selector");
    expect(staticValues(root)).toContain("@root");
    expect(root?.noSpace).toBeFalsy();
    // Negation carries into it too: not:@root.
    expect(
      staticValues(
        staticGroup(planCompletion(["run", "build", "not:"]), "root-selector"),
      ),
    ).toContain("not:@root");
  });

  test("a re: regex value has nothing to prefix-complete", () => {
    // Bare re: and target-scoped target:re: are regexes, so no groups.
    expect(planCompletion(["run", "build", "re:^foo"])).toEqual([]);
    expect(planCompletion(["run", "build", "path:re:foo"])).toEqual([]);
  });

  test("an explicit target narrows to one source with a value prefix", () => {
    const groups = planCompletion(["run", "build", "alias:my"]);
    const group = projectGroup(groups, "workspaceAlias");
    expect(group?.valuePrefix).toBe("alias:");
    expect(group?.prefix).toBe("my");
    // Only the alias source — not name/path/tag.
    expect(projectGroup(groups, "workspaceName")).toBeUndefined();
  });

  test("negation is carried into the value prefix", () => {
    const group = projectGroup(
      planCompletion(["verify", "not:"]),
      "workspaceName",
    );
    expect(group?.valuePrefix).toBe("not:");
  });

  test("tag: target resolves to the tag source", () => {
    const group = projectGroup(planCompletion(["run", "build", "tag:"]), "tag");
    expect(group?.valuePrefix).toBe("tag:");
  });
});

describe("planCompletion — option values", () => {
  test("--log-level offers its enum values", () => {
    const values = staticValues(
      staticGroup(
        planCompletion(["run", "--log-level", ""]),
        "value-log-level",
      ),
    );
    expect(values).toEqual(expect.arrayContaining(["debug", "info", "silent"]));
  });

  test("--output-style=<partial> completes the inline enum value", () => {
    const values = staticValues(
      staticGroup(
        planCompletion(["run", "--output-style=pl"]),
        "value-output-style",
      ),
    );
    expect(values).toContain("--output-style=plain");
  });

  test("value groups are labeled per option (for a specific heading)", () => {
    // The label carries the option so shells can title the group, e.g.
    // value-shell -> "shell value" in zsh.
    expect(
      staticGroup(planCompletion(["run", "--shell", ""]), "value-shell"),
    ).toBeDefined();
    expect(
      staticGroup(planCompletion(["--log-level", ""]), "value-log-level"),
    ).toBeDefined();
  });

  test("option-name completion excludes deprecated flags", () => {
    const values = staticValues(
      staticGroup(planCompletion(["run", "-"]), "command-option"),
    );
    expect(values).toContain("--script");
    expect(values).not.toContain("--no-prefix"); // deprecated
  });

  test("options with a fixed value set lead the description with the values", () => {
    const global = staticGroup(planCompletion(["-"]), "global-option");
    const logLevel = global?.items.find((item) => item.value === "--log-level");
    // Values lead so they survive truncation of a long description.
    expect(logLevel?.description?.startsWith("[")).toBe(true);
    expect(logLevel?.description).toContain("debug");
    expect(logLevel?.description).toContain("silent");
    // A free-form option keeps a plain description (no bracketed value set).
    const cwd = global?.items.find((item) => item.value === "--cwd");
    expect(cwd?.description).not.toContain("[");

    // Same for a command option like --shell.
    const command = staticGroup(planCompletion(["run", "-"]), "command-option");
    const shell = command?.items.find((item) => item.value === "--shell");
    expect(shell?.description).toMatch(/^\[.*bun.*\]/);
  });

  test("command options and global options are separate groups", () => {
    const groups = planCompletion(["run", "-"]);
    // The command's own options land in "command-option"...
    expect(staticValues(staticGroup(groups, "command-option"))).toContain(
      "--script",
    );
    // ...and the globals in their own "global-option" group.
    const globals = staticValues(staticGroup(groups, "global-option"));
    expect(globals).toContain("--log-level");
    expect(globals).toContain("--cwd");
    expect(globals).not.toContain("--script");
  });
});

describe("planCompletion — single-positional commands", () => {
  test("workspace-info completes a workspace by name or alias", () => {
    const groups = planCompletion(["info", ""]);
    expect(projectGroup(groups, "workspaceName")).toBeDefined();
    expect(projectGroup(groups, "workspaceAlias")).toBeDefined();
    // A single workspace, so no pattern specifiers.
    expect(staticGroup(groups, "specifier")).toBeUndefined();
  });

  test("tag-info completes a tag", () => {
    expect(projectGroup(planCompletion(["tag-info", ""]), "tag")).toBeDefined();
  });

  test("run-interactive completes the workspace in its second positional", () => {
    expect(
      projectGroup(planCompletion(["ri", "lint", ""]), "workspaceName"),
    ).toBeDefined();
  });

  test("completion completes the shell name and its subcommand, as separate groups", () => {
    const groups = planCompletion(["completion", ""]);
    expect(staticValues(staticGroup(groups, "shell"))).toEqual([
      "bash",
      "zsh",
      "fish",
    ]);
    expect(staticValues(staticGroup(groups, "subcommand"))).toEqual([
      "install",
    ]);
  });

  test("completion install <TAB> completes the shell to install for", () => {
    expect(
      staticValues(
        staticGroup(planCompletion(["completion", "install", ""]), "shell"),
      ),
    ).toEqual(["bash", "zsh", "fish"]);
    // The parent's own shell-print positional does not leak into the child.
    expect(
      staticGroup(planCompletion(["completion", "install", ""]), "subcommand"),
    ).toBeUndefined();
  });
});

describe("planCompletion: parent/child commands", () => {
  test("affected <TAB> offers its subcommands and their aliases", () => {
    expect(
      staticValues(staticGroup(planCompletion(["affected", ""]), "subcommand")),
    ).toEqual(["list", "ls", "run"]);
  });

  test("a bare subcommand word does not resolve at the top level", () => {
    // "install"/"list"/"run" (as affected's children) only mean anything
    // once preceded by their parent, so an empty/partial line still offers
    // the full top-level command group.
    const group = staticGroup(planCompletion(["install", ""]), "command");
    expect(group).toBeDefined();
  });

  test("affected list <TAB> falls through to that child's own options", () => {
    const groups = planCompletion(["affected", "list", "-"]);
    expect(staticValues(staticGroup(groups, "command-option"))).toContain(
      "--explain",
    );
  });

  test("affected run <TAB> completes scripts, like run-affected", () => {
    expect(
      projectGroup(planCompletion(["affected", "run", ""]), "script"),
    ).toBeDefined();
  });
});

describe("planCompletion — options fallback when positionals are exhausted", () => {
  test("a command that takes no positionals offers options", () => {
    // doctor has no positional slot, so completing there offers flags.
    expect(
      staticGroup(planCompletion(["doctor", ""]), "global-option"),
    ).toBeDefined();
  });

  test("a single-positional command offers options once that slot is filled", () => {
    const groups = planCompletion(["tag-info", "some-tag", ""]);
    expect(projectGroup(groups, "tag")).toBeUndefined(); // slot already filled
    expect(staticGroup(groups, "global-option")).toBeDefined();
  });

  test("run-interactive offers options after script and workspace are given", () => {
    const groups = planCompletion(["ri", "lint", "my-ws", ""]);
    expect(staticGroup(groups, "command-option")).toBeDefined();
    expect(staticGroup(groups, "global-option")).toBeDefined();
  });
});
