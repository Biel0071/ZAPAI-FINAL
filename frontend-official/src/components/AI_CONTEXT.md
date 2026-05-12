# AI Context — components

- **Purpose**: Reusable UI and layout primitives.
- **Patterns**: Composition-first components, tokenized theme classes, minimal business logic.
- **Data Flow**: Props-in, events-out. State should live in pages/services unless purely presentational.
- **Dependencies**: shadcn UI wrappers, utility helpers (`cn`), theme provider, Radix primitives.
