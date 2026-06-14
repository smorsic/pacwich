console.log("workspace-a script");
console.log("argv: ", process.argv.join(" "));
console.log("PACWICH_PROJECT_PATH:", process.env.PACWICH_PROJECT_PATH);
console.log("PACWICH_WORKSPACE_NAME:", process.env.PACWICH_WORKSPACE_NAME);
console.log("PACWICH_WORKSPACE_PATH:", process.env.PACWICH_WORKSPACE_PATH);
console.log(
  "PACWICH_WORKSPACE_RELATIVE_PATH:",
  process.env.PACWICH_WORKSPACE_RELATIVE_PATH,
);
console.log("PACWICH_SCRIPT_NAME:", process.env.PACWICH_SCRIPT_NAME);

await Bun.sleep(1000);
