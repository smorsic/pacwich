#!/usr/bin/env bash
# sandbox.sh — isolated global-install sandbox for pacwich installation verification.
# Usage:
#   sandbox.sh setup [npm|bun|pnpm] [npm|local|<other>]  # build sandbox + global install
#   sandbox.sh run  <cmd...>                          # run any command inside it
#   sandbox.sh install [project-dir]                  # local-install pacwich for the API
#   sandbox.sh tsdoc [project-dir]                    # dump installed pacwich TSDoc
#   sandbox.sh env                                    # print sandbox paths
#   sandbox.sh teardown                               # remove it
#
# Install source (2nd setup arg, default "local"):
#   npm    -> the published "pacwich" package
#   local  -> the local build at workspaces/packages/pacwich/dist ('bun pw build')
#   <other> -> any other value used verbatim (a path, tarball, or pkg@version)
set -euo pipefail

# Fixed state location so every separate invocation finds the same sandbox.
STATE="${SANDBOX_STATE:-${TMPDIR:-/tmp}/pacwich-sandbox}"
ENVFILE="$STATE/env.sh"

cmd="${1:-}"; shift || true

case "$cmd" in
  setup)
    PM="${1:-npm}"; SOURCE="${2:-local}"
    rm -rf "$STATE"; mkdir -p "$STATE"
    ROOT="$STATE/root"; HOMEDIR="$ROOT/home"; WORK="$ROOT/work"
    mkdir -p "$HOMEDIR" "$WORK"

    # Resolve the install source once so the global install and any later
    # `install` (local) use the same artifact.
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    REPO_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
    DIST="$REPO_ROOT/workspaces/packages/pacwich/dist"
    case "$SOURCE" in
      npm)   INSTALLATION="pacwich" ;;
      local)
        [ -d "$DIST" ] \
          || { echo "no local build at $DIST — run 'bun pw build' first" >&2; exit 1; }
        # Pack dist into a tarball. Installing a bare dir symlinks
        # node_modules/pacwich back into the source tree (breaks isolation);
        # a tarball installs a real copy everywhere, like a published package.
        TARBALL="$(cd "$DIST" && npm pack --pack-destination "$STATE" 2>/dev/null | tail -1)"
        INSTALLATION="$STATE/$TARBALL" ;;
      *)     INSTALLATION="$SOURCE" ;;
    esac

    case "$PM" in
      npm)  PREFIX_EXPORT="npm_config_prefix=$ROOT/npm"; BIN="$ROOT/npm/bin" ;;
      bun)  PREFIX_EXPORT="BUN_INSTALL=$ROOT/bun";       BIN="$ROOT/bun/bin" ;;
      pnpm) PREFIX_EXPORT="PNPM_HOME=$ROOT/pnpm";        BIN="$ROOT/pnpm" ;;
      *) echo "unknown pm: $PM" >&2; exit 1 ;;
    esac

    # Persist the sandbox env for future `run`/`install` calls.
    {
      echo "export HOME='$HOMEDIR'"
      echo "export $PREFIX_EXPORT"
      echo "export PATH='$BIN:$PATH'"
      echo "export SANDBOX_WORK='$WORK'"
      echo "export SANDBOX_BIN='$BIN'"
      echo "export SANDBOX_PM='$PM'"
      echo "export SANDBOX_INSTALLATION='$INSTALLATION'"
    } > "$ENVFILE"

    # shellcheck disable=SC1090
    source "$ENVFILE"
    case "$PM" in
      npm)  npm install -g "$INSTALLATION" ;;
      bun)  bun add -g "$INSTALLATION" ;;
      pnpm) pnpm add -g "$INSTALLATION" ;;
    esac

    # Fail loudly if we didn't resolve the isolated binary.
    [ "$(command -v pacwich)" = "$BIN/pacwich" ] \
      || { echo "sandbox resolved wrong pacwich: $(command -v pacwich)" >&2; exit 1; }
    echo "sandbox ready ($PM, source: $SOURCE). work dir: $WORK"
    ;;

  run)
    [ -f "$ENVFILE" ] || { echo "no sandbox; run 'sandbox.sh setup' first" >&2; exit 1; }
    # shellcheck disable=SC1090
    source "$ENVFILE"
    cd "$SANDBOX_WORK"
    exec "$@"
    ;;

  install)
    # Local-install pacwich (the same source chosen at setup) into a project
    # dir, for API/TSDoc verification (defaults to the sandbox work dir).
    [ -f "$ENVFILE" ] || { echo "no sandbox; run 'sandbox.sh setup' first" >&2; exit 1; }
    # shellcheck disable=SC1090
    source "$ENVFILE"
    cd "${1:-$SANDBOX_WORK}"
    [ -f package.json ] \
      || printf '{ "name": "sandbox-project", "private": true }\n' > package.json
    case "$SANDBOX_PM" in
      npm)  npm install "$SANDBOX_INSTALLATION" ;;
      bun)  bun add "$SANDBOX_INSTALLATION" ;;
      pnpm) pnpm add "$SANDBOX_INSTALLATION" ;;
    esac
    ;;

  tsdoc)
    # Dump the installed pacwich's TSDoc, resolving from a project dir where
    # pacwich is locally installed (defaults to the sandbox work dir).
    [ -f "$ENVFILE" ] || { echo "no sandbox; run 'sandbox.sh setup' first" >&2; exit 1; }
    # shellcheck disable=SC1090
    source "$ENVFILE"
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    cd "${1:-$SANDBOX_WORK}"
    exec bun "$SCRIPT_DIR/tsdoc.ts"
    ;;

  env)
    [ -f "$ENVFILE" ] && cat "$ENVFILE" || { echo "no sandbox" >&2; exit 1; }
    ;;

  teardown)
    rm -rf "$STATE"; echo "sandbox removed"
    ;;

  *) echo "usage: sandbox.sh {setup|run|install|tsdoc|env|teardown}" >&2; exit 1 ;;
esac