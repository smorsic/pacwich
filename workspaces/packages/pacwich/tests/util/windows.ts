import { IS_WINDOWS } from "../../src/internal/core";

export const withWindowsPath = (p: string) =>
  IS_WINDOWS ? p.replaceAll("/", "\\") : p;
