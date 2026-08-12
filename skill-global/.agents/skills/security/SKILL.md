---
name: security
description: Use when working on authentication, authorization, user input validation, SQL/NoSQL queries, HTTP headers, or secret management to prevent vulnerabilities and enforce data isolation.
---

# Universal Security Skill

Provides security audit checklists, tenant data isolation standards, and vulnerability prevention.

## Core Security Checklist

### 1. Data Isolation & Multi-Tenancy (CRITICAL)
- [ ] Auto-detect the project's tenant identifier pattern (`tenantId`, `tenant_id`, `organizationId`, `workspaceId`, `accountId`).
- [ ] Ensure EVERY database query and data access call filters by the active tenant identifier.
- [ ] Validate tenant context from server-side middleware (e.g. JWT claims, verified request headers). Never trust client-controlled parameters without server verification.
- [ ] Enforce strict cross-tenant isolation: Tenant A MUST NEVER access Tenant B data.

### 2. Authentication & Authorization
- [ ] Validate tokens (JWT, OAuth, session cookies) in server middleware BEFORE executing business logic.
- [ ] Enforce Role-Based Access Control (RBAC) or Attribute-Based Access Control (ABAC) server-side.
- [ ] Expired or invalid tokens MUST return `401 Unauthorized`. Forbidden resource access MUST return `403 Forbidden`.

### 3. Injection Prevention (SQL / NoSQL / Command)
- [ ] Parameterized queries ALWAYS: Use parameterized placeholders (`$1`, `?`, ORM bindings) for all user inputs.
- [ ] NEVER interpolate user input strings directly into database queries or shell command executions.

### 4. Cross-Site Scripting (XSS) & Content Safety
- [ ] Escape user inputs when rendering in web interfaces.
- [ ] Validate and sanitize rich text, HTML, or raw payload inputs on the server.

### 5. Secret Protection
- [ ] Zero Hardcoded Credentials: Load secrets strictly from environment variables (`process.env`, `os.environ`, etc.).
- [ ] Redact secrets, passwords, and tokens from application logs.

### 6. Rate Limiting & Input Limits
- [ ] Enforce rate limiting on authentication, login, and public API endpoints.
- [ ] Enforce body payload size limits and file upload MIME-type validation.
