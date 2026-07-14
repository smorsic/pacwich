export default {
  workspacePatternConfigs: [
    {
      patterns: ["workspace-a"],
      // Intentionally invalid: the factory result fails workspace
      // config validation during workspace assembly
      config: () => ({ alias: 42 }),
    },
  ],
};
