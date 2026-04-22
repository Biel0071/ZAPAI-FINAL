/**
 * Pure connection-reason helpers for Baileys sessions.
 * Extracted from whatsappService.legacy.js (Phase 2a).
 *
 * These functions inspect a `lastDisconnect` object produced by Baileys and
 * decide whether the session should attempt to reconnect. They are pure —
 * no timers, no socket state, no side effects.
 *
 * NOTE: folder is named `connection/` (not `sessions/`) because the project
 * `.gitignore` matches any `sessions/` directory as persisted auth data.
 * Source code belongs here.
 */

const { DisconnectReason } = require('@whiskeysockets/baileys');

function getConnectionCloseCode(lastDisconnect) {
  return (
    lastDisconnect?.error?.output?.statusCode ||
    lastDisconnect?.error?.data?.statusCode ||
    lastDisconnect?.error?.statusCode ||
    null
  );
}

function shouldReconnect(lastDisconnect) {
  const closeCode = getConnectionCloseCode(lastDisconnect);
  return closeCode !== DisconnectReason.loggedOut;
}

module.exports = {
  getConnectionCloseCode,
  shouldReconnect,
};
