# Migrations

Versioned migrations live in this folder and are executed by `services/migrationRunner.js`.

## Conventions

- File names are ordered lexicographically and should start with a numeric prefix, e.g. `001_initial_schema.js`.
- Each migration exports:
  - `version`: unique version string
  - `description`: human-readable summary
  - `up(client)`: async function that applies changes

## Execution

Run explicitly in local/dev:

```bash
node scripts/run-migrations.js
```

Production boot does not execute DDL directly. If controlled boot-time migration is required, set:

- `DB_RUN_MIGRATIONS_ON_BOOT=true`

## Rollback strategy

This project uses forward-only migrations by default.

Minimum rollback strategy:

1. Restore from latest verified database backup/snapshot.
2. Re-deploy previous application build.
3. Re-run migrations explicitly only after recovery validation.

For high-risk migrations, add a companion operational rollback runbook before deployment.
