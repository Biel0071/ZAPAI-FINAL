const sessionStateService = require('../services/sessionStateService');
const { activeSessions } = require('../services/whatsapp/state/registry');

async function main() {
  console.log('Session state:', sessionStateService.getWhatsappSession());
  console.log('Active sessions keys:', Object.keys(activeSessions || {}));
  for (const [k, v] of Object.entries(activeSessions || {})) {
    console.log(`Session [${k}]: status=${v?.status}, connected=${v?.connected}, user=${JSON.stringify(v?.sock?.user)}`);
  }
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
