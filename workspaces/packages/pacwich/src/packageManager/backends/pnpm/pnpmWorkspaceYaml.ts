import fs from "fs";
import path from "path";
import { isJSONObject } from "@pacwich/common/types";
import { parse as parseYaml } from "../../../internal/bundledDeps/yaml";
import { type PacwichError } from "../../../internal/core";
import type { CatalogSet } from "../../adapter/adapterTypes";
import { PNPM_ERRORS } from "./errors";

/** Project-relative path to `pnpm-workspace.yaml`. */
export const PNPM_WORKSPACE_YAML_PROJECT_RELATIVE_PATH = "pnpm-workspace.yaml";

/**
 * Relevant subset of `pnpm-workspace.yaml`. pnpm reads workspace globs
 * from `packages` (NOT from `package.json.workspaces`, see
 * `PNPM_FINDINGS.md`). `catalog`/`catalogs` follow the same shape as
 * bun's catalog data.
 */
export type RelevantPnpmWorkspaceYaml = {
  packages: string[];
  catalogs: CatalogSet;
};

const isStringRecord = (value: unknown): value is Record<string, string> => {
  if (!isJSONObject(value)) return false;
  for (const entry of Object.values(value)) {
    if (typeof entry !== "string") return false;
  }
  return true;
};

/**
 * Parse the contents of a `pnpm-workspace.yaml` file. Returns an
 * error instance on malformed YAML or unexpected top-level shape;
 * missing keys are tolerated (treated as empty).
 *
 * `yamlPath` is used only in error messages.
 */
export const parsePnpmWorkspaceYaml = (
  yamlString: string,
  yamlPath?: string,
): RelevantPnpmWorkspaceYaml | PacwichError => {
  let raw: unknown;
  try {
    raw = parseYaml(yamlString);
  } catch (error) {
    return new PNPM_ERRORS.MalformedPnpmWorkspaceYaml(
      `Failed to parse pnpm-workspace.yaml${yamlPath ? ` at "${yamlPath}"` : ""}: ${
        (error as Error).message
      }`,
    );
  }

  // An empty yaml file parses to null. Treat that as an empty workspace config.
  if (raw === null || raw === undefined) {
    return {
      packages: [],
      catalogs: { defaultCatalog: {}, namedCatalogs: {} },
    };
  }

  if (!isJSONObject(raw)) {
    return new PNPM_ERRORS.MalformedPnpmWorkspaceYaml(
      `pnpm-workspace.yaml${yamlPath ? ` at "${yamlPath}"` : ""} must be a YAML mapping at the top level (got ${typeof raw})`,
    );
  }

  const packages: string[] = [];
  const packagesField = raw.packages;
  if (packagesField !== undefined && packagesField !== null) {
    if (!Array.isArray(packagesField)) {
      return new PNPM_ERRORS.MalformedPnpmWorkspaceYaml(
        `pnpm-workspace.yaml${yamlPath ? ` at "${yamlPath}"` : ""} "packages" field must be an array of strings`,
      );
    }
    for (const entry of packagesField) {
      if (typeof entry !== "string") {
        return new PNPM_ERRORS.MalformedPnpmWorkspaceYaml(
          `pnpm-workspace.yaml${yamlPath ? ` at "${yamlPath}"` : ""} "packages" entries must be strings (got ${typeof entry})`,
        );
      }
      if (entry.trim()) packages.push(entry);
    }
  }

  const defaultCatalog: Record<string, string> = {};
  if (raw.catalog !== undefined && raw.catalog !== null) {
    if (!isStringRecord(raw.catalog)) {
      return new PNPM_ERRORS.MalformedPnpmWorkspaceYaml(
        `pnpm-workspace.yaml${yamlPath ? ` at "${yamlPath}"` : ""} "catalog" must be a map of package name to version string`,
      );
    }
    Object.assign(defaultCatalog, raw.catalog);
  }

  const namedCatalogs: Record<string, Record<string, string>> = {};
  if (raw.catalogs !== undefined && raw.catalogs !== null) {
    if (!isJSONObject(raw.catalogs)) {
      return new PNPM_ERRORS.MalformedPnpmWorkspaceYaml(
        `pnpm-workspace.yaml${yamlPath ? ` at "${yamlPath}"` : ""} "catalogs" must be a map of catalog name to package-version map`,
      );
    }
    for (const [catalogName, catalog] of Object.entries(raw.catalogs)) {
      if (!isStringRecord(catalog)) {
        return new PNPM_ERRORS.MalformedPnpmWorkspaceYaml(
          `pnpm-workspace.yaml${yamlPath ? ` at "${yamlPath}"` : ""} "catalogs.${catalogName}" must be a map of package name to version string`,
        );
      }
      namedCatalogs[catalogName] = { ...catalog };
    }
  }

  return {
    packages,
    catalogs: { defaultCatalog, namedCatalogs },
  };
};

/**
 * Read and parse `pnpm-workspace.yaml` from a project root.
 * Returns the empty-config result when the file is missing.
 * pnpm itself treats a project without `pnpm-workspace.yaml`
 * as a single-package (root-only) project, no error.
 */
export const readPnpmWorkspaceYaml = (
  rootDirectory: string,
): RelevantPnpmWorkspaceYaml | PacwichError => {
  const yamlPath = path.join(
    rootDirectory,
    PNPM_WORKSPACE_YAML_PROJECT_RELATIVE_PATH,
  );
  if (!fs.existsSync(yamlPath)) {
    return {
      packages: [],
      catalogs: { defaultCatalog: {}, namedCatalogs: {} },
    };
  }
  const contents = fs.readFileSync(yamlPath, "utf8");
  return parsePnpmWorkspaceYaml(contents, yamlPath);
};
