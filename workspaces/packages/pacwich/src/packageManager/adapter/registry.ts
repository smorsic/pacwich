import { createBunAdapter } from "../backends/bun";
import { createNpmAdapter } from "../backends/npm";
import { createPnpmAdapter } from "../backends/pnpm";
import type { PackageManagerAdapter, PackageManagerName } from "./adapterTypes";

const ADAPTER_FACTORIES: Record<
  PackageManagerName,
  () => PackageManagerAdapter
> = {
  bun: createBunAdapter,
  pnpm: createPnpmAdapter,
  npm: createNpmAdapter,
};

/**
 * Produce an adapter for the given package manager. Each call returns
 * a fresh adapter. Adapters carry no shared mutable state, so this is
 * safe and lets backends accept future per-call configuration without
 * rewiring the registry.
 *
 * `name` is required: pacwich has no concept of a default package
 * manager. Callers that want auto-detection should go through
 * {@link resolvePackageManagerValue} first.
 */
export const resolvePackageManagerAdapter = (
  name: PackageManagerName,
): PackageManagerAdapter => ADAPTER_FACTORIES[name]();
