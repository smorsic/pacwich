import {
  CLI_COMMANDS_CONFIG,
  getCliCommandConfig,
  getCliGlobalOptionConfig,
  getCliGlobalOptionNames,
  getCliSubcommandNames,
  getCliTopLevelCommandNames,
  isGlobalCliCommandToken,
  resolveCliCommandName,
  resolveCliSubcommandName,
  type CliCommandConfig,
  type CliCommandName,
} from "@pacwich/common";
import { describe, expect, test } from "../util/testFramework";

/**
 * Extract the bare flag token from a flag spec, dropping any
 * parameter placeholder. e.g. "--script <script>" -> "--script",
 * "-P" -> "-P", "--parallel [max]" -> "--parallel".
 */
const flagToken = (flagSpec: string) => flagSpec.trim().split(/\s+/)[0];

/** All flag tokens declared by a single command's options. */
const commandFlagTokens = (config: CliCommandConfig) =>
  Object.values(config.options).flatMap((option) =>
    option.flags.map(flagToken),
  );

/** All flag tokens declared by the global options. */
const globalFlagTokens = () =>
  getCliGlobalOptionNames().flatMap((name) => {
    const { mainOption, shortOption } = getCliGlobalOptionConfig(name);
    return [mainOption, shortOption].filter(Boolean).map(flagToken);
  });

const commandEntries = Object.entries(CLI_COMMANDS_CONFIG) as [
  CliCommandName,
  CliCommandConfig,
][];

/** The invoked command name is the first token of the `command` string. */
const commandName = (config: CliCommandConfig) =>
  config.command.trim().split(/\s+/)[0];

describe("CLI commands config integrity", () => {
  test("no top-level command name or alias clashes with another", () => {
    const seen = new Map<string, string>();
    const clashes: string[] = [];

    for (const name of getCliTopLevelCommandNames()) {
      const config = CLI_COMMANDS_CONFIG[name];
      const tokens = [commandName(config), ...config.aliases];
      for (const token of tokens) {
        const owner = seen.get(token);
        if (owner) {
          clashes.push(`"${token}" used by both ${owner} and ${name}`);
        } else {
          seen.set(token, name);
        }
      }
    }

    expect(clashes).toEqual([]);
  });

  test("no subcommand name or alias clashes with a sibling under the same parent", () => {
    const parents = new Set(
      commandEntries
        .map(([, config]) => config.parent)
        .filter((parent): parent is CliCommandName => !!parent),
    );
    const clashes: string[] = [];

    for (const parent of parents) {
      const seen = new Map<string, string>();
      for (const name of getCliSubcommandNames(parent)) {
        const config = CLI_COMMANDS_CONFIG[name];
        const tokens = [commandName(config), ...config.aliases];
        for (const token of tokens) {
          const owner = seen.get(token);
          if (owner) {
            clashes.push(
              `"${token}" used by both ${owner} and ${name} under "${parent}"`,
            );
          } else {
            seen.set(token, name);
          }
        }
      }
    }

    expect(clashes).toEqual([]);
  });

  test("only one level of nesting is allowed: no parent itself has a parent", () => {
    // The `parent` field's own doc comment states this constraint. Nothing in
    // the type system enforces it (a `parent` may point at any CliCommandName),
    // so it's checked here instead. CLI registration would also throw for a
    // grandchild (its "parent" is never a direct child of the root program),
    // but that's a runtime crash on the actual binary, not a caught invariant.
    const parentNames = new Set(
      commandEntries
        .map(([, config]) => config.parent)
        .filter((parent): parent is CliCommandName => !!parent),
    );
    const violations = [...parentNames].filter(
      (name) => !!getCliCommandConfig(name).parent,
    );

    expect(violations).toEqual([]);
  });

  test("no command option clashes with a global option", () => {
    const globalTokens = new Set(globalFlagTokens());
    const clashes: string[] = [];

    for (const [key, config] of commandEntries) {
      for (const token of commandFlagTokens(config)) {
        if (globalTokens.has(token)) {
          clashes.push(`${key} option "${token}" clashes with a global option`);
        }
      }
    }

    expect(clashes).toEqual([]);
  });

  test("no option flags clash within a single command", () => {
    const clashes: string[] = [];

    for (const [key, config] of commandEntries) {
      const seen = new Set<string>();
      for (const token of commandFlagTokens(config)) {
        if (seen.has(token)) {
          clashes.push(`${key} declares "${token}" more than once`);
        } else {
          seen.add(token);
        }
      }
    }

    expect(clashes).toEqual([]);
  });
});

describe("resolveCliCommandName", () => {
  test("resolves a command word to its canonical name", () => {
    expect(resolveCliCommandName("list-workspaces")).toBe("listWorkspaces");
    expect(resolveCliCommandName("completion")).toBe("completion");
  });

  test("resolves an alias to its canonical name", () => {
    expect(resolveCliCommandName("ls")).toBe("listWorkspaces");
    expect(resolveCliCommandName("run")).toBe("runScript");
    expect(resolveCliCommandName("ls-affected")).toBe("listAffected");
  });

  test("returns null for an unknown token", () => {
    expect(resolveCliCommandName("does-not-exist")).toBeNull();
    expect(resolveCliCommandName("")).toBeNull();
  });

  test("does not match a partial command word", () => {
    // "list" is a real alias of listWorkspaces, but "lis" is not.
    expect(resolveCliCommandName("lis")).toBeNull();
    expect(resolveCliCommandName("completio")).toBeNull();
  });

  test("does not resolve a subcommand word at the top level", () => {
    // "install" is only meaningful as `completion install`.
    expect(resolveCliCommandName("install")).toBeNull();
  });

  test("resolves every top-level command word and alias", () => {
    for (const name of getCliTopLevelCommandNames()) {
      const config = CLI_COMMANDS_CONFIG[name];
      expect(resolveCliCommandName(commandName(config))).toBe(name);
      for (const alias of config.aliases) {
        expect(resolveCliCommandName(alias)).toBe(name);
      }
    }
  });
});

describe("resolveCliSubcommandName", () => {
  test("resolves every configured subcommand word and alias under its parent", () => {
    for (const [key, config] of commandEntries) {
      if (!config.parent) continue;
      // AssertNoInvalidParents guarantees parent is valid.
      const parent = config.parent as CliCommandName;
      expect(resolveCliSubcommandName(parent, commandName(config))).toBe(key);
      for (const alias of config.aliases) {
        expect(resolveCliSubcommandName(parent, alias)).toBe(key);
      }
    }
  });

  test("returns null for a subcommand word under the wrong parent", () => {
    expect(resolveCliSubcommandName("affected", "install")).toBeNull();
    expect(resolveCliSubcommandName("completion", "list")).toBeNull();
  });

  test("returns null for an unknown token", () => {
    expect(resolveCliSubcommandName("affected", "does-not-exist")).toBeNull();
  });

  test("a subcommand word/alias can reuse a top-level word/alias from an unrelated command", () => {
    // "list"/"ls" are both top-level aliases of `listWorkspaces` and, under
    // `affected`, the word/alias of `affectedList`. Different Commander
    // command paths, so each namespace must resolve independently.
    expect(resolveCliCommandName("list")).toBe("listWorkspaces");
    expect(resolveCliCommandName("ls")).toBe("listWorkspaces");
    expect(resolveCliSubcommandName("affected", "list")).toBe("affectedList");
    expect(resolveCliSubcommandName("affected", "ls")).toBe("affectedList");
  });
});

describe("isGlobalCliCommandToken", () => {
  test("is true for global command words", () => {
    expect(isGlobalCliCommandToken("completion")).toBe(true);
    expect(isGlobalCliCommandToken("doctor")).toBe(true);
    expect(isGlobalCliCommandToken("mcp-server")).toBe(true);
    expect(isGlobalCliCommandToken("add-skills")).toBe(true);
  });

  test("is false for project command words and aliases", () => {
    expect(isGlobalCliCommandToken("list-workspaces")).toBe(false);
    expect(isGlobalCliCommandToken("ls")).toBe(false);
    expect(isGlobalCliCommandToken("run")).toBe(false);
    expect(isGlobalCliCommandToken("verify")).toBe(false);
  });

  test("is false for an unknown token or undefined", () => {
    expect(isGlobalCliCommandToken("does-not-exist")).toBe(false);
    expect(isGlobalCliCommandToken("")).toBe(false);
    expect(isGlobalCliCommandToken(undefined)).toBe(false);
  });

  test("agrees with each top-level command's isGlobal flag", () => {
    for (const name of getCliTopLevelCommandNames()) {
      const config = CLI_COMMANDS_CONFIG[name];
      expect(isGlobalCliCommandToken(commandName(config))).toBe(
        config.isGlobal,
      );
    }
  });

  describe("with a second token (parent/child dispatch)", () => {
    test("resolves scope from the matched child, not the parent", () => {
      expect(isGlobalCliCommandToken("affected", "list")).toBe(false);
      expect(isGlobalCliCommandToken("affected", "run")).toBe(false);
      expect(isGlobalCliCommandToken("completion", "install")).toBe(true);
    });

    test("bare parent invocation is global only when every child is global", () => {
      // affected's children (list/run) are project-scoped.
      expect(isGlobalCliCommandToken("affected")).toBe(false);
      // completion's only child (install) is global.
      expect(isGlobalCliCommandToken("completion")).toBe(true);
    });

    test("an unmatched second token falls back to the bare-parent rule", () => {
      expect(isGlobalCliCommandToken("affected", "does-not-exist")).toBe(false);
      expect(isGlobalCliCommandToken("completion", "does-not-exist")).toBe(
        true,
      );
    });

    test("a second token is ignored for a command with no children", () => {
      expect(isGlobalCliCommandToken("doctor", "anything")).toBe(true);
      expect(isGlobalCliCommandToken("verify", "anything")).toBe(false);
    });
  });
});
