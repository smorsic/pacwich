import path from "path";
import { isJSONObject } from "@pacwich/common/types";
import { WORKSPACE_ERRORS } from "../../../workspaces/errors";
import type {
  LoadRootMetadataOptions,
  LoadRootMetadataResult,
} from "../../adapter/adapterTypes";

type CatalogMap = Record<string, string>;

/**
 * A `package.json` `workspaces.catalog` or `workspaces.catalogs.<name>`
 * entry is a name→version map. Non-string values are dropped.
 */
const parseCatalogMap = (raw: unknown): CatalogMap => {
  if (!isJSONObject(raw)) return {};
  return Object.fromEntries(
    Object.entries(raw).filter(([, value]) => typeof value === "string"),
  ) as CatalogMap;
};

const validateWorkspacePattern = (
  workspacePattern: unknown,
  rootDirectory: string,
): workspacePattern is string => {
  if (typeof workspacePattern !== "string") {
    throw new WORKSPACE_ERRORS.InvalidWorkspacePattern(
      `Expected workspace pattern to be a string, got ${typeof workspacePattern}`,
    );
  }

  if (!workspacePattern.trim()) return false;

  const absolutePattern = path.resolve(rootDirectory, workspacePattern);
  if (!absolutePattern.startsWith(rootDirectory)) {
    throw new WORKSPACE_ERRORS.InvalidWorkspacePattern(
      `Cannot resolve workspace pattern outside of root directory ${rootDirectory}: ${absolutePattern}`,
    );
  }

  return true;
};

type BunWorkspacesParseResult = {
  workspaceGlobs: string[];
  defaultCatalog: CatalogMap;
  namedCatalogs: Record<string, CatalogMap>;
};

/**
 * Bun's `package.json` workspaces field supports two shapes:
 *   - flat array: `"workspaces": ["packages/*"]` (also used by npm/yarn)
 *   - catalog object: `"workspaces": { "packages": [...], "catalog": {...}, "catalogs": { name: {...} } }`
 *
 * Catalogs only appear in the catalog-object form. The flat-array form
 * yields empty catalogs.
 */
const parseBunWorkspaces = (
  rootPackageJson: Record<string, unknown>,
  rootDirectory: string,
): BunWorkspacesParseResult => {
  const result: BunWorkspacesParseResult = {
    workspaceGlobs: [],
    defaultCatalog: {},
    namedCatalogs: {},
  };

  const workspacesField = rootPackageJson.workspaces;
  if (!workspacesField) return result;

  let rawWorkspaces: unknown;
  let source: "array" | "catalogObject";

  if (isJSONObject(workspacesField)) {
    source = "catalogObject";
    rawWorkspaces = (workspacesField as Record<string, unknown>).packages;
    result.defaultCatalog = parseCatalogMap(
      (workspacesField as Record<string, unknown>).catalog,
    );
    const catalogsField = (workspacesField as Record<string, unknown>).catalogs;
    if (isJSONObject(catalogsField)) {
      for (const [name, value] of Object.entries(catalogsField)) {
        result.namedCatalogs[name] = parseCatalogMap(value);
      }
    }
  } else {
    source = "array";
    rawWorkspaces = workspacesField;
  }

  if (!Array.isArray(rawWorkspaces)) {
    throw new WORKSPACE_ERRORS.InvalidWorkspaces(
      `Expected package.json "workspaces${source === "catalogObject" ? ".packages" : ""}" to be an array`,
    );
  }

  for (const pattern of rawWorkspaces) {
    if (validateWorkspacePattern(pattern, rootDirectory)) {
      result.workspaceGlobs.push(pattern);
    }
  }

  return result;
};

/**
 * Read workspace globs + catalogs from the project's root `package.json`.
 * Both the flat-array and catalog-object workspaces forms are supported.
 * Pure function over the supplied `rootPackageJson`, no file I/O. The
 * caller is responsible for reading and basic-validating the root
 * package.json (typically via `readPackageJson`).
 */
export const loadRootMetadata = ({
  rootDirectory,
  rootPackageJson,
}: LoadRootMetadataOptions): LoadRootMetadataResult => {
  const { workspaceGlobs, defaultCatalog, namedCatalogs } = parseBunWorkspaces(
    rootPackageJson,
    rootDirectory,
  );
  return {
    workspaceGlobs,
    catalogs: { defaultCatalog, namedCatalogs },
  };
};
