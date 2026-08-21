# Repositories AI Context

Purpose: encapsulate PostgreSQL queries and row mapping.

Patterns:
- one repository per domain entity
- SQL stays inside repositories
- return normalized objects for controllers/services

Dependencies:
- config/database query helper

Conventions:
- use parameterized SQL
- keep mapping logic local to repository files
