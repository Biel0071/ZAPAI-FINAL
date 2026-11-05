const sm = require('/opt/zapai/backend/services/sessionManager');
const cs = require('/opt/zapai/backend/services/connectionService');

(async () => {
  console.log('Starting session main...');
  try {
    const res = await sm.reconnectSession('main', { force: true });
    console.log('RECONNECT RESULT:', res);
  } catch (err) {
    console.error('RECONNECT ERROR:', err);
  }
})();

