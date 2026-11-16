'use strict';

const attendantTables = require('./053_create_attendants_multi_tenant_tables');

// Environments that applied an early revision of 053 lack is_primary and the tenant FKs.
// 053 is idempotent, so re-running it brings those databases to the current schema.
module.exports = {
  version: '057_reapply_attendant_assignment_constraints',
  description: 'Reapply idempotent attendant assignment schema (is_primary, tenant FKs, principal indexes)',
  async up(client) {
    await attendantTables.up(client);
  },
};