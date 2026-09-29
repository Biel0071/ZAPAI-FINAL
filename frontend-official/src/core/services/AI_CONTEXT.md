# AI Context — services

- **Purpose**: Centralize API access, realtime adapters, and orchestration helpers.
- **Patterns**: Normalize backend payloads, guard nullish fields, handle errors non-blockingly where possible.
- **Data Flow**: Services are consumed by pages/hooks and return typed data contracts.
- **Dependencies**: Supabase function invocations, Socket.IO client, browser fetch.
