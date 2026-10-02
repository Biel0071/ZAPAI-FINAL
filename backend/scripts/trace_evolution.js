const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const aiController = require('../src/api/controllers/aiController');

async function test() {
  const req = {
    params: { key: 'camila' },
    headers: { 'x-company-id': 'default' },
    auth: { tenantId: 'default' },
  };

  const res = {
    status(code) {
      console.log('Status code:', code);
      return this;
    },
    json(payload) {
      console.log('SUCCESS JSON:', JSON.stringify(payload, null, 2));
      process.exit(0);
    },
  };

  console.log('Calling aiController.getAgentEvolution directly...');
  const t0 = Date.now();
  await aiController.getAgentEvolution(req, res);
  console.log('Finished in', Date.now() - t0, 'ms');
}

test().catch(err => {
  console.error('Direct call error:', err);
  process.exit(1);
});
