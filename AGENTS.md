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