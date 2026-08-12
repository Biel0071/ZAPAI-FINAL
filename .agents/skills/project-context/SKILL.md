---
name: project-context
description: Use at the start of any new request to inspect project stack, structure, ORM, framework, and dependencies efficiently without reading the entire repository.
---

# Project Context Skill

Prevents reading the entire project unnecessarily. Focuses only on high-value context.

## Workflow

1. Read `.zapflow/project-profile.json` (auto-generated stack summary).
2. Read `package.json`, `go.mod`, `Cargo.toml`, or relevant manifest for key dependencies.
3. Identify relevant files for the current task using targeted glob search.
4. Avoid loading `node_modules/`, log files, session files, or binary assets.

## Progressive Disclosure Rules

- Never dump entire file trees into LLM context.
- Read only relevant module files.
- Max 5 files loaded at context initialization.
