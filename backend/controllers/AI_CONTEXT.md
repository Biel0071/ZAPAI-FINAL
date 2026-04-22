# Controllers AI Context

Purpose: translate HTTP requests into service calls and return normalized JSON responses.

Patterns:
- validate inputs early
- keep controllers thin
- delegate persistence and business rules to services/repositories

Dependencies:
- services
- repositories only when returning list endpoints

Conventions:
- use Express `req` and `res`
- respond with clear status codes
