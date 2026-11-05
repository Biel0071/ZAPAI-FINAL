const sm = require('/opt/zapai/backend/services/sessionManager');
const cs = require('/opt/zapai/backend/services/connectionService');
const repo = require('/opt/zapai/backend/src/data/repositories/sessionRepository');
const wb = require('/opt/zapai/backend/services/webbridge/WebBridgeSessionManager');

(async () => {
  const db = await repo.getSessions('default', { activeOnly: false });
  const active = sm.listSessions();
  const conn = await cs.listConnections('default');
  const wbState = wb.getSessionState('main', 'default');
  console.log('--- DB SESSIONS ---', JSON.stringify(db, null, 2));
  console.log('--- ACTIVE SESSIONS ---', JSON.stringify(active, null, 2));
  console.log('--- LIST CONNECTIONS ---', JSON.stringify(conn, null, 2));
  console.log('--- WB STATE ---', JSON.stringify(wbState, null, 2));
  process.exit(0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});

