/** Hidden text for markdown generation (llms.txt etc.) pointing agents to the published TS declarations */
export const ApiTypesAlt = () => {
  return (
    <div className="hidden-llms-text">
      <div>
        Note for AI agents: For complete TypeScript types of the public API,
        read the installed package's declaration files. The main entry is{" "}
        <code>node_modules/pacwich/src/index.d.ts</code> (the <code>types</code>{" "}
        field of pacwich's package.json), and each subpath export (e.g.{" "}
        <code>pacwich/config</code>, <code>pacwich/script</code>) has its own{" "}
        <code>.d.ts</code> listed under <code>exports</code> in the same
        package.json.
      </div>
    </div>
  );
};
