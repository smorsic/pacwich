---
name: review-assist
description: Use to assist a manual review of the codebase
---

# Review Assist

This is a skill to help a developer review some section of the codebase.

Usually, this will be for uncommitted changes or recent commits, but it could
also be for any arbitrary scope provided by the user. If the user provides
no scope for review, ask for it.

The focus of this review is to assist a developer in understanding changes
rather than performing full agentic review, though anything that stands out
as potentially problematic should be noted.

## Describing Changes

- First read the code in scope to understand its structure
- Focus on finding the flow of the source code (e.g. the core entrypoint logic of a feature to how its wired to CLI/API/config/etc.)
- If the change is complex enough, break it down into chunks by concern that are easier to digest separately
  - Create a task for each chunk that the user will sign off on after performing review
  - Go roughly in order of core to interface concerns (e.g. start with core engine before describing CLI/API wiring)
  - Don't dump all chunk info at once. Instead make a brief summary of chunks and focus on describing one chunk at a time in detail, starting with the first
- Describe the flow of function usage with file references, highlighting higher level functions (e.g. a file's main export getting highlighted and described, with perhaps shorter descriptions of helpers)
- Tests: only give brief descriptions of each case handled, and describe test fixtures (e.g. test projects) briefly rather than delving into all internals
- Docs: if doc changes are relevant (skip if not explicitly part of scope), simply point to the docs since they should be self-explanatory by nature
- The user may likely make modifications to code during this process ask questions
