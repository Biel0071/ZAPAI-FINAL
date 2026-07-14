const test = require('node:test');
const assert = require('node:assert/strict');

function loadRecoveryService({ status = 'disconnected' } = {}) {
  const managerPath = require.resolve('../services/sessionManager');
  const validatorPath = require.resolve('../services/whatsapp/connection/sessionPersistenceValidator');
  const servicePath = require.resolve('../services/sessionRecoveryService');
  let reconnectCalls = 0;

  require.cache[managerPath] = {
    id: managerPath,
    filename: managerPath,
    loaded: true,
    exports: {
      getSession: () => ({ displayName: 'Material', sessionName: 'material', status }),
      normalizeSessionName: (value) => String(value),
      reconnectSession: async () => {
        reconnectCalls += 1;
        await new Promise((resolve) => setTimeout(resolve, 10));
        return { status: 'connecting' };
      },
    },
  };
  require.cache[validatorPath] = {
    id: validatorPath,
    filename: validatorPath,
    loaded: true,
    exports: {
      listSessionIds: async () => ['material'],
      validateSession: async () => ({ ok: true }),
    },
  };
  delete require.cache[servicePath];

  return {
    service: require(servicePath),
    reconnectCalls: () => reconnectCalls,
  };
}

test('forces one reconnect for concurrent recovery requests', async () => {
  const fixture = loadRecoveryService();
  const results = await Promise.all([
    fixture.service.recoverSessions(),
    fixture.service.recoverSessions(),
  ]);

  assert.equal(fixture.reconnectCalls(), 1);
  assert.deepEqual(results.flat(), ['material']);
});

test('does not reconnect a connected session', async () => {
  const fixture = loadRecoveryService({ status: 'connected' });
  const recovered = await fixture.service.recoverSessions();

  assert.equal(fixture.reconnectCalls(), 0);
  assert.deepEqual(recovered, []);
});
