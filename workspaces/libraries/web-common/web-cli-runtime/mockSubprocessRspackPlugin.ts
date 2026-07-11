import path from "path";

/**
 * Structural (not imported) type for rspack's `NormalModuleReplacementPlugin`
 * constructor, so this module doesn't need `@rsbuild/core` as a dependency —
 * each consumer passes in the `rspack` binding from its own bundler config.
 */
type RspackLike = {
  NormalModuleReplacementPlugin: new (
    resourceRegExp: RegExp,
    newResource: (resource: { request: string; context?: string }) => void,
  ) => unknown;
};

/**
 * pacwich funnels every spawn (scripts + git) through the single
 * `createSubprocess()` in `runScript/subprocesses.ts`. Swap that one module
 * for the browser mock. It's imported from a few dirs — `./subprocesses`
 * (from runScript/) and `../runScript/subprocesses` (from affected/,
 * inputs/) — so we resolve the request against its importer and match the
 * absolute target, catching every importer without rewriting any unrelated
 * file named `subprocesses`.
 */
export const createMockSubprocessRspackPlugin = (rspack: RspackLike) => {
  const mockSubprocess = path.resolve(__dirname, "./mockSubprocess.ts");
  return new rspack.NormalModuleReplacementPlugin(
    /(^|[\\/])subprocesses(\.ts)?$/,
    (resource: { request: string; context?: string }) => {
      const resolved = path.resolve(resource.context ?? "", resource.request);
      if (/[\\/]runScript[\\/]subprocesses(\.ts)?$/.test(resolved)) {
        resource.request = mockSubprocess;
      }
    },
  );
};
