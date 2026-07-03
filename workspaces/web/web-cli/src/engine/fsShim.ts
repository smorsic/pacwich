/**
 * Browser stand-in for Node's `fs`, aliased in `rsbuild.config.ts` so that
 * `import fs from "fs"` (and `node:fs`) inside the bundled pacwich CLI hits
 * memfs instead of a real filesystem.
 *
 * memfs's exported `fs`/`vol` are a single shared in-memory volume, so the
 * seeding code (`memoryProject.ts`, which writes via `vol`) and the CLI
 * (which reads via this shim's `fs`) operate on the same files.
 *
 * We re-export both a default (`import fs from "fs"`) and the named members
 * the bundle might pull in (`import { existsSync } from "fs"`).
 */
import { fs } from "memfs";

export default fs;

export const {
  existsSync,
  statSync,
  lstatSync,
  readFileSync,
  readdirSync,
  realpathSync,
  writeFileSync,
  mkdirSync,
  rmSync,
  readlinkSync,
  constants,
  promises,
} = fs;
