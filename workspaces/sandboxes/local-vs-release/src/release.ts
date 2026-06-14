import { createFileSystemProject } from "pacwich_release";

const project = createFileSystemProject({
  rootDirectory: "test-project",
});

const { output } = project.runScriptAcrossWorkspaces({
  workspacePatterns: ["p*"],
  script: "echo <workspaceName>: <scriptName> && set -o pipefail",
  parallel: { max: "100%" },
  inline: { scriptName: "test", shell: "system" },
});

for await (const { outputChunk } of output) {
  console.log(outputChunk.decode({ stripAnsi: false }).trim());
}
