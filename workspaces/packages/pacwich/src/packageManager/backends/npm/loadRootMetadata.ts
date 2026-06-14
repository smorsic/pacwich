import path from "path";
import { isJSONObject } from "@pacwich/common/types";
import { WORKSPACE_ERRORS } from "../../../workspaces/errors";
import type {
  LoadRootMetadataOptions,
  LoadRootMetadataResult,
} from "../../adapter/adapterTypes";

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

/**
 * Read workspace globs from the project's root `package.json`.
 *
 * npm officially documents only the flat-array form
 * (`"workspaces": ["packages/*"]`), but it also picks up the `packages`
 * globs out of bun's catalog-object form
 * (`{ packages: [...], catalog: {...} }`) at install time. pacwich
 * follows suit and reads `workspaces.packages`, so a bun-shaped repo run
 * under `--pm npm` still discovers its workspaces rather than getting a
 * spurious pacwich-side rejection.
 *
 * npm has no catalog support, so any `catalog`/`catalogs` entries are
 * ignored (never resolved) and the returned `catalogs` is always empty.
 * References used in dependencies fail npm's install.
 */
export const loadRootMetadata = ({
  rootDirectory,
  rootPackageJson,
}: LoadRootMetadataOptions): LoadRootMetadataResult => {
  const emptyCatalogs = { defaultCatalog: {}, namedCatalogs: {} };
  const workspacesField = rootPackageJson.workspaces;

  const rawWorkspaces = isJSONObject(workspacesField)
    ? workspacesField.packages
    : workspacesField;

  if (!Array.isArray(rawWorkspaces)) {
    return { workspaceGlobs: [], catalogs: emptyCatalogs };
  }

  const workspaceGlobs: string[] = [];
  for (const pattern of rawWorkspaces) {
    if (validateWorkspacePattern(pattern, rootDirectory)) {
      workspaceGlobs.push(pattern);
    }
  }

  return { workspaceGlobs, catalogs: emptyCatalogs };
};
