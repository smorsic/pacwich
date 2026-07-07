import type { DependencySource } from "@pacwich/common/config";

/** Catalog reference info attached to an `ExternalDependency` that uses a `catalog:` ref */
export type ExternalDependencyCatalog = {
  /** Catalog name from the `catalog:<name>` ref. Empty string for the default catalog (`catalog:`). */
  name: string;
};

/** The four `package.json` dependency maps a dep can be declared in */
export const EXTERNAL_DEPENDENCY_SOURCES = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
] as const satisfies readonly DependencySource[];

// Aliased to the canonical config-layer union so the field-name set has a
// single source of truth (the runtime array above is checked against it).
export type ExternalDependencySource = DependencySource;

/** A non-workspace package the workspace declares (resolved via package.json + catalogs) */
export type ExternalDependency = {
  /** The package name as it appears in `node_modules` */
  name: string;
  /**
   * Version specifier from `package.json`, with `catalog:`/`catalog:<name>` references
   * resolved to the catalog's value. If the catalog reference cannot be resolved, the
   * literal `catalog:` / `catalog:<name>` string is preserved.
   */
  version: string;
  /**
   * Which `package.json` dependency map this dep was declared in. When a dep
   * appears in multiple maps, `dependencies` wins over the others, and any
   * non-`devDependencies` source wins over `devDependencies`. One entry per
   * unique name.
   */
  source: ExternalDependencySource;
  /** Present when the dep was declared via a `catalog:` reference in `package.json` */
  catalog?: ExternalDependencyCatalog;
};

/** Metadata about a nested package within the monorepo */
export type Workspace = {
  /** The name of the workspace from its `package.json` */
  name: string;
  /** Whether the workspace is the root workspace */
  isRoot: boolean;
  /** The relative path to the workspace from the root `package.json` */
  path: string;
  /** The workspace-declaration glob this workspace was matched from (the root `package.json` `"workspaces"` field, or `pnpm-workspace.yaml` under pnpm) */
  matchPattern: string;
  /** The scripts available in package.json */
  scripts: string[];
  /** Aliases assigned via the `"alias"` field in the workspace's config */
  aliases: string[];
  /** Tags assigned via the `"tags"` field in the workspace's config */
  tags: string[];
  /** Names of workspaces that this workspace depends on */
  dependencies: string[];
  /** Names of workspaces that depend on this workspace */
  dependents: string[];
  /** Non-workspace package dependencies declared by this workspace */
  externalDependencies: ExternalDependency[];
};
