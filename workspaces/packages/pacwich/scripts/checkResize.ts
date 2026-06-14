#!/usr/bin/env bun
/* eslint-disable no-console */
/**
 * Standalone verification of the grouped renderer's LIVE terminal-size re-read
 * on `SIGWINCH` (the fix in `renderGroupedOutput.ts` that reads
 * `process.stdout.{columns,rows}` each frame instead of the size captured at
 * CLI startup).
 *
 * This lives outside the vitest suite on purpose: vitest's worker process model
 * does not propagate a PTY winsize change / `SIGWINCH` to a spawned child, so
 * the resize never reaches pacwich there. A plain `bun` process DOES deliver
 * it, so this script can exercise the path end-to-end. Run it manually:
 *
 *   bun run scripts/checkResize.ts   # from workspaces/packages/pacwich
 *   bun pw check-resize              # from the repo root
 *
 * What it does: starts `run test-script` for the `aaa-many-lines` fixture in an
 * 8-row PTY (where the 8-line output is previewed as its last 4 with a
 * "(N hidden)" notice), then grows the PTY to 20 rows + delivers `SIGWINCH`.
 * With the live re-read, the next frame shows all 8 lines and no notice; with a
 * stale height it would keep hiding 4. Exits non-zero (and prints the ending
 * frame) if the grown frame never appears.
 *
 * Requires Bun >= 1.3.x for `Bun.Terminal` (PTY + `resize()`).
 */
import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { Terminal } from "@xterm/headless";
import { createAsyncIterableQueue } from "../src/internal/core";

const PKG_ROOT = path.resolve(import.meta.dir, "..");
const BIN = path.join(PKG_ROOT, "bin/cliDev.js");
const FIXTURE = path.join(
  PKG_ROOT,
  "tests/fixtures/testProjects/forRunScript/forGroupedOutput",
);

const COLS = 100;
const START_ROWS = 8;
const GROWN_ROWS = 20;

// The 8-row preview (last 4 lines + hidden-lines notice) we wait for before
// resizing, and the 20-row frame (all 8 lines, no notice) that proves the
// renderer re-read the grown height.
const PRE_RESIZE = `┌ Workspace: aaa-many-lines ┐
└    Status: running        ┘
(4 lines hidden until exit. Use -o prefixed for all lines or set cliScriptOutputStyle in config)
aaa output line 5
aaa output line 6
aaa output line 7
aaa output line 8`;

const POST_RESIZE = `┌ Workspace: aaa-many-lines ┐
└    Status: running        ┘
aaa output line 1
aaa output line 2
aaa output line 3
aaa output line 4
aaa output line 5
aaa output line 6
aaa output line 7
aaa output line 8`;

const getContent = (terminal: Terminal): string => {
  const lines: string[] = [];
  for (let i = 0; i < terminal.rows; i++) {
    lines.push(
      terminal.buffer.active.getLine(i)?.translateToString(true) ?? "",
    );
  }
  return lines.join("\n").trim();
};

/** The bun backend discovers workspaces from bun.lock; make sure the fixture's
 * (gitignored) lockfile exists and lists `aaa-many-lines`. */
const ensureFixtureInstalled = (): void => {
  const lock = path.join(FIXTURE, "bun.lock");
  const installed =
    fs.existsSync(lock) &&
    fs.readFileSync(lock, "utf8").includes("aaa-many-lines");
  if (installed) return;
  console.log("Installing fixture workspaces (bun install)...");
  const result = spawnSync("bun", ["install"], {
    cwd: FIXTURE,
    stdio: "ignore",
  });
  if (result.status !== 0) {
    throw new Error(`bun install failed in ${FIXTURE}`);
  }
};

const main = async (): Promise<number> => {
  if (typeof Bun === "undefined" || typeof Bun.Terminal !== "function") {
    console.error("This check requires Bun >= 1.3.x (Bun.Terminal).");
    return 2;
  }
  ensureFixtureInstalled();

  const xTerm = new Terminal({
    allowProposedApi: true,
    cols: COLS,
    rows: START_ROWS,
  });
  const dataQueue = createAsyncIterableQueue<Uint8Array<ArrayBufferLike>>();

  const term = new Bun.Terminal({
    cols: COLS,
    rows: START_ROWS,
    data: (_t, data) => dataQueue.push(data),
    exit: () => dataQueue.close(),
  });

  const proc = Bun.spawn(
    ["bun", BIN, "run", "test-script", "aaa-many-lines", "--parallel=false"],
    {
      cwd: FIXTURE,
      env: { ...process.env, FORCE_COLOR: "1" },
      stdout: "pipe",
      stderr: "pipe",
      terminal: term,
    },
  );
  // The terminal `exit` callback can be missed; closing on process exit too
  // guarantees the loop below terminates.
  void proc.exited.then(() => dataQueue.close());

  let resized = false;
  let grewPreview = false;
  for await (const chunk of dataQueue) {
    await new Promise((resolve) => xTerm.write(chunk, () => resolve(true)));
    const content = getContent(xTerm);

    if (!resized) {
      if (content === PRE_RESIZE) {
        resized = true;
        term.resize(COLS, GROWN_ROWS);
        proc.kill("SIGWINCH");
        xTerm.resize(COLS, GROWN_ROWS);
      }
      continue;
    }

    if (content === POST_RESIZE) {
      grewPreview = true;
      break;
    }
  }

  proc.kill();

  if (!resized) {
    console.error("✗ FAIL: the pre-resize (8-row) frame never appeared.");
    console.error("Ending frame:\n" + getContent(xTerm));
    return 1;
  }
  if (!grewPreview) {
    console.error(
      "✗ FAIL: after growing the terminal the preview did not re-fit — the " +
        "renderer kept the stale height (4 lines hidden) instead of showing all 8.",
    );
    console.error("Ending frame:\n" + getContent(xTerm));
    return 1;
  }

  console.log(
    "✓ PASS: on SIGWINCH the grouped renderer re-read the grown height and " +
      "expanded the preview from 4 to all 8 lines.",
  );
  return 0;
};

process.exit(await main());
