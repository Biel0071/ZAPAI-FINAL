# Microtasks AI Context

Purpose: break complex message and runtime workflows into isolated async tasks.

Patterns:
- each file exports `runTask(payload)`
- microtasks are idempotent where possible
- failures should be contained by the microtask runner

Dependencies:
- repositories and lightweight services

Conventions:
- return enriched payload objects
- avoid crashing the process on task failure
