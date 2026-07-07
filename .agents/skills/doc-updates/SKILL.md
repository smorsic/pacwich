---
name: doc-updates
description: Use when user is ready to work on documentation updates after unreleased changes have been made. Use
this to help track tasks for the user to complete and to incrementally review their changes.
---

# Document Updates Skill

## User tasks

The user should write documentation unless explicitly requesting agent changes. By default, create tasks for each of these with suggestions based on recent changes. The user will close these out by confirming changes or giving reason to skip.

Below, each section comprises at least each main task, with optional subtasks depending on complexity of changes.
Review the user's documentation changes after each task/subtask, focusing mainly on accuracy, grammar, and thoroughness.
Don't block a task for very minor nitpicks. Just suggest those changes and move on.

## Quick Starts

These are DRY examples used in the README and documentation website.

- Updates are to workspaces/libraries/pacwich-common/docs
  - Updates are only for each affected by change (CLI, API, and/or config)
- If something like a deeper/advanced feature addition is made, user might opt out of adding to quick start

## AI docs

These are terse markdown versions of the complete docs used in all AI-friendly documentation features and build the repo's own AGENTS.md. They don't use the quick starts in order to balance brevity with completeness.

- Similar to the quick start splits, changes may need to be made for these files from the repo root:
  - md/ai/context/apiExamples.md
  - md/ai/context/cliExamples.md
  - md/ai/context/config.md
  - md/ai/context/concepts.md
    - This covers features in-depth where CLI and API examples only cover usage
    - Read this file for examples of concepts and to help suggest whether change is needed
    - For example, additions to affected features likely require updates to this file
  - md/ai/context/overview.md
    - An intro to the package. It may likely not warrant change

## README.md

- Changes to md/public/README_TEMPLATE.md first
  - Give it a scan in case anything may be made inaccurate
- CLI/API/config quickstart updates are handled in the first task
  - This may cover most feature changes without direct README_TEMPLATE updates. If so, the README task can be skipped
- Noteworthy feature additions to highlight may warrant a change beyond the quick starts
- Run `bun install` after to generate an updated README.md if changes made

## Documentation website

Findings based on below may be appropriate to split into more tasks, but not for every point below unless seemingly relevant to changes in question:

- Changes are in workspaces/web/documentation-website
- Reminder that quick start changes from the first task will take effect automatically, but the more thorough references for CLI/API/config must be updated if changes occur with these regardless
- You don't need to read the whole source to suggest changes, but some ways to suggest changes:
  - All existing pages are found as src/pages/\*\*/index.mdx
    - This list can help suggest where changes may take place
  - If there may be a reason changes could make previous docs inaccurate, it may be worth a deeper scan at content
  - New concept page(s) may be needed if a concept change was needed in earlier doc steps
  - Page additions/changes need to be covered in rspressLinks.ts
- CLI changes
  - cliCommandOptions.tsx maps required metadata about CLI commands
    - an example for each flag must exist
  - cliGlobalOptions.tsx similarly maps metadata for global options
  - The above metadata files and CLI quick start from earlier step may cover most CLI updates
- API changes
  - The API reference page must be updated
- Config changes
  - The workspace or project config page will likely need to be updated
  - Some config options are explored more in depth in concept pages, like inputs
  - Config metadata is captured in various ways in lib/config
  - Env vars are updated at envVars.tsx like the CLI metadata
- If a page is renamed/moved, it needs a redirect in rspress.config.ts
  - This should be a very rare need
  - Note that the rspress framework will catch old dead links at compile time already
