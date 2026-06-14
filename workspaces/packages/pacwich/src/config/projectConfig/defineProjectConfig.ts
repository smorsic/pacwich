import {
  type ProjectConfig,
  type ResolvedProjectConfig,
} from "@pacwich/common/config";
import { resolveProjectConfig } from "./projectConfig";

/**
 * Identity-style helper for authoring a `pacwich.project.{ts,js}` file.
 * Accepts a {@link ProjectConfig} and returns it resolved, with all
 * defaults filled in.
 *
 * Same effect as exporting the raw object, but gives editors type
 * checking and autocomplete on the config shape without an explicit
 * type annotation.
 *
 * @example
 * // pacwich.project.ts
 * import { defineProjectConfig } from "pacwich/config";
 *
 * export default defineProjectConfig({
 *   defaults: { parallelMax: 4, shell: "system" },
 * });
 */
export const defineProjectConfig = (
  config: ProjectConfig,
): ResolvedProjectConfig => resolveProjectConfig(config);
