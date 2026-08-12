---
name: database
description: Use when creating or modifying database schemas, writing queries, creating migrations, or profiling database performance.
---

# Universal Database Skill

Provides stack-agnostic guidelines for schema migrations, query safety, indexing, and data isolation.

## Database Detection Workflow

```
DETECT DATABASE (PostgreSQL, MySQL, SQLite, MongoDB, Redis, SQL Server)
      │
      ▼
DETECT ORM/DRIVER (Prisma, Drizzle, TypeORM, Sequelize, SQLAlchemy, Django ORM, pg, mysql2, etc.)
      │
      ▼
DETECT MIGRATION SYSTEM (Prisma Migrate, Knex, Liquibase, Alembic, Django, native SQL)
      │
      ▼
DETECT QUERY PATTERNS & TENANT ISOLATION
      │
      ▼
APPLY DATABASE RULES
```

## Universal Rules

1. **Schema Migrations**: Always use the project's migration system. Never alter production tables manually without versioned migrations.
2. **Query Safety**: Use parameterized queries or ORM query builders to prevent SQL/NoSQL injection.
3. **Performance & N+1**:
   - Avoid N+1 query patterns. Use `JOIN`s, batch fetching, or ORM eager loading (`include`/`select_related`).
   - Add database indexes for columns heavily queried in `WHERE`, `JOIN`, or `ORDER BY` clauses.
4. **Tenant Scoping**: Ensure multi-tenant models include tenant scoping in primary queries and indexes.
