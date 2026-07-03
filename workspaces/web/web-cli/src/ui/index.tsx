/**
 * The shared Web CLI UI. Consumers render `<WebCli />` (it pulls in its own
 * styles); the theme variables it reads come from the host — import
 * `@pacwich/web-common/theme.css` for the shared tokens plus, standalone, a
 * small `--rp-*` fallback block (see this package's preview).
 */
export { WebCli } from "./WebCli";
