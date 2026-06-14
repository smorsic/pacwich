import { createFileSystemProject } from "pacwich_local";

const project = createFileSystemProject();

project.runScriptAcrossWorkspaces({
  script: "my-script",
  dependencyOrder: true,
  ignoreDependencyFailure: true,
});
