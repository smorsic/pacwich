export default {
  workspacePatternConfigs: [
    {
      patterns: ["workspace-a"],
      config: { alias: "ws-a", tags: ["type-a"] },
    },
    {
      patterns: ["workspace-b"],
      config: { alias: "ws-b", tags: ["type-b"] },
    },
    {
      // accumulated: "type-a" tag was added by entry 1 — only workspace-a should match
      patterns: ["tag:type-a"],
      config: { tags: ["accumulated-match"] },
    },
  ],
};
