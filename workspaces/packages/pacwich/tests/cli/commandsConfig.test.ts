import {
  CLI_COMMANDS_CONFIG,
  getCliGlobalOptionConfig,
  getCliGlobalOptionNames,
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
