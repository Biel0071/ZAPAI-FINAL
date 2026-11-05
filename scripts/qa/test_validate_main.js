const { validateSession } = require('/opt/zapai/backend/services/whatsapp/connection/sessionPersistenceValidator');

(async () => {
  const val = await validateSession('main');
  console.log('VALIDATION FOR main:', JSON.stringify(val, null, 2));
})();

