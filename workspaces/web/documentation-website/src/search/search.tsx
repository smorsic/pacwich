import { type OnSearch } from "@rspress/core/theme-original";
import { getCliGlobalOptionsContent, getCliCommandsContent } from "../lib/cli";
import { getCommandId, getGlobalOptionId } from "../lib/cli/searchIds";

const sanitize = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^.-_0-9A-Za-z/]/g, "");

const matches = (s: string, query: string) =>
  sanitize(s).includes(sanitize(query)) ||
  sanitize(query).includes(sanitize(s));

const EXTERNAL_LINKS = [
  {
    statement: "Changelog",
    link: process.env.CHANGELOG_URL ?? "",
    title: "GitHub Releases | All Versions",
    keywords: ["changelog", "notes", "releases", "versions"],
  },
  {
    statement: "Blog",
    link: process.env.BLOG_URL ?? "",
    title: "Smorsic Labs Blog | Release Posts",
    keywords: ["blog"],
  },
];

const onSearch: OnSearch = async (query, defaultResult) => {
  query = sanitize(query);

  for (const { statement, link, title, keywords } of EXTERNAL_LINKS) {
    if (keywords.some((keyword) => matches(keyword, query))) {
      defaultResult[0].result?.splice(0, 0, {
        statement,
        link,
        type: "content",
        title,
        header: "",
        query: "",
        highlightInfoList: [],
      });
    }
  }

  for (const command of getCliCommandsContent()) {
    if (
      matches(command.title, query) ||
      (typeof command.description === "string" &&
        matches(command.description, query)) ||
      matches(command.command, query) ||
      matches(command.commandName, query) ||
      Object.values(command.options).some(
        (option) =>
          matches(option.flags[option.flags.length - 1], query) ||
          matches(option.description, query),
      )
    ) {
      defaultResult[0].result?.push({
        statement: "CLI Command: " + command.title,
        link: "/cli/commands#" + getCommandId(command),
        type: "content",
        title: "CLI | Commands",
        header: "",
        query: "",
        highlightInfoList: [],
      });
    }
  }
  for (const globalOption of getCliGlobalOptionsContent()) {
    if (
      matches(globalOption.title as string, query) ||
      matches(globalOption.optionName, query) ||
      matches(globalOption.mainOption, query) ||
      matches(globalOption.shortOption, query) ||
      matches(globalOption.defaultValue, query) ||
      (typeof globalOption.description === "string" &&
        matches(globalOption.description, query))
    ) {
      defaultResult[0].result?.push({
        statement:
          "CLI Global Option: " +
          globalOption.title +
          " (" +
          globalOption.mainOption +
          " | " +
          globalOption.shortOption +
          ")",
        link: "/cli/global-options#" + getGlobalOptionId(globalOption),
        type: "content",
        title: "CLI | Global Options",
        header: "",
        query: "",
        highlightInfoList: [],
      });
    }
  }
  return [];
};

export { onSearch };
