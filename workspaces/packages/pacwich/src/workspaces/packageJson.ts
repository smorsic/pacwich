import fs from "fs";
import path from "path";
import { isJSONObject } from "@pacwich/common/types";
import { logger } from "../internal/logger";
import { WORKSPACE_ERRORS } from "./errors";

export const resolvePackageJsonPath = (directoryItem: string) => {
  if (path.basename(directoryItem) === "package.json") {
    return directoryItem;
  }
  if (fs.existsSync(path.join(directoryItem, "package.json"))) {
    return path.join(directoryItem, "package.json");
  }
  return "";
};

export type UnknownPackageJson = Record<string, unknown>;

export type ResolvedPackageJsonContent = {
  name: string;
  version?: string;
  scripts: Record<string, string>;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  peerDependencies: Record<string, string>;
  optionalDependencies: Record<string, string>;
} & UnknownPackageJson;

const validateJsonRoot = (json: unknown): UnknownPackageJson => {
  if (!isJSONObject(json) || Array.isArray(json)) {
    throw new WORKSPACE_ERRORS.InvalidPackageJson(
      `Expected package.json to be an object, got ${typeof json}`,
    );
  }
  return json as UnknownPackageJson;
};

/**
 * Read and parse a `package.json` file, returning the raw object. Generic
 * across package managers, no workspace/catalog/dependency interpretation.
 * Throws {@link WORKSPACE_ERRORS.InvalidPackageJson} on read or parse failure.
 */
export const readPackageJson = (
  packageJsonPath: string,
): UnknownPackageJson => {
  let json: unknown = {};
  try {
    json = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
  } catch (error) {
    logger.error(error as Error);
    throw new WORKSPACE_ERRORS.InvalidPackageJson(
      `Failed to read and parse package.json at ${packageJsonPath}: ${
        (error as Error).message
      }`,
    );
  }
  return validateJsonRoot(json);
};

const validateName = (json: UnknownPackageJson) => {
  if (typeof json.name !== "string") {
    throw new WORKSPACE_ERRORS.NoWorkspaceName(
      `Expected package.json to have a string "name" field${
        json.name !== undefined ? ` (Received ${json.name})` : ""
      }`,
    );
  }

  if (!json.name.trim()) {
    throw new WORKSPACE_ERRORS.NoWorkspaceName(
      `Expected package.json to have a non-empty "name" field`,
    );
  }

  if (json.name.includes("*")) {
    throw new WORKSPACE_ERRORS.InvalidWorkspaceName(
      `Package name cannot contain the character '*' (workspace: "${json.name}")`,
    );
  }

  return json.name;
};

const validateScripts = (json: UnknownPackageJson) => {
  if (
    json.scripts &&
    (typeof json.scripts !== "object" || Array.isArray(json.scripts))
  ) {
    throw new WORKSPACE_ERRORS.InvalidScripts(
      `Expected package.json to have an object "scripts" field`,
    );
  }

  if (json.scripts) {
    for (const value of Object.values(json.scripts)) {
      if (typeof value !== "string") {
        throw new WORKSPACE_ERRORS.InvalidScripts(
          `Expected workspace "${json.name}" script "${JSON.stringify(
            json.scripts,
          )}" to be a string, got ${typeof value}`,
        );
      }
    }
  }

  return {
    ...(json.scripts as Record<string, string>),
  };
};

export const resolvePackageJsonContent = (
  packageJsonPath: string,
  validations: ("name" | "scripts")[],
): ResolvedPackageJsonContent => {
  const json = readPackageJson(packageJsonPath);

  return {
    ...json,
    // Dependency data types are validated by the active package manager at install
    // @todo investigate whether we need to validate any of these fields here
    dependencies: (json.dependencies as Record<string, string>) ?? {},
    devDependencies: (json.devDependencies as Record<string, string>) ?? {},
    peerDependencies: (json.peerDependencies as Record<string, string>) ?? {},
    optionalDependencies:
      (json.optionalDependencies as Record<string, string>) ?? {},
    name: validations.includes("name")
      ? validateName(json)
      : ((json.name as string) ?? ""),
    version: typeof json.version === "string" ? json.version : undefined,
    scripts: validations.includes("scripts")
      ? validateScripts(json)
      : ((json.scripts ?? {}) as Record<string, string>),
  };
};
