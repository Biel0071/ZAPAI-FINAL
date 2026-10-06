const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');

const backendRoot = path.resolve(__dirname, '..');
const enterprisePath = path.join(backendRoot, 'services/enterprise/message-service.js');

test.after(async () => {
  const { pool } = require('../src/infrastructure/config/database');
  await pool.end();
});

function loadEnterpriseWithStubs(stubs) {
  delete require.cache[enterprisePath];
  const originalLoad = Module._load;
  Module._load = function (request, parent, isMain) {
    if (parent?.filename === enterprisePath && Object.hasOwn(stubs, request)) return stubs[request];
    return originalLoad.call(this, request, parent, isMain);
  };
  try {
    return require(enterprisePath);
  } finally {
    Module._load = originalLoad;
  }
}

function loadMessageServiceWithStubs(stubs) {
  const modulePath = require.resolve('../services/messageService');
  delete require.cache[modulePath];
  const originalLoad = Module._load;
  Module._load = function (request, parent, isMain) {
    if (parent?.filename === modulePath && Object.hasOwn(stubs, request)) return stubs[request];
    return originalLoad.call(this, request, parent, isMain);
  };
  try {
    return require(modulePath);
  } finally {
    Module._load = originalLoad;
  }
}

test('realtime persistence carries WhatsApp ID and remote JID into the durable message row', async () => {
  let savedPayload;
  const enterpriseStub = {
    persistInboundMessage: async (payload) => { savedPayload = payload; return { message: { id: 'db-1' } }; },
  };
  const enterprisePathFromPipeline = require.resolve('../services/enterprise/message-service');
  require.cache[enterprisePathFromPipeline] = {
    id: enterprisePathFromPipeline,
    filename: enterprisePathFromPipeline,
    loaded: true,
    exports: enterpriseStub,
  };

  const { persistRealtimeMessage } = require('../services/whatsapp/inbound/pipeline');
  await persistRealtimeMessage({
    sessionId: 'main',
    incomingMessage: {
      key: { id: 'wa-message-1', remoteJid: '5511999990000@s.whatsapp.net', fromMe: false },
      messageTimestamp: 1_728_000_000,
      message: { conversation: 'mensagem recebida' },
    },
  });

  assert.equal(savedPayload.externalMessageId, 'wa-message-1');
  assert.equal(savedPayload.remoteJid, '5511999990000@s.whatsapp.net');
  assert.equal(savedPayload.timestamp, '2024-10-04T00:00:00.000Z');
  assert.ok(Number.isFinite(Date.parse(savedPayload.receivedAt)));
});

test('enterprise persistence stores remote JID alongside the WhatsApp message ID', async () => {
  let storedMessage;
  const conversationRepository = {
    findOrCreateConversationByPhone: async () => ({ id: 'conversation-1', aiEnabled: true, unreadCount: 0 }),
    updateConversationState: async (id) => ({ id }),
  };
  const messageRepository = {
    findByWhatsappMessageId: async () => null,
    create: async (data) => { storedMessage = data; return { id: 'db-1' }; },
  };
  const service = loadEnterpriseWithStubs({
    '../../src/data/repositories/conversationRepository': conversationRepository,
    '../../src/data/repositories/messageRepository': messageRepository,
    'fs/promises': { mkdir: async () => {}, appendFile: async () => {} },
  });

  await service.persistInboundMessage({
    companyId: 'tenant-a',
    externalMessageId: 'wa-message-2',
    remoteJid: '5511888880000@s.whatsapp.net',
    phone: '5511888880000',
    receivedAt: '2026-10-06T12:00:05.000Z',
    sessionId: 'sales',
    text: 'mensagem recebida',
    timestamp: '2026-10-01T09:30:00.000Z',
  });

  assert.equal(storedMessage.whatsappMessageId, 'wa-message-2');
  assert.equal(storedMessage.remoteJid, '5511888880000@s.whatsapp.net');
  assert.equal(storedMessage.timestamp, '2026-10-01T09:30:00.000Z');
  assert.equal(storedMessage.createdAt, '2026-10-06T12:00:05.000Z');
});

test('regular inbound persistence stores source time separately from receipt time', async () => {
  let storedMessage;
  let conversationUpdate;
  const conversation = { id: 'conversation-2', unreadCount: 0, lastMessage: null };
  const service = loadMessageServiceWithStubs({
    '../src/data/repositories/conversationRepository': {
      getConversationById: async () => conversation,
      updateConversationState: async (id, update) => {
        conversationUpdate = update;
        return { ...conversation, ...update, id };
      },
    },
    '../src/data/repositories/messageRepository': {
      create: async (data) => {
        storedMessage = data;
        return { id: 'db-in-2', conversationId: data.conversationId };
      },
    },
    './whatsappService': { normalizePhone: (phone) => phone },
    './messageAuditService': { logStep: async () => {} },
  });

  await service.persistIncomingMessage({
    companyId: 'tenant-a',
    conversationId: 'conversation-2',
    externalMessageId: 'wa-message-3',
    phone: '5511777770000',
    receivedAt: '2026-10-06T12:00:05.000Z',
    remoteJid: '5511777770000@s.whatsapp.net',
    sessionId: 'sales',
    text: 'teste',
    timestamp: '2026-10-01T09:30:00.000Z',
  });

  assert.equal(storedMessage.timestamp, '2026-10-01T09:30:00.000Z');
  assert.equal(storedMessage.createdAt, '2026-10-06T12:00:05.000Z');
  assert.equal(conversationUpdate.updatedAt, '2026-10-06T12:00:05.000Z');
  assert.equal(storedMessage.whatsappMessageId, 'wa-message-3');
  assert.equal(storedMessage.remoteJid, '5511777770000@s.whatsapp.net');
});
