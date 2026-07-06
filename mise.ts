if (process.env.CI === "true") {
  console.log("CI=true, skipping mise step");
  process.exit(0);
}

if (Bun.which("mise")) {
  console.log("Run mise install to sync dev tool versions (bun, node, etc.)");
} else {
  console.log(
    "\n\x1b[0;93mInstall mise (https://mise.jdx.dev/getting-started.html#activate-mise) and run \x1b[1;93mmise install\x1b[0;93m to sync dev tool versions (bun, node, etc.).\x1b[0m",
  );
  console.log(
    "\n\x1b[0;93mThe activate step (https://mise.jdx.dev/getting-started.html#activate-mise) ensures your shell uses the project's tool versions whenever you are working in this directory.\x1b[0m",
  );
}
