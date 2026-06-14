
if [[ "$CI" == "true" ]]; then
  echo "CI=true, skipping mise install"
  exit 0
fi

if command -v mise >/dev/null; then
  mise install
else
  echo -e "\n\u001b[0;93mInstall mise (https://mise.jdx.dev/getting-started.html#activate-mise) and run \u001b[1;93mmise install\u001b[0;93m to sync dev tool versions (bun, node, etc.).\u001b[0m"
  echo -e "\n\u001b[0;93mThe activate step (https://mise.jdx.dev/getting-started.html#activate-mise) ensures your shell uses the project's tool versions whenever you are working in this directory.\u001b[0m"
fi
