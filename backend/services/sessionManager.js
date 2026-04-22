// Flattened shim (U1): points directly at the legacy implementation
// instead of bouncing through backend/baileys/. backend/baileys/
// previously wrapped this file; keeping a level of indirection was
// purely historical and made backend/baileys/ look load-bearing
// when in fact it just forwarded here.
module.exports = require('./sessionManager.legacy');

