import fs from "fs";
import path from "path";
import { logger } from "../../../internal/logger";
import { WORKSPACE_ERRORS } from "../../../workspaces/errors";
import type {
  LoadRootMetadataOptions,
  LoadRootMetadataResult,
} from "../../adapter/adapterTypes";
import {
  PNPM_WORKSPACE_YAML_PROJECT_RELATIVE_PATH,
  readPnpmWorkspaceYaml,
} from "./pnpmWorkspaceYaml";

const validateWorkspacePattern = (
  workspacePattern: string,
  rootDirectory: string,
): boolean => {
  if (!workspacePattern.trim()) return false;
  const absolutePattern = path.resolve(rootDirectory, workspacePattern);
  // Allow leading `!` for negation patterns, check the body.
  const body = workspacePattern.startsWith("!")
    ? workspacePattern.slice(1)
    : workspacePattern;
  const absoluteBody = path.resolve(rootDirectory, body);
  if (!absoluteBody.startsWith(rootDirectory)) {
    throw new WORKSPACE_ERRORS.InvalidWorkspacePattern(
      `Cannot resolve workspace pattern outside of root directory ${rootDirectory}: ${absolutePattern}`,
    );
  }
  return true;
};

/**
 * Read workspace globs and catalog data from `pnpm-workspace.yaml`.
 *
 * Unlike bun and npm, pnpm reads workspaces from a YAML file at the
 * project root, NOT from `package.json.workspaces`. If a user has set
 * `workspaces` in `package.json` AND has no `pnpm-workspace.yaml`,
 * the field looks like an honest mistake and we surface a warning
 * (mirroring pnpm's own message). When `pnpm-workspace.yaml` is
 * present the warning would be noise: dual-pm projects deliberately
 * declare workspaces in both formats so they can run under multiple
 * backends, and pacwich is reading the right one already.
 *
 * pnpm's catalog model matches bun's: a default `catalog:` and named
 * `catalogs:`. Both are surfaced as a `CatalogSet`.
 */
export const loadRootMetadata = ({
  rootDirectory,
  rootPackageJson,
}: LoadRootMetadataOptions): LoadRootMetadataResult => {
  const pnpmWorkspaceYamlPath = path.join(
    rootDirectory,
    PNPM_WORKSPACE_YAML_PROJECT_RELATIVE_PATH,
  );
  if (
    rootPackageJson.workspaces !== undefined &&
    !fs.existsSync(pnpmWorkspaceYamlPath)
  ) {
    logger.warn(
      `The "workspaces" field in package.json is not used by pnpm. Define workspace packages in "pnpm-workspace.yaml" instead.`,
    );
  }

  const config = readPnpmWorkspaceYaml(rootDirectory);
  if (config instanceof Error) throw config;

  const workspaceGlobs: string[] = [];
  for (const pattern of config.packages) {
    if (validateWorkspacePattern(pattern, rootDirectory)) {
      workspaceGlobs.push(pattern);
    }
  }

  return { workspaceGlobs, catalogs: config.catalogs };
};
