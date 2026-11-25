function tagFactory() {
  return { tags: ["from-factory"] };
}

export default {
  workspacePatternConfigs: [
    {
      patterns: ["workspace-a"],
      config: tagFactory,
    },
  ],
};
