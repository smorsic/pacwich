---
name: manual-qa
description: Guide the user step-by-step through performing QA of pacwich themselves (CLI, API, config), handing them copy-pasteable commands/code and doc pointers as they drive. Inverse of agent-qa.
---

# Manual QA

This is the inverse of `agent-qa`. There, the agent performs QA autonomously end-to-end and files a report. Here, **the user** performs the QA. The agent's job is to prepare, guide, and track, one step at a time, handing over exact commands/code/paths/URLs to copy and paste, plus pointers to the real docs to cross-reference. Style this like `doc-updates`/`release`: a tracked checklist the user works through, not an autonomous run.

## Scope

Same axes as `agent-qa`. If the user doesn't provide adequate scope up front, ask a question set (allow freeform notes on top of selections):

- Features to cover: "all"/freeform, or scoped by layer (CLI/API/config) or named feature
- Runtime to use: Node or Bun
- Package manager to use: bun, npm, or pnpm
- Install source: local build (`workspaces/packages/pacwich/dist`, needs `bun pw build` first) or published npm package

"Only walk me through the CLI, use the local build" is adequate scope. It's fine for the user to leave the rest at full/default.

The user may redirect mid-session (skip a section, jump ahead, revisit something) without saying so explicitly. Follow their lead like any interactive walkthrough, no special handling needed.

## Roles

- **Agent**: sets up the sandbox, scaffolds/mutates the test monorepo, resolves the exact command/code/URL for the current step, reads TSDoc via the sandbox (not the user), tracks progress, and reviews what the user reports back.
- **User**: runs the commands, pastes/edits the API and config files the agent hands them, does interactive things (`pacwich completion install`, confirming a prompt, etc), and reports back what happened (paste output or describe it) so the agent can judge the step and move to the next one.

Give one step at a time (e.g. a command or file to add plus what to expect) rather than a wall of steps at once. Wait for the user's result before advancing, since the point is to actually exercise things through their hands, not to pre-run everything yourself.

## Task tracking

Use TaskCreate at the start of a session: one task per major checklist item under [Guided steps](#guided-steps) that's in scope (skip sections outside the chosen scope). Mark a task in_progress while walking through it, completed once the user confirms the outcome.

## Working directory

Use a single temp directory (e.g. `mktemp -d`) for the whole session. This is both:

- the sandbox's work dir (where CLI commands run, via `scripts/sandbox.sh`)
- the directory the user has open in their own IDE/editor (for writing API scripts and config files by hand)

Scaffold and mutate the monorepo here as the session progresses (add workspaces, deps, scripts, config) to demonstrate whatever's currently being walked through. This follows the same idea as the `agent-qa` skill's scaffolding but is built incrementally alongside the user instead of all at once.

After scaffolding or any meaningful mutation, print a pretty file tree of the work dir (`tree -a -I '.git|node_modules'` if available, otherwise a manual indented listing) annotated with brief notes on which files matter for what's currently being tested, so the user can jump straight to them in their IDE.

## Sandbox shell

`scripts/sandbox.sh` (read it to see the mechanism) is a lighter-weight variant of agent-qa's: instead of many discrete non-interactive invocations, the user drops into one interactive shell and works in it directly.

```bash
sandbox.sh setup [npm|bun|pnpm] [npm|local|<other>]  # build sandbox + global install
sandbox.sh shell                                     # interactive shell inside it
sandbox.sh run  <cmd...>                             # one-off command inside it (agent use)
sandbox.sh install [project-dir]                     # local-install pacwich for the API
sandbox.sh tsdoc [project-dir]                        # dump installed pacwich TSDoc (agent reads this)
sandbox.sh env                                        # print sandbox paths
sandbox.sh teardown                                   # remove it
```

Have the agent run `setup` (it resolves the local build vs npm package the same way the `agent-qa` skill does: pack the dist into a tarball for `local` so the install is a real copy, not a symlink into the source tree). Then hand the user `sandbox.sh shell` to run themselves. That's their sandboxed "fresh machine" terminal for the rest of the runtime/pm pass: global install already done, ready for `pacwich completion install`, running commands, etc.

Only a handful of `setup`+`shell` cycles are expected per session (one per runtime/pm/source combo the user wants to try), not one per command. To switch runtime/pm/source, the user leaves the shell (Ctrl+D or `exit`) and the agent reruns `setup` with new args before handing back `shell`.

Use `sandbox.sh install <workdir>` yourself to get pacwich locally installed for API work, and `sandbox.sh tsdoc <workdir>` to read the installed build's TSDoc when you need to double check an API surface detail before handing the user code to paste.

Always `sandbox.sh teardown` when the session ends.

## Documentation pointers

The point of this skill is to validate that pacwich's real, shipped documentation is enough for a user to succeed. Because of this, you are not allowed to read source code unless explicitly told to by the user.

- **CLI help**: have the user run `pacwich --help` / `pacwich <command> --help` themselves rather than paraphrasing it for them. It's what a real user sees and may drift from any doc snapshot.
- **TSDoc**: read via `sandbox.sh tsdoc <workdir>` (you do this, not the user) to ground the exact API code you hand over. Still tell the user their editor will show the same TSDoc on hover once the package is installed in the file they're editing, so they can cross-check it themselves too.
- **Documentation website**: give the user a real `https://pacwich.dev/...` URL whenever you point at a doc, derived from the source file path in `workspaces/web/documentation-website/src/pages/**/index.mdx`:
  - `src/pages/cli/commands/index.mdx` → `https://pacwich.dev/cli/commands`
  - `src/pages/index.mdx` → `https://pacwich.dev/`
  - Append `#some-heading` (kebab-case of the heading text) when pointing at a specific section.
  - For your own reading (not what you hand the user), fetching `https://pacwich.dev/<path>/index.md` gets the raw markdown for that page without rendering. `https://pacwich.dev/llms.txt` (used by agent-qa) also works as a page manifest if you need to find where something lives.
  - If using a local build instead of the real package, use the URL `https://pacwich-docs.localhost` instead (user runs via `bun docs dev`).
- **README.md** (repo root) can be read directly, same exception as agent-qa. It's the one doc source that's fine to read from disk since it's the literal end-user-facing file.

## Guided steps

Mirror the agent-qa skill's "Full Verification" breakdown, but walked interactively rather than run autonomously. Only cover sections in scope.

### Installation

Walk the user through installing the CLI globally in the sandbox shell (already done by `sandbox.sh setup`, but confirm with the user what it did and why), then a local install (`sandbox.sh install <workdir>`) to confirm global-delegates-to-local behavior. It's fine to have the user mutate a local install's version to force a version diff and observe the delegation message. Have them try `pacwich completion` and `pacwich completion install` in their real shell profile if willing. This is exactly the kind of thing that's awkward for `agent-qa` to test but easy here.

### CLI commands

Work through commands from `https://pacwich.dev/cli` (and `https://pacwich.dev/cli/commands`, `https://pacwich.dev/cli/global-options`) one at a time: give the user the command to paste, tell them what to expect, and have them confirm the result (or paste output back) before moving on. Cross-check against `pacwich <command> --help` output as you go.

### API

Have the user run `sandbox.sh install <workdir>` (or do it yourself, then tell them it's done) so `pacwich` is a local dependency they can import from a file in the work dir. Hand them a small script to create (e.g. `api-test.ts`) with real code. Use TSDoc (read by you via `sandbox.sh tsdoc`) plus `https://pacwich.dev/api` and `https://pacwich.dev/api/reference` to ground the exact surface and a command to run it (`bun run api-test.ts`, or the Node equivalent for the chosen runtime). Iterate: swap in the next API feature to try, referencing what's documented, then check for anything present on the object/module that isn't documented and doesn't look intentionally private (no leading underscore).

### Configuration

Walk through `pacwich.project.*` and `pacwich.workspace.*` in each supported form (ts/js/jsonc/json, plus the `package.json` key form) referencing `https://pacwich.dev/config`, `https://pacwich.dev/config/project`, `https://pacwich.dev/config/workspace`, and `https://pacwich.dev/config/workspace-pattern-configs`. Have the user add one config file/option at a time and confirm the effect (e.g. via `pacwich config debug --pretty`).

### Errors and edge cases

Once the straightforward pass is done, if the user wants to go deeper: have them try things against the grain of each interface (malformed config, conflicting flags, unconventional workspace patterns) and report back anything that seems like a misleading or unhelpful error/warning message.

## Wrap-up

Ask the user whether they want a written summary. Since they experienced it firsthand, a formal report is optional here (unlike `agent-qa`, where it's the primary deliverable), but if real bugs turned up, still write them up as proper bug reports (steps to reproduce, expected vs actual) so they're easy to hand off or file as issues.
