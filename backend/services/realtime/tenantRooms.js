/**
 * Tenant-scoped Socket.IO helpers.
 *
 * Goal: allow emitting realtime events to a single tenant's sockets instead of
 * broadcasting globally. Existing `io.emit(...)` calls continue to work; new
 * code should prefer `emitToTenant` / `emitToTenantWithAliases`.
 *
 * Tenant room name convention: `tenant:<tenantId>`
 */

const DEFAULT_TENANT = String(process.env.DEFAULT_COMPANY_ID || 'default').trim() || 'default';

function normalizeTenantId(value) {
  const trimmed = String(value || '').trim();
  return trimmed || DEFAULT_TENANT;
}

function tenantRoomName(tenantId) {
  return `tenant:${normalizeTenantId(tenantId)}`;
}

function resolveSocketTenantId(socket) {
  if (!socket) return DEFAULT_TENANT;

  const handshake = socket.handshake || {};
  const auth = handshake.auth || {};
  const query = handshake.query || {};
  const headers = handshake.headers || {};

  const candidate =
    auth.tenantId ||
    auth.companyId ||
    query.tenantId ||
    query.companyId ||
    headers['x-tenant-id'] ||
    headers['x-company-id'];

  return normalizeTenantId(candidate);
}

function joinTenantRoom(socket) {
  if (!socket) return DEFAULT_TENANT;
  const tenantId = resolveSocketTenantId(socket);
  socket.data = socket.data || {};
  socket.data.tenantId = tenantId;
  socket.join(tenantRoomName(tenantId));
  return tenantId;
}

function emitToTenant(io, tenantId, event, payload) {
  if (!io) return;
  const room = tenantRoomName(tenantId);
  try {
    io.to(room).emit(event, payload);
  } catch (error) {
    console.error(`[SOCKET] emitToTenant failed (${event}):`, error?.message || error);
  }
}

function emitToTenantWithAliases(io, tenantId, event, payload, aliases = []) {
  emitToTenant(io, tenantId, event, payload);
  for (const alias of aliases || []) {
    emitToTenant(io, tenantId, alias, payload);
  }
}

module.exports = {
  DEFAULT_TENANT,
  emitToTenant,
  emitToTenantWithAliases,
  joinTenantRoom,
  normalizeTenantId,
  resolveSocketTenantId,
  tenantRoomName,
};
