/**
 * Mutable singleton registries shared across the WhatsApp subsystem.
 * Extracted from whatsappService.legacy.js (Phase 2c).
 *
 * - `chats`: per-chatId in-memory store for legacy message archival.
 *   Read/written by `getOrCreateChat`, `saveMessage`, and re-exported on the
 *   top-level `whatsappService` module for legacy callers.
 * - `activeSessions`: `{ [normalizedSessionName]: SessionContext }`. Mutated
 *   by `createStableSession` (creation/deletion) and by the Baileys
 *   `connection.update` listener. Read by `findSessionForChat`,
 *   `restoreSessions`, `stopSession`, `stopAllSessions`.
 *
 * Both values are **exported by reference**. Any code that mutates the
 * returned object (pushes to `chats`, deletes a session from
 * `activeSessions`) affects every other consumer, which matches the legacy
 * semantics exactly.
 *
 * This module has **no** logic — it only centralises the declaration so we
 * can migrate consumers to a single source of truth without rewriting the
 * read/write semantics.
 */

const chats = Object.create(null);
const activeSessions = Object.create(null);

module.exports = {
  activeSessions,
  chats,
};
