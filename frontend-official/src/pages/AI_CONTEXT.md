# AI Context — pages

- **Purpose**: Route-level screens for dashboard, inbox, connections, campaigns, analytics, and settings.
- **Patterns**: Data fetching in `useEffect`, derived UI via `useMemo`, handler stability via `useCallback`, and semantic Tailwind tokens.
- **Data Flow**: Pages consume services from `src/services`, then render UI components from `src/components/ui`.
- **Dependencies**: React Router, Framer Motion, shared UI primitives, socket subscriber integration.
