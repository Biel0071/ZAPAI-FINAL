// Legacy socket hook intentionally retired.
// The official realtime architecture is centralized in:
// - src/providers/RuntimeProvider.tsx
// - src/services/socketService.ts
// - page-specific subscriptions only where explicitly required
//
// Do not reintroduce per-feature socket wrappers here.
export {};
