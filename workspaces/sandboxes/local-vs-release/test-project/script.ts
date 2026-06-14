// Contents of my-script.ts (in project root)

// [
//   "my-workspace-name",
//   "/my/project/path/my-workspace"
// ]
console.log(process.argv.slice(2));

// All metadata is available as environment variables for use within a script
console.log(process.env.PACWICH_PROJECT_PATH);
console.log(process.env.PACWICH_PROJECT_NAME);
console.log(process.env.PACWICH_WORKSPACE_NAME);
console.log(process.env.PACWICH_WORKSPACE_PATH);
console.log(process.env.PACWICH_WORKSPACE_RELATIVE_PATH);
console.log(process.env.PACWICH_SCRIPT_NAME);
