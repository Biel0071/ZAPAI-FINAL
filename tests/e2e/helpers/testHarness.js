'use strict';

/**
 * ZAPFLOW E2E Test Harness
 * 
 * Provides:
 * - Ephemeral HTTP and Socket.IO server runners for opaque-box testing
 * - PostgreSQL pool client and tenant isolation teardown
 * - Canonical session directory filesystem utilities
 * - Mock Baileys socket generator for protocol simulation
 * - Socket.IO client event interception helper
 */

const path = require('path');
const fs = require('fs');
const fsp = require('fs/promises');
const http = require('http');
const crypto = require('crypto');
const { EventEmitter } = require('events');

// Load environment from backend/.env
const backendEnvPath = path.resolve(__dirname, '../../../backend/.env');
if (fs.existsSync(backendEnvPath)) {
  require(path.resolve(__dirname, '../../../backend/node_modules/dotenv')).config({ path: backendEnvPath });
}

// Ensure Dev Auth Bypass is set for test requests unless custom token is passed
process.env.ALLOW_DEV_AUTH_BYPASS = 'true';
process.env.NODE_ENV = 'test';

// Canonical session path
const CANONICAL_SESSIONS_DIR = process.env.WHATSAPP_SESSIONS_DIR || path.resolve(__dirname, '../../../data/sessions');
try {
  fs.mkdirSync(CANONICAL_SESSIONS_DIR, { recursive: true });
} catch (_) {}

// Database setup using backend's pg module
const { Pool } = require(path.resolve(__dirname, '../../../backend/node_modules/pg'));
const connectionString = process.env.DATABASE_URL || 'postgresql://zapai:zapai_password@localhost:5432/zapai_crm';
const pool = new Pool({
  connectionString,
  max: 10,
  idleTimeoutMillis: 5000,
  connectionTimeoutMillis: 5000,
});

async function dbQuery(sql, params = []) {
  return pool.query(sql, params);
}

/**
 * Generate a unique test tenant ID
 */
function createTestTenantId(prefix = 'e2e') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Clean up test data for a given company
 */
async function cleanupTestCompany(companyId) {
  if (!companyId) return;
  try {
    await pool.query('DELETE FROM customer_orders WHERE company_id = $1', [companyId]);
    await pool.query('DELETE FROM quotes WHERE company_id = $1', [companyId]);
    await pool.query('DELETE FROM conversation_sheets WHERE company_id = $1', [companyId]);
    await pool.query('DELETE FROM products WHERE company_id = $1', [companyId]);
    await pool.query('DELETE FROM conversations WHERE company_id = $1', [companyId]);
    await pool.query('DELETE FROM messages WHERE company_id = $1', [companyId]);
    await pool.query('DELETE FROM sessions WHERE company_id = $1', [companyId]);
  } catch (err) {
    console.warn(`[TEST-HARNESS] Cleanup warning for ${companyId}:`, err.message);
  }
}

/**
 * Creates valid mock Baileys auth credentials
 */
function getMockValidCreds(sessionId = 'main', phone = '5511999998888') {
  return {
    noiseKey: {
      private: { type: 'Buffer', data: Array.from(crypto.randomBytes(32)) },
      public: { type: 'Buffer', data: Array.from(crypto.randomBytes(32)) },
    },
    signedIdentityKey: {
      private: { type: 'Buffer', data: Array.from(crypto.randomBytes(32)) },
      public: { type: 'Buffer', data: Array.from(crypto.randomBytes(32)) },
    },
    signedPreKey: {
      keyPair: {
        private: { type: 'Buffer', data: Array.from(crypto.randomBytes(32)) },
        public: { type: 'Buffer', data: Array.from(crypto.randomBytes(32)) },
      },
      signature: { type: 'Buffer', data: Array.from(crypto.randomBytes(64)) },
      keyId: 1,
    },
    registrationId: 12345,
    advSecretKey: 'mock_adv_secret_key',
    processedHistoryMessages: [],
    nextPreKeyId: 1,
    firstUnuploadedPreKeyId: 1,
    accountSettings: { unarchiveChats: false },
    me: {
      id: `${phone}:1@s.whatsapp.net`,
      name: `ZAPFLOW Test Bot (${sessionId})`,
    },
    signalIdentities: [],
    lastAccountSyncTimestamp: Date.now(),
    myAppStateKeyId: 'mock_app_state_key',
  };
}

/**
 * Write mock session credentials to disk in canonical directory
 */
async function writeSessionToDisk(sessionId, credsObject) {
  const sessionDir = path.join(CANONICAL_SESSIONS_DIR, sessionId);
  await fsp.mkdir(sessionDir, { recursive: true });
  const credsPath = path.join(sessionDir, 'creds.json');
  await fsp.writeFile(credsPath, typeof credsObject === 'string' ? credsObject : JSON.stringify(credsObject, null, 2), 'utf8');
  return { sessionDir, credsPath };
}

/**
 * Remove session from disk
 */
async function removeSessionFromDisk(sessionId) {
  const sessionDir = path.join(CANONICAL_SESSIONS_DIR, sessionId);
  try {
    await fsp.rm(sessionDir, { recursive: true, force: true });
  } catch (_) {}
}

/**
 * Mock Baileys socket for isolated protocol testing
 */
function createMockBaileysSocket(options = {}) {
  const emitter = new EventEmitter();
  const sentMessages = [];
  const statusUpdates = [];

  const mockSock = {
    ev: emitter,
    user: options.user || { id: '5511999998888:1@s.whatsapp.net', name: 'ZAPFLOW Bot' },
    authState: {
      creds: getMockValidCreds(options.sessionId || 'mock_session'),
    },
    sentMessages,
    statusUpdates,

    async sendMessage(jid, content, sendOptions = {}) {
      const msgId = `wamid_mock_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const record = { jid, content, sendOptions, id: msgId, timestamp: Date.now() };
      sentMessages.push(record);
      return {
        key: { remoteJid: jid, id: msgId, fromMe: true },
        message: content,
      };
    },

    async getBusinessProfile(jid) {
      if (options.failBusinessProfile) {
        throw new Error('Business profile query unsupported or failed');
      }
      return {
        description: 'ZAPFLOW Official Test Business Store',
        email: 'contato@zapflow.local',
        websites: ['https://zapflow.local'],
        tag: 'Retail & Construction',
      };
    },

    async getOrderDetails(orderId, token) {
      if (options.failOrderDetails) {
        throw new Error('Order IQ details timeout');
      }
      return {
        id: orderId,
        token,
        products: [
          { id: 'prod_mock_1', name: 'Churrasqueira Pré-Moldada Trio', price: 990.0, quantity: 1 },
          { id: 'prod_mock_2', name: 'Tijolo 8 Furos (Milheiro)', price: 720.0, quantity: 2 },
        ],
        price: { total: 2430.0, currency: 'BRL' },
      };
    },

    async end(error) {
      emitter.emit('connection.update', { connection: 'close', lastDisconnect: { error } });
    },
  };

  return mockSock;
}

/**
 * Boot an ephemeral Express + Socket.IO server
 */
async function startTestServer(options = {}) {
  if (process.env.TEST_BASE_URL) {
    return {
      baseUrl: process.env.TEST_BASE_URL,
      server: null,
      io: null,
      close: async () => {},
    };
  }

  const express = require(path.resolve(__dirname, '../../../backend/node_modules/express'));
  const { Server: SocketIOServer } = require(path.resolve(__dirname, '../../../backend/node_modules/socket.io'));
  const { registerRoutes } = require(path.resolve(__dirname, '../../../backend/src/api/routes'));

  const app = express();
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Tenant / Company context middleware for tests
  app.use((req, _res, next) => {
    const tenant = req.headers['x-company-id'] || req.headers['x-tenant-id'] || options.defaultCompanyId || 'default';
    req.authTenantId = tenant;
    req.user = { companyId: tenant, name: 'E2E Tester', role: 'admin' };
    next();
  });

  const server = http.createServer(app);
  const io = new SocketIOServer(server, {
    cors: { origin: '*' },
  });
  app.set('io', io);
  global.io = io;

  // Mount routes
  registerRoutes(app, {
    requireJwtAuth: (req, _res, next) => next(), // dev bypass for opaque tests
    enableAdminMasterRoutes: true,
    enableNodeRegistrationServer: false,
  });

  await new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', (err) => {
      if (err) return reject(err);
      resolve();
    });
  });

  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  return {
    app,
    server,
    io,
    port,
    baseUrl,
    close: async () => {
      await new Promise((resolve) => io.close(resolve));
      await new Promise((resolve) => server.close(resolve));
    },
  };
}

/**
 * Connect a Socket.IO client and return listener helper
 */
async function createSocketClient(baseUrl, companyId = 'default') {
  const { io: Client } = require(path.resolve(__dirname, '../../../frontend-official/node_modules/socket.io-client'));
  const socket = Client(baseUrl, {
    transports: ['websocket', 'polling'],
    forceNew: true,
    auth: { token: 'e2e_test_token' },
  });

  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Socket connection timed out')), 5000);
    socket.on('connect', () => {
      clearTimeout(timer);
      resolve();
    });
    socket.on('connect_error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });

  return {
    socket,
    waitForEvent(eventName, timeoutMs = 4000) {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          reject(new Error(`Timed out waiting for socket event: ${eventName} after ${timeoutMs}ms`));
        }, timeoutMs);

        socket.once(eventName, (data) => {
          clearTimeout(timer);
          resolve(data);
        });
      });
    },
    disconnect() {
      socket.disconnect();
    },
  };
}

/**
 * HTTP Client Helpers
 */
async function apiGet(baseUrl, urlPath, headers = {}) {
  const response = await fetch(`${baseUrl}${urlPath}`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      ...headers,
    },
  });
  let data = null;
  const text = await response.text();
  try {
    data = JSON.parse(text);
  } catch (_) {
    data = text;
  }
  return { status: response.status, ok: response.ok, data };
}

async function apiPost(baseUrl, urlPath, body = {}, headers = {}) {
  const response = await fetch(`${baseUrl}${urlPath}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
  });
  let data = null;
  const text = await response.text();
  try {
    data = JSON.parse(text);
  } catch (_) {
    data = text;
  }
  return { status: response.status, ok: response.ok, data };
}

async function apiPatch(baseUrl, urlPath, body = {}, headers = {}) {
  const response = await fetch(`${baseUrl}${urlPath}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
  });
  let data = null;
  const text = await response.text();
  try {
    data = JSON.parse(text);
  } catch (_) {
    data = text;
  }
  return { status: response.status, ok: response.ok, data };
}

async function apiDelete(baseUrl, urlPath, headers = {}) {
  const response = await fetch(`${baseUrl}${urlPath}`, {
    method: 'DELETE',
    headers: {
      'Accept': 'application/json',
      ...headers,
    },
  });
  let data = null;
  const text = await response.text();
  try {
    data = JSON.parse(text);
  } catch (_) {
    data = text;
  }
  return { status: response.status, ok: response.ok, data };
}

module.exports = {
  CANONICAL_SESSIONS_DIR,
  pool,
  dbQuery,
  createTestTenantId,
  cleanupTestCompany,
  getMockValidCreds,
  writeSessionToDisk,
  removeSessionFromDisk,
  createMockBaileysSocket,
  startTestServer,
  createSocketClient,
  apiGet,
  apiPost,
  apiPatch,
  apiDelete,
};
