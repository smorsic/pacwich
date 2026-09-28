# Local Cache for Workspace Script Results — Plan + State Handoff

This is a handoff doc for continuing work in a new chat. **Human-coder mode:** the assistant plans, reviews, and answers design questions; Scott implements. The assistant writes code only when explicitly asked. Re-read files often, since edits happen between prompts.

## Current state (branch `script-cache`, this worktree)

Working tree is clean. Commits on `main..script-cache`:

- `0593f6fe` Add env vars to inputs config
- `e34e35a1` Add custom inputs to config
- `1b56d9fd` Add argument to CustomInputFunction
- `9f7dfd2f` Add TSDoc for CustomInputContext
- `b9007672` Add new input props to JSON schema
- `d9ee28e0` Add tests for workspace config updates
- `6b374217` Basic hashing utils for data/files

File state:

- `workspaces/packages/pacwich/src/cache/hash.ts`: DONE. `hashData(string | Uint8Array)` (sync, hex sha256) and `hashFile(path)` (async, streamed via for-await over `createReadStream`, `update`/`digest`).
- `workspaces/packages/pacwich/tests/features/cache/hash.test.ts`: DONE, 10 passing tests (FIPS vectors, bytes/string agreement, file-vs-data agreement for text/binary/4MB/empty, missing-file rejection).
- `workspaces/packages/pacwich/src/cache/store.ts`: STUB ONLY (`class _CacheStore {}` + `createCacheStore()` factory). This is the next work item; full design in "Stage 1 zoom" below.
- Stage 2 config-surface work (types/schema/tests for `environmentVariables`/`customInputs`) landed in the commits above; its REMAINING items are in the Stage 2 entry below.
- Generated AJV validators under `src/internal/generated/ajv/` are gitignored (regenerate with `bun pw ajv`), so schema commits carry no generated output.

## Context

pacwich runs package.json (and inline) scripts across workspaces but always re-executes them, even when nothing a script depends on has changed. This change adds an opt-in local result cache: a successful run's captured stdout/stderr bytes and exit result are stored keyed by a hash of the workspace's inputs, and an identical later run skips the spawn and replays the cached output through the normal rendering pipeline. Foundation for a later artifact capture/restore stage (out of scope here, but it shapes the store format).

Stages are independently committable. Names are suggestions unless already implemented; snippets are illustrative.

## Decisions (settled)

- **Artifacts staged for later.** Result caching only; store format leaves room (version field, self-contained entries).
- **Failures never cached.** Only exitCode 0, no signal, not skipped.
- **Replay on by default**, suppressible via config/flag. Cache hits are visually marked.
- **Limit:** effective = min(configured-or-default ceiling, 10% of total disk via `fs.statfs`, ceiling-only fallback if statfs throws). Default ceiling **2 GiB**. Config accepts bytes, size strings, or "unbounded". Unit strings are binary (1024-based) with flexible spellings: `G`/`GB`/`GiB` all mean GiB.
- **Store scope:** per-repo `node_modules/.cache/pacwich`, per-repo limit (Nx/Turbo convention). Global store/machine-wide limit is a flagged future extension; entries stay self-contained to allow it without migration.
- **Config shape (implemented naming):** `environmentVariables` and `customInputs` join the existing `WorkspaceInputsConfig` (used by `inputs`/`defaultInputs`), with TSDoc noting affected resolution ignores them. `customInputs` is a map (`Record<string, CustomInput>`). Script opt-in is plain `scripts[name].cache: boolean` (widenable to `boolean | object` later).
- **Custom input values are strings only** (static entries and function returns alike). Functions receive a `CustomInputContext` object (`{ workspace: RawWorkspace }`, extensible later) and are TS/JS-config-only; static strings work in any config format (main use: manual cache-busting salt).
- **Hit duration stays entry-internal** (`entry.json`), surfaced later via `cache info`. `durationMs` on a hit is real replay time.
- **Events:** do NOT widen `ScriptEventName`. A hit emits `"exit"` with `exitResult.cached === true` and no `"start"` (mirrors skip emitting no start).

## Design

### Cache key

SHA-256 (node:crypto, hex) over a deterministic key document. A `CACHE_KEY_VERSION` constant (bumped when key semantics change), not the pacwich version. **No absolute paths in the hash.** Materials:

- key version, `project.packageManager`, `process.platform`, `process.arch`, resolved shell. Shell is hashed unconditionally: named scripts always pin `"system"` (`fileSystemProject.ts` ~670), so it's an inert constant for them, while inline runs correctly get distinct keys for system vs bun
- workspace name + project-relative path
- script identity: for named scripts, the raw `scripts[name]` text from package.json (catches body edits even when inputs exclude package.json); for inline, the command text + `resolveInputsLookupScriptName` result (`fileSystemProject.ts` ~line 266)
- raw pre-interpolation args
- input files: `buildWorkspaceInputs` precedence (lift/export from `affectedWorkspaces.ts` ~line 192) + `matchWorkspaceInputFiles` over `listProjectTrackableFiles`, producing sorted `[projectRelativePath, contentSha256]` pairs
- external dep resolved versions: `adapter.lockfile.loadCurrentVersions` + `resolveWorkspaceDepVersion` crossed with `workspace.externalDependencies`, honoring the `externalDependencies` allowlist. New small map helper (the existing `computeExternalDependencyChanges` emits deltas, not maps)
- env inputs: configured `environmentVariables` names + parent `process.env` values (not child env, which contains absolute paths), sorted, with a distinct missing-vs-empty sentinel
- custom inputs: entries sorted by key name; static strings as-is, functions awaited with `CustomInputContext`, non-string result is an error
- workspace dep composition: for each direct workspace dep and each `workspacePatterns` input match, fold in that workspace's **state hash** (recursive: its input files + external dep versions + its deps' state hashes, resolved for the same lookup script name with `defaultInputs` fallback). Deliberately not the dep's script cache key, so it works when deps aren't in the run, aren't cacheable, or the run isn't `--dep-order`. Cycle-safe via visited set.

All user-supplied key materials are strings, so no canonical-JSON utility is needed: the key document has known shapes, deterministic serialization by construction.

**Memoization:** a per-run context object created once per run-method call, holding one `listProjectTrackableFiles` result, one `loadCurrentVersions` result, per-file content-hash memo, per-workspace state-hash memo. No Project-lifetime memoization. Keys computed up-front before `runScripts` starts (safe because inputs are git-trackable only and dep build outputs are typically gitignored; document that assumption).

### Store layout

```
node_modules/.cache/pacwich/results/v1/<keyHash>/
  output.bin    # chunks concatenated in as-captured arrival order
  entry.json    # written LAST; acts as the commit marker
```

`entry.json` (illustrative): `{ version, key, createdISO, exit: { exitCode, signal, durationMs }, chunks: [{ stream, offset, length }...], totalBytes, pacwichVersion, script: { workspaceName, scriptName } }`. Future artifacts extend this.

- Dirs created 0o700 (per `DEFAULT_TEMP_DIR` precedent). No location config in v1.
- **Atomic commit:** build entry in `results/v1/.tmp-<random>/`, then `fs.rename` into place. Rename collision means a concurrent identical run won: delete temp, done. Entry dirs lacking `entry.json` are garbage, swept during eviction. No lock files.
- **LRU:** `utimes` bump on `entry.json` at hit time; eviction sorts by mtime.
- **Eviction:** post-run sweep only when the run saved at least one entry: evict oldest-first until under the effective limit, ENOENT-tolerant, warnings never fail the run. Same code powers `cache prune`.
- Interleave note: the pump loop is the only place raw chunks with `streamName` appear in arrival order; the single-log design records that order faithfully.

### Config surface

Project level, new top-level `cache` section (like `verify`, not under `defaults`):

```ts
// ProjectConfig
cache?: {
  enabled?: boolean;              // default true (master switch; scripts still opt in)
  sizeLimit?: number | string;    // bytes | "2GB" | "unbounded"; default "2GB"
  replayOutput?: boolean;         // default true
};
```

Env vars in `USER_ENV_VARS`: `PACWICH_CACHE_ENABLED_DEFAULT`, `PACWICH_CACHE_SIZE_LIMIT_DEFAULT`, `PACWICH_CACHE_REPLAY_OUTPUT_DEFAULT`.

Workspace/script level (implemented shape):

```ts
// ScriptConfig
cache?: boolean;   // opt-in; default false (not yet implemented)

// WorkspaceInputsConfig (implemented)
environmentVariables?: string[];
customInputs?: CustomInputConfig;  // Record<string, CustomInput>
type CustomInput = string | CustomInputFunction;
type CustomInputFunction = (context: CustomInputContext) => string | Promise<string>;
type CustomInputContext = { workspace: RawWorkspace };
```

The `customInputs` schema slot is `type: "object"` with `additionalProperties: {}` (a string value schema would reject TS-config functions in AJV); resolution enforces string-or-function with a clear error naming the key. Functions won't appear in `config debug` JSON (same as pattern-config factories).

### API surface

- Run-level `cache?: boolean` on `runWorkspaceScript`, `runScriptAcrossWorkspaces`, `runAffectedWorkspaceScript` scriptOptions (false disables read AND write). `{ read?, write? }` object form is a flagged future extension.
- Factory option `cache?: boolean` on `createFileSystemProject`.
- `RunScriptExit` gains `cached?: true` (mirrors `skipped?`) and `cacheKey?: string` (present whenever caching participated). Propagate automatically to `summary.scriptResults`, `--json-outfile`, `ScriptEventMetadata.exitResult`.
- `Project.clearCache()`, `cacheStats()`, `pruneCache()` as plain functions in `src/cache` composed into the class. Export types via `src/index.ts`; new `defineErrors` sets go in `src/errorExports.ts`.

### CLI surface

- `--cache`/`--no-cache` and `--cache-replay`/`--no-cache-replay` on `runScript` and the shared `RUN_AFFECTED_OPTIONS` block (`commandsConfig.ts`; empty-param booleans auto-register negation). Explicit `--cache` re-enables past a config-off master switch; per-script opt-in still gates.
- New `pacwich cache` command group: `clear`, `info` (human + `--json --pretty`), `prune`.
- Grouped renderer: new `WorkspaceStatus` `"cached"` (`STATUS_COLORS` ~137 and `FINISHED_STATUSES` in `renderGroupedOutput.ts`; suggest cyan, header like `success (cached)`).
- `scriptRunFlow.ts`: cached log line beside the existing success/skip lines, detected via `exitResult.cached`. Suggest a lightning marker.
- web-cli: add `cache` commands to `webCliGuards.ts` block list with a friendly message. Release-blocking, since `bun docs build` compiles the web-cli module graph.

### Execution integration

- **Key computation** in the `fileSystemProject` layer: `#prepareWorkspaceScriptRun` (~601) and the inlined per-workspace block in `runScriptAcrossWorkspaces` (~932-1008). Recommended preliminary refactor: extract the shared per-workspace prep into a helper both paths use.
- **Descriptor:** extend `RunScriptsScript` with optional `cache?: { key, store, replayOutput }` where the store is a small `lookup`/writer interface, keeping `runScripts` workspace-agnostic and testable with an in-memory fake.
- **Hit path:** wrap the `runScript(...)` call site inside `scheduleReadyScripts` (`runScripts.ts` ~290): look up the key and either fabricate a `RunScriptResult` whose output iterates stored chunks in recorded order (empty when replay suppressed) and whose exit resolves `{ exitCode: 0, success: true, cached: true, cacheKey, ... }`, or fall through to a real spawn. Both shapes are `RunScriptResult`, so the pump loop, drain waits (~354-359), exit accounting, and dep scheduling work unchanged.
- **Save path:** tee inside the pump loop (~301-309), the only place raw `{chunk, streamName}` pairs exist. Save only after the pump fully drains AND exit resolves successfully. Never on non-zero exit.
- **Dep-order:** hits are successes, so dependents schedule normally.
- **Exclusions:** `runInteractive` and `ignoreOutput` runs don't participate at all (no exit-only entries in v1).

### Security

- Store dirs are internally derived hex hashes: no config strings in paths, no traversal surface. Validate hex format where a key crosses an API boundary.
- TOCTOU: temp-dir + rename commit, `entry.json` validity marker, ENOENT-tolerant sweeps.
- Replay sanitization: bytes stored raw as captured, `sanitizeChunk` applies at render time, so replayed output gets identical treatment to live output.
- Validate `entry.json` on read; corruption = cache miss.
- Custom input functions are gated by `disableExecutableConfigs`.
- Parse size-limit strings strictly.

### Edge cases for tests/docs

Inline scripts keyed by inline name + command text, opt-in via `scripts[inlineName].cache`; untracked non-ignored files ARE inputs; gitignored outputs never invalidate (document loudly); git-unavailable FS-walk fallback still yields deterministic keys; concurrent identical runs may double-spawn, first save wins; default `"."` inputs mean whole-dir hashing (docs suggest narrowing `inputs` for big workspaces); missing node_modules handled by recursive mkdir.

## Stage 1 zoom: cache engine primitives

Pure, unwired primitives in `src/cache/`. No imports from project/runScript layers. Grounding: `fs.statfs` works under Bun (verified) and exists in Node >= 22; the doc-site warnings page derives from `WARNING_IDS` automatically, so new warning ids have no doc-site coupling.

### Suggested module layout (hash.ts done; store.ts stub exists)

```
src/cache/
  index.ts                     # export * (public exports still explicit in src/index.ts, later stage)
  constants.ts                 # CACHE_KEY_VERSION = 1, CACHE_STORE_VERSION_DIR = "v1",
                               # DEFAULT_CACHE_SIZE_LIMIT_BYTES, CACHE_DISK_FRACTION = 0.1
  hash.ts                      # DONE: hashData, hashFile
  sizeLimit.ts                 # parseCacheSizeLimit, computeEffectiveCacheSizeLimit
  errors.ts                    # defineErrors set (InvalidCacheSizeLimit, InvalidCacheKeyFormat)
  store.ts (or store/)         # STUB: currently class _CacheStore + createCacheStore()
```

### Store factory and writer

- Store factory returns lookup/writer/list/stats/clear/evict functions. Its `lookup`/writer surface doubles as the store interface `RunScriptsScript.cache` consumes in Stage 4, so the in-memory test fake implements the same type.

```ts
type ScriptResultCacheStore = {
  lookup: (key: string) => Promise<CacheEntryHit | undefined>; // validate + LRU touch
  createEntryWriter: (key: string, meta: ...) => CacheEntryWriter;
  listEntries: () => Promise<...>;
  computeStats: () => Promise<CacheStats>;
  clear: () => Promise<void>;
  evictToLimit: (limitBytes: number) => Promise<EvictionResult>;
};

type CacheEntryWriter = {
  appendChunk: (streamName: "stdout" | "stderr", bytes: Uint8Array) => void;
  commit: (exit: ...) => Promise<void>; // writes entry.json LAST, renames into place
  abort: () => void;                    // removes temp dir
};
```

- **Incremental writer (settled):** Stage 4's pump-loop tee calls `appendChunk` as chunks arrive (no double-buffering); failing runs `abort()`.
- **Replay read:** `lookup` hit exposes the manifest plus an output reader that loads `output.bin` once and yields `{ streamName, chunk }` subarrays per the manifest chunk index.

### Paths, temp dirs, atomic commit

- `resolveCacheStorePaths(rootDirectory)` -> `{ cacheRootDir: <root>/node_modules/.cache/pacwich, resultsDir: .../results/v1 }` (pure joins, no fs).
- `mkdirSync(..., { recursive: true, mode: 0o700 })`, mode at creation per the TOCTOU rationale in `tempFile.ts` (~44-51). Recursive mkdir covers missing node_modules.
- Temp entry dirs `results/v1/.tmp-<shortId>` (reuse `createShortId` from `internal/core/language/string/id`), inside the store so the commit `fs.rename` never crosses devices.
- `commitDirAtomically`: rename temp -> final. EEXIST/ENOTEMPTY (POSIX) or EPERM (Windows) = concurrent winner: remove temp, return `{ committed: false, reason: "alreadyExists" }`, callers treat as success.

### Manifest (`entry.json`)

- Typed `CacheEntryManifest` with a hand-rolled type guard, not AJV (internal format, corruption = miss).
- Read validation: JSON parse, guard, `key` matches dir name, `totalBytes` matches `output.bin` stat. Any failure = miss + `logger.debug`.
- LRU touch: `fs.utimes` on `entry.json` at hit time, errors swallowed.

### Eviction, stats, clear

- `listEntries()`: readdir `resultsDir`; dirs with a valid manifest are entries; `.tmp-*` and manifest-less dirs are garbage, deleted during sweeps only past a grace period (~1h mtime) to avoid racing an in-flight commit.
- `evictToLimit(limitBytes)`: sort by `entry.json` mtime ascending, delete oldest until under limit, ENOENT-tolerant, returns `{ evictedCount, freedBytes, failures }`. Warning-id registration in `pacwich-common/warnings` TEMPLATES (e.g. `CacheEvictionFailure`) can wait until Stage 4 wires the first caller.
- `computeStats()`: entryCount, totalBytes, oldest/newest `createdISO`, store path.
- `clear()`: removes the whole `node_modules/.cache/pacwich` root (future artifact stores share it).

### Size limit (`sizeLimit.ts`)

- `parseCacheSizeLimit(value: number | string)`: number = positive integer bytes; string = `"unbounded"` or `<number><unit>` (optional space, case-insensitive). Units are binary with flexible spellings: `K`/`KB`/`KiB`, `M`/`MB`/`MiB`, `G`/`GB`/`GiB`, `T`/`TB`/`TiB` all mean the binary unit. Bare numeric strings parse as bytes. Anything else throws the `defineErrors` error naming the bad value.
- `computeEffectiveCacheSizeLimit`: min(ceiling, `CACHE_DISK_FRACTION` * statfs total at store path); statfs throw = ceiling only; `"unbounded"` = no sweep at all. Take statfs as an injectable option defaulting to `fs.promises.statfs` for unit-testability.

### Tests (`tests/features/cache/`, via `tests/util/testFramework.ts`)

- `hash.test.ts`: DONE (10 passing).
- `sizeLimit.test.ts`: parse cases per type/unit/casing, `"unbounded"`, invalid strings, zero/negative, float bytes; effective-limit with injected statfs (ceiling wins, fraction wins, throw fallback, unbounded).
- `store.test.ts`: writer roundtrip preserves chunk order and stream attribution byte-for-byte; commit collision (pre-created final dir) reports alreadyExists and cleans temp; `abort()` removes temp; corrupt/truncated manifest, key/dir mismatch, totalBytes mismatch all read as miss; hit bumps mtime; missing node_modules auto-created.
- `evict.test.ts`: oldest-first via explicitly `utimes`-set mtimes (avoids timing flake), stops at limit, garbage swept only past grace age, ENOENT tolerance mid-sweep, stats correctness.

## Staged implementation

**Stage 1 — Cache primitives.** IN PROGRESS. hash.ts + tests done and committed; store.ts stub exists. Remaining: constants, sizeLimit, errors, full store implementation, tests per zoom section. No product wiring.

**Stage 2 — Config surface.** DONE: workspace-side input types (`environmentVariables`, `customInputs` + four Custom* types), public exports, workspace schema, config tests. REMAINING: `ScriptConfig.cache`, `ProjectConfig.cache` section + resolved forms and resolvers (copy the `resolveCliScriptOutputStyleConfigValue` pattern), project schema, merges check, `resolvedToWorkspaceConfig` in `applyWorkspacePatternConfigs.ts` for any new resolved field, `userEnvVars.ts` + three `USER_ENV_VARS` keys, and `ENV_VARS_METADATA` entries in `documentation-website/src/lib/config/envVars.tsx` (exhaustive Record: doc build breaks without them). Tests in `tests/config/`.

**Stage 3 — Key computation + project wiring.** Export/lift `buildWorkspaceInputs` from `affectedWorkspaces.ts`; new resolved-dep-version-map helper beside `externalDependencyChanges.ts`; per-run cache context + `computeWorkspaceScriptCacheKey` in `src/cache/`. Tests: determinism plus one invalidation test per key dimension (file content, script body, args, shell, env value, custom input result, external dep version, workspace dep change) via `createGitFixture`/`loadFixture`, with `describeEachPm` for the lockfile dimension.

**Stage 4 — Execution integration + API.** Optional preliminary commit: extract shared per-workspace prep in `fileSystemProject.ts`. Then: `RunScriptsScript.cache` descriptor + store interface; hit/replay wrapper and save tee in `runScripts.ts`; `RunScriptExit.cached`/`cacheKey`; wiring at both prep sites; run-level and factory `cache` options; post-run sweep; `Project.clearCache/cacheStats/pruneCache`; `src/index.ts` exports (+ `errorExports.ts`). Tests: `tests/features/runScript/internals/runScripts.test.ts` with in-memory store fake (hit, miss, replay-off, no-save-on-failure, dep-order-with-hit), plus end-to-end in `tests/api/fileSystemProject/runScriptAcrossWorkspaces/` (second run cached, cache:false, event semantics, summary fields). Likely a new registered fixture in `tests/fixtures/testProjects/testProjects.ts` with cache-opted scripts.

**Stage 5 — CLI.** `commandsConfig.ts` flags on runScript + `RUN_AFFECTED_OPTIONS`, new `cache` command group (clear/info/prune) under `src/cli/commands/`, `SharedRunScriptCliOptions` + `scriptRunFlow.ts` passthrough and cached log line, grouped renderer `"cached"` status, `webCliGuards.ts` entries. CLI tests per the AGENTS.md matrix.

**Stage 6 — Docs + polish.** `md/ai/context/` (config.md, concepts.md, cliExamples.md, apiExamples.md), regenerate aiDocs via `scripts/createPublicAgentDocs.ts`, documentation-website config pages + display trees + `cliCommandOptions.tsx`, verify `/web-cli` page and `bun docs build`, changelog.

## Critical files

- `workspaces/packages/pacwich/src/runScript/runScripts.ts` (skip branch ~270-283, spawn ~290, pump loop ~301-309, drain ~354-359)
- `workspaces/packages/pacwich/src/project/implementations/fileSystemProject/fileSystemProject.ts` (~601, ~932-1008, factory ~1298)
- `workspaces/packages/pacwich/src/project/implementations/fileSystemProject/affectedWorkspaces.ts` (`buildWorkspaceInputs` ~192)
- `workspaces/libraries/pacwich-common/config/configTypes.ts` (`WorkspaceInputsConfig`, `ScriptConfig`, Custom* types)
- `workspaces/libraries/pacwich-common/config/userEnvVars.ts`, `workspaces/libraries/pacwich-common/cli/commandsConfig.ts`
- `workspaces/packages/pacwich/src/config/{projectConfig,workspaceConfig}/*`, `src/workspaces/applyWorkspacePatternConfigs.ts`
- `workspaces/packages/pacwich/src/cli/commands/runScript/{scriptRunFlow.ts,output/renderGroupedOutput.ts}`
- Reused: `src/inputs/{listProjectTrackableFiles,matchWorkspaceInputFiles}.ts`, `src/packageManager/adapter/*` lockfile adapters, `resolveInputsLookupScriptName`

## Verification

- Per stage: `bun pw test -- <pattern>`; `bun lint`; `bun format`; `bun pw type-check` (all from worktree root).
- End-to-end after Stage 4/5: run a cache-opted script twice, confirm replay + cached marker + `--json-outfile` `cached`/`cacheKey`; `--no-cache` respawns; failures save nothing; over-limit eviction is oldest-first; `pacwich cache info/clear/prune` behave.
- `bun pw build-for-tests` + `bun pw test:build:node` for Node-runtime parity (statfs, node:crypto).
- `bun docs build` after Stages 2 and 6 (env var metadata, web-cli guards).

## Future extensions (flagged, not in scope)

Artifact capture/restore; global store or machine-wide limit; `{ read?, write? }` run option form; per-script replay override; surfacing original duration on hits; store location config.
