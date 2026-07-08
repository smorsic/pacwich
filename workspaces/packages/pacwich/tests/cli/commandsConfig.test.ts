import {
  CLI_COMMANDS_CONFIG,
  getCliGlobalOptionConfig,
  getCliGlobalOptionNames,
  isGlobalCliCommandToken,
  resolveCliCommandName,
  type CliCommandConfig,
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
  string,
  CliCommandConfig,
][];

/** The invoked command name is the first token of the `command` string. */
const commandName = (config: CliCommandConfig) =>
  config.command.trim().split(/\s+/)[0];

describe("CLI commands config integrity", () => {
  test("no command name or alias clashes with another", () => {
    const seen = new Map<string, string>();
    const clashes: string[] = [];

    for (const [key, config] of commandEntries) {
      const tokens = [commandName(config), ...config.aliases];
      for (const token of tokens) {
        const owner = seen.get(token);
        if (owner) {
          clashes.push(`"${token}" used by both ${owner} and ${key}`);
        } else {
          seen.set(token, key);
        }
      }
    }

    expect(clashes).toEqual([]);
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

  test("resolves every configured command word and alias", () => {
    for (const [key, config] of commandEntries) {
      expect(resolveCliCommandName(commandName(config))).toBe(key);
      for (const alias of config.aliases) {
        expect(resolveCliCommandName(alias)).toBe(key);
      }
    }
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

  test("agrees with each command's isGlobal flag", () => {
    for (const config of commandEntries.map(([, value]) => value)) {
      expect(isGlobalCliCommandToken(commandName(config))).toBe(
        config.isGlobal,
      );
    }
  });
});
