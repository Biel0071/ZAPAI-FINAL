---
name: Tenant ID Header
description: Backend requires x-tenant-id header set to "main" on all API requests
type: feature
---
All API requests to the backend MUST include the `x-tenant-id: main` header. Without it, every endpoint (except /api/health) returns 400 with `{"error":"x-tenant-id header is required."}`. This applies to apiService.ts, systemControlService.ts, and errorLogService.ts.
