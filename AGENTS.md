# Project agent instructions

## Graphify architecture map

Before answering architecture questions or creating a new controller, service, repository, page, hook, runtime module, or deployment script:

1. Query `graphify-out/graph.json` with `graphify query` to locate the existing responsibility.
2. Read `graphify-out/SYSTEM_MAP.md` for the canonical layer and path.
3. Use `graphify affected` before deleting or moving a runtime module.
4. Prefer extending the canonical module over creating a parallel implementation.
5. Keep tenant data isolated by `tenantId`/`companyId`; never introduce global business state.
6. Run Graphify extraction manually after structural changes. Do not attach an automatic pre-tool hook to this monorepo.

The automatic Graphify hook is intentionally disabled because a full monorepo scan before every command blocks local development.

# Global Agent Coding Principles & Methodology

## 1. Karpathy Core Principles
- **Think Before Coding**: Explicitly surface assumptions, constraints, and trade-offs. Never assume or proceed silently on ambiguity—clarify first.
- **Simplicity First**: Write the minimum code needed to solve the problem. Avoid speculative features, premature abstractions, or over-engineering. If 30 lines solve it clearly, do not write 150 lines.
- **Surgical Changes**: Touch only what is strictly necessary. Preserve existing patterns, style, and comments. Clean up only your own orphans.
- **Goal-Driven Execution**: Define verifiable success criteria upfront (reproduction tests, linters, commands) and verify before declaring completion.

## 2. Superpowers Engineering Workflow
- **Brainstorming Before Implementation**: For new features, clarify intent and user requirements with a clear spec before writing code.
- **Test-Driven Development (TDD)**: Write a failing reproduction test before fixing bugs or introducing new core behavior.
- **Systematic Debugging**: Find root causes methodically from logs, stack traces, and evidence. Never guess or apply random trial-and-error patches.
- **Subagent & Parallel Execution**: Break complex workflows into bite-sized, reviewable tasks.
- **Verification Before Completion**: Run automated tests, type checkers, and linters to prove the implementation works.

## 3. Code Standards & Architecture
- **Clarity & Maintainability**: Favor straightforward, self-documenting code over clever, convoluted abstractions.
- **Security & Hygiene**: Validate boundaries and sanitize inputs. Never commit or leak credentials, tokens, or private secrets.
