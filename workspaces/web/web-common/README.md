# @pacwich/web-common

Shared assets for pacwich's web workspaces. Today that's just the common web
theme:

- **`src/theme.css`** — the CSS custom properties the Web CLI experience reads
  (xterm ANSI palette, syntax-highlighting colors, terminal sizing/fonts), with
  light values on `:root` and dark values on `.dark`.

Consumers import it directly:

```ts
import "@pacwich/web-common/theme.css";
```

The documentation website imports it globally (so it's the single source of
those tokens instead of re-declaring them in `global.css`), and the
`@pacwich/web-cli` preview imports it plus a small `--rp-*` fallback block so it
renders standalone.
