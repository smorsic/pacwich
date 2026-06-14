import os from "os";
import path from "path";

export const IS_WINDOWS = process.platform === "win32";
export const IS_MACOS = process.platform === "darwin";
export const IS_LINUX = process.platform === "linux";
export const IS_POSIX = IS_MACOS || IS_LINUX;

/** Expands a leading `~` or `~/` to the user's home directory */
export const expandHomePath = (filePath: string): string => {
  if (filePath === "~") return os.homedir();
  if (filePath.startsWith("~/") || filePath.startsWith("~\\")) {
    return path.join(os.homedir(), filePath.slice(2));
  }
  return filePath;
};
