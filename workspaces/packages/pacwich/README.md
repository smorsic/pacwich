# Workspace: pacwich

This is the main workspace for the pacwich package.

This README is not what is published with the package, but instead the root README.md file.

The library is built via rslib, using the script at `scripts/build.ts`.

It bundles its dependencies into the build without bundling the entire source code to retain
the overall shape.

Libraries from the repo's workspaces/libraries are also bundled into the build.
