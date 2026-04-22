# Services AI Context

Purpose: business logic, session orchestration, AI processing, diagnostics, logging, and microtask execution.

Patterns:
- thin controllers, service-driven orchestration
- side effects isolated in dedicated services
- background jobs expose `stop()` methods

Dependencies:
- repositories for PostgreSQL access
- Baileys for WhatsApp sessions
- Socket.IO for realtime events

Conventions:
- export plain functions
- prefer async/await
- log recoverable failures without crashing the process
