---
name: engineering-standards
description: Enforces core engineering discipline, preventing premature coding, ensuring test coverage, architectural alignment, and quality review.
---

# Engineering Standards Skill

## Core Standard Workflow

```
UNDERSTAND → CONTEXT → INVESTIGATE → PLAN → IMPLEMENT → TEST → REVIEW → VALIDATE
```

## Principles

1. **Do Not Code Immediately**: Understand requirements and inspect existing codebase first.
2. **Reusability Over Duplication**: Search for existing utilities, components, and services.
3. **Multi-Tenant Data Isolation**: Always scope database queries by tenant ID / company ID.
4. **No Direct Secret Exposure**: Keep credentials in `.env`, never in code or logs.
5. **Validation First**: Every change must be validated with tests and build checks.
