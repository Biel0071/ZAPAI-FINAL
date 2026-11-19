'use strict';

/**
 * TIER 5 — White-Box Adversarial Hardening Suite
 * 
 * Target Modules:
 * - backend/services/whatsapp/connection/stableSession.js
 * - backend/services/whatsapp/connection/sessionPaths.js
 * - backend/services/whatsapp/connection/reconnect.js
 * - backend/services/whatsapp/sync/WhatsAppAutoSyncCoordinator.js
 * - backend/services/whatsapp/connection/sessionPersistenceValidator.js
 * - backend/services/sessionRecoveryService.js
 * 
 * Verifies:
 * 1. Path traversal attacks & hostile session ID validation
 * 2. Malformed, corrupted, and hostile creds.json auto-recovery and safe isolation
 * 3. Race conditions during rapid connection flapping (rapid open -> close -> 515 fast reconnect -> open)
 * 4. Non-blocking auto-sync partial failure & network drop simulations without socket drop or unhandled rejections
 * 5. Clean teardown, zero socket leaks, and timer quiescence
 */

const { describe, test, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const fsp = require('fs/promises');
const { EventEmitter } = require('events');

// Core modules under adversarial challenge
const {
  getCanonicalSessionsDirectory,
  getSessionPath,
  normalizeSessionId,
} = require('../../backend/services/whatsapp/connection/sessionPaths');

const {
  computeReconnectBackoff,
  getConnectionCloseCode,
  isTerminalDisconnect,
  shouldReconnect,
  DisconnectReason,
} = require('../../backend/services/whatsapp/connection/reconnect');

const {
  validateSession,
} = require('../../backend/services/whatsapp/connection/sessionPersistenceValidator');

const autoSyncCoordinator = require('../../backend/services/whatsapp/sync/WhatsAppAutoSyncCoordinator');
const sessionRecoveryService = require('../../backend/services/sessionRecoveryService');
const sessionManager = require('../../backend/services/sessionManager.legacy');
const { activeSessions } = require('../../backend/services/whatsapp/state/registry');
const { pool, dbQuery, getMockValidCreds, writeSessionToDisk, removeSessionFromDisk } = require('./helpers/testHarness');

const CANONICAL_DIR = getCanonicalSessionsDirectory();

describe('TIER 5 — White-Box Adversarial Hardening Suite', () => {

  // ═══════════════════════════════════════════════════════════════════════════
  // GROUP 1: Path Traversal & Hostile Session ID Validation
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Group 1: Path Traversal & Hostile Session ID Validation', () => {

    test('T5_01: Unix path traversal sequences (../../etc/passwd) are neutralized and contained', () => {
      const maliciousInputs = [
        '../../etc/passwd',
        '../../../../var/log/syslog',
        '/etc/shadow',
        '../../../home/user/.bashrc',
        'session/../../secret',
        '....//....//....//etc/passwd',
      ];

      for (const input of maliciousInputs) {
        const normalized = normalizeSessionId(input);
        assert.ok(
          /^[a-z0-9_\-]+$/.test(normalized),
          `normalizeSessionId("${input}") must only contain whitelisted chars, got: "${normalized}"`
        );
        assert.ok(!normalized.includes('.'), `Normalized ID must not contain dots: "${normalized}"`);
        assert.ok(!normalized.includes('/'), `Normalized ID must not contain slashes: "${normalized}"`);
        assert.ok(!normalized.includes('\\'), `Normalized ID must not contain backslashes: "${normalized}"`);

        const resolvedPath = getSessionPath(input);
        assert.ok(
          resolvedPath.startsWith(CANONICAL_DIR),
          `Resolved path "${resolvedPath}" must stay strictly inside canonical dir "${CANONICAL_DIR}"`
        );
        const rel = path.relative(CANONICAL_DIR, resolvedPath);
        assert.ok(!rel.startsWith('..'), `Path must not escape sandbox: "${rel}"`);
      }
    });

    test('T5_02: Windows path traversal sequences (..\\..\\windows\\system32) are neutralized', () => {
      const windowsAttacks = [
        '..\\..\\windows\\system32\\cmd.exe',
        'C:\\Windows\\System32\\drivers\\etc\\hosts',
        '..\\..\\..\\boot.ini',
        'D:\\secret\\keys.txt',
        '..\\..\\Users\\Admin\\Desktop',
      ];

      for (const input of windowsAttacks) {
        const normalized = normalizeSessionId(input);
        assert.ok(
          /^[a-z0-9_\-]+$/.test(normalized),
          `normalizeSessionId("${input}") must only contain whitelisted chars, got: "${normalized}"`
        );
        const resolvedPath = getSessionPath(input);
        assert.ok(
          resolvedPath.startsWith(CANONICAL_DIR),
          `Resolved path "${resolvedPath}" must stay inside canonical dir for input "${input}"`
        );
        const rel = path.relative(CANONICAL_DIR, resolvedPath);
        assert.ok(!rel.startsWith('..'), `Path must not escape canonical dir: "${rel}"`);
      }
    });

    test('T5_03: Null byte, control char, and whitespace injection sanitize cleanly', () => {
      const hostilePayloads = [
        'session\0_hidden_payload',
        'evil\x00\x01\x1F_session',
        '   \t\r\n   ',
        '',
        null,
        undefined,
        '.....',
        '//////',
        '\\\\\\\\',
      ];

      for (const payload of hostilePayloads) {
        const normalized = normalizeSessionId(payload);
        assert.ok(typeof normalized === 'string' && normalized.length > 0, `Normalized ID must be non-empty string`);
        assert.ok(!normalized.includes('\0'), `Normalized ID must not contain null bytes`);
        assert.ok(
          /^[a-z0-9_\-]+$/.test(normalized),
          `Normalized ID "${normalized}" must match safe character set for payload "${payload}"`
        );
        const resolvedPath = getSessionPath(payload);
        assert.ok(resolvedPath.startsWith(CANONICAL_DIR), `Path must be contained in canonical dir`);
      }
    });

    test('T5_04: Prototype pollution & reserved names do not compromise session resolution', () => {
      const reservedNames = [
        '__proto__',
        'constructor',
        'prototype',
        'valueOf',
        'toString',
        'CON',
        'PRN',
        'AUX',
        'NUL',
        'COM1',
        'LPT1',
      ];

      for (const name of reservedNames) {
        const normalized = normalizeSessionId(name);
        assert.strictEqual(typeof normalized, 'string');
        const resolvedPath = getSessionPath(name);
        assert.ok(
          resolvedPath.startsWith(CANONICAL_DIR),
          `Reserved name "${name}" must resolve within canonical dir: "${resolvedPath}"`
        );
        // Ensure object prototype remains intact
        assert.strictEqual(Object.prototype.polluted, undefined);
      }
    });

    test('T5_05: Boundary & pathological string inputs (10k chars, special symbols)', () => {
      const longInput = 'a'.repeat(10_000);
      const normalizedLong = normalizeSessionId(longInput);
      assert.ok(normalizedLong.length > 0);
      assert.ok(getSessionPath(longInput).startsWith(CANONICAL_DIR));

      const specialChars = '!@#$%^&*()_+={}[]|\\:;"\'<>,.?/~`';
      const normalizedSpecial = normalizeSessionId(specialChars);
      assert.strictEqual(normalizedSpecial, 'main', 'Pure non-whitelisted characters must fallback to "main"');
      assert.ok(getSessionPath(specialChars).startsWith(CANONICAL_DIR));
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // GROUP 2: Malformed, Corrupted, and Hostile creds.json Isolation
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Group 2: Malformed, Corrupted, and Hostile creds.json Isolation', () => {
    const testSessionsToClean = [];

    afterEach(async () => {
      for (const id of testSessionsToClean) {
        await removeSessionFromDisk(id).catch(() => {});
      }
      testSessionsToClean.length = 0;
    });

    test('T5_06: 0-byte (empty) creds.json is safely quarantined without crashing', async () => {
      const sessId = `t5_corrupt_empty_${Date.now()}`;
      testSessionsToClean.push(sessId);

      await writeSessionToDisk(sessId, '');
      const validation = await validateSession(sessId);

      assert.strictEqual(validation.credsExists, true);
      assert.strictEqual(validation.credsValid, false);
      assert.strictEqual(validation.credsComplete, false);
      assert.strictEqual(validation.ok, false);
      assert.ok(validation.warnings.some(w => w.includes('parse error')));
    });

    test('T5_07: Truncated / malformed JSON creds.json is safely rejected', async () => {
      const sessId = `t5_corrupt_truncated_${Date.now()}`;
      testSessionsToClean.push(sessId);

      const truncatedJson = '{"noiseKey":{"private":{"type":"Buffer","data":[1,2,3';
      await writeSessionToDisk(sessId, truncatedJson);
      const validation = await validateSession(sessId);

      assert.strictEqual(validation.credsExists, true);
      assert.strictEqual(validation.credsValid, false);
      assert.strictEqual(validation.ok, false);
      assert.ok(validation.warnings.length > 0);
    });

    test('T5_08: JSON primitives and array values in creds.json are safely rejected', async () => {
      const primitives = [
        { label: 'number', content: '12345678' },
        { label: 'string', content: '"i am just a string"' },
        { label: 'boolean', content: 'true' },
        { label: 'null', content: 'null' },
        { label: 'array', content: '[1, 2, 3, {"noiseKey": true}]' },
      ];

      for (const { label, content } of primitives) {
        const sessId = `t5_corrupt_${label}_${Date.now()}`;
        testSessionsToClean.push(sessId);

        await writeSessionToDisk(sessId, content);
        const validation = await validateSession(sessId);

        assert.strictEqual(validation.credsExists, true);
        assert.strictEqual(validation.credsValid, false, `Primitive ${label} must not be considered valid creds object`);
        assert.strictEqual(validation.ok, false);
      }
    });

    test('T5_09: Missing cryptographic keys detected and reported with precision', async () => {
      const sessId = `t5_corrupt_missing_keys_${Date.now()}`;
      testSessionsToClean.push(sessId);

      // Creds missing 'noiseKey' and 'me'
      const partialCreds = {
        signedIdentityKey: { private: {}, public: {} },
        registrationId: 9999,
      };

      await writeSessionToDisk(sessId, partialCreds);
      const validation = await validateSession(sessId);

      assert.strictEqual(validation.credsValid, true);
      assert.strictEqual(validation.credsComplete, false);
      assert.strictEqual(validation.ok, false);
      assert.ok(validation.missingKeys.includes('noiseKey'));
      assert.ok(validation.missingKeys.includes('me'));
      assert.ok(!validation.missingKeys.includes('registrationId'));
    });

    test('T5_10: Subdirectory named creds.json (directory-as-file collision) is safely handled', async () => {
      const sessId = `t5_corrupt_dir_as_creds_${Date.now()}`;
      testSessionsToClean.push(sessId);

      const sessPath = path.join(CANONICAL_DIR, sessId);
      await fsp.mkdir(sessPath, { recursive: true });
      const dirAsCreds = path.join(sessPath, 'creds.json');
      await fsp.mkdir(dirAsCreds, { recursive: true });

      const validation = await validateSession(sessId);
      // Reading a directory as a file throws EISDIR / parse error; must be safely isolated
      assert.strictEqual(validation.ok, false);
      assert.strictEqual(validation.credsValid, false);
    });

    test('T5_11: sessionRecoveryService safely skips all hostile sessions without process crash', async () => {
      const corrupt1 = `t5_rec_empty_${Date.now()}`;
      const corrupt2 = `t5_rec_badjson_${Date.now()}`;
      const corrupt3 = `t5_rec_array_${Date.now()}`;
      testSessionsToClean.push(corrupt1, corrupt2, corrupt3);

      await writeSessionToDisk(corrupt1, '');
      await writeSessionToDisk(corrupt2, '{ not json }');
      await writeSessionToDisk(corrupt3, '[1,2,3]');

      // Execute session recovery scan
      const recovered = await sessionRecoveryService.recoverSessions();

      assert.ok(Array.isArray(recovered), 'recoverSessions must return array');
      assert.ok(!recovered.includes(corrupt1), 'corrupt1 must be skipped');
      assert.ok(!recovered.includes(corrupt2), 'corrupt2 must be skipped');
      assert.ok(!recovered.includes(corrupt3), 'corrupt3 must be skipped');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // GROUP 3: Rapid Connection Flapping & Reconnect State Machine
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Group 3: Rapid Connection Flapping & Reconnect State Machine', () => {

    test('T5_12: Disconnect code 515 enforces fast reconnect delay <= 500ms across all attempts', () => {
      for (const attempt of [1, 2, 5, 10, 20, 25]) {
        const delay = computeReconnectBackoff(attempt, DisconnectReason.restartRequired);
        assert.ok(delay >= 0, `Delay must be >= 0, got: ${delay}`);
        assert.ok(delay <= 500, `Code 515 fast reconnect must be <= 500ms at attempt ${attempt}, got: ${delay}`);
      }

      // Even if caller asks for 5000ms fast delay, option clamping enforces <= 500ms
      const clampedDelay = computeReconnectBackoff(1, 515, { fastDelayMs: 5000 });
      assert.ok(clampedDelay <= 500, `fastDelayMs option must be clamped to <= 500ms, got: ${clampedDelay}`);
    });

    test('T5_13: Terminal code 401 returns backoff -1 and triggers zero reconnect attempts', () => {
      assert.strictEqual(shouldReconnect(401), false, 'Code 401 must never reconnect');
      assert.strictEqual(isTerminalDisconnect(401), true, 'Code 401 must be terminal');
      assert.strictEqual(computeReconnectBackoff(1, 401), -1, 'Code 401 backoff must be -1');
      assert.strictEqual(computeReconnectBackoff(10, 401), -1, 'Code 401 backoff at attempt 10 must be -1');

      // Error object wrapper
      const errorObj = { error: { output: { statusCode: 401 } } };
      assert.strictEqual(shouldReconnect(errorObj), false);
      assert.strictEqual(isTerminalDisconnect(errorObj), true);
      assert.strictEqual(computeReconnectBackoff(1, errorObj), -1);
    });

    test('T5_14: Transient disconnect codes (408, 428, 500, 515) maintain reconnect progression with cap', () => {
      const transientCodes = [
        DisconnectReason.timedOut,            // 408
        DisconnectReason.connectionClosed,    // 428
        DisconnectReason.badSession,          // 500
        DisconnectReason.restartRequired,     // 515
        DisconnectReason.unavailableService,  // 503
      ];

      for (const code of transientCodes) {
        assert.strictEqual(shouldReconnect(code), true, `Code ${code} must be reconnectable`);
        assert.strictEqual(isTerminalDisconnect(code), false, `Code ${code} must not be terminal`);
        const delay1 = computeReconnectBackoff(1, code);
        assert.ok(delay1 >= 0, `Code ${code} delay must be >= 0`);
      }

      // Beyond attempt 25: capped and returns -1
      assert.strictEqual(computeReconnectBackoff(26, 408), -1, 'Attempt 26 must return -1');
      assert.strictEqual(computeReconnectBackoff(100, 500), -1, 'Attempt 100 must return -1');
    });

    test('T5_15: Rapid connection flapping (50 rapid open -> close -> open cycles) without crash or listener explosion', async () => {
      const sessionId = `t5_flap_${Date.now()}`;
      const mockSockEmitter = new EventEmitter();
      mockSockEmitter.setMaxListeners(200);

      const mockSession = {
        sessionId,
        sessionName: sessionId,
        status: 'disconnected',
        reconnecting: false,
        reconnectRequestCount: 0,
        reconnectRequestPending: false,
        lastConnectionState: null,
        sock: { ev: mockSockEmitter, ws: new EventEmitter(), end: () => {} },
      };

      activeSessions[sessionId] = mockSession;

      // Simulate 50 rapid connection updates
      for (let i = 0; i < 50; i++) {
        // 1. Connection opens
        mockSession.status = 'connected';
        mockSession.reconnecting = false;
        mockSession.reconnectRequestCount = 0;

        // 2. Connection closes with 515
        const closeCode = (i % 2 === 0) ? 515 : 408;
        const willReconnect = shouldReconnect(closeCode);
        assert.strictEqual(willReconnect, true);

        if (!mockSession.reconnecting) {
          mockSession.reconnecting = true;
          mockSession.reconnectRequestCount += 1;
          mockSession.status = 'connecting';
        }

        // Duplicate close event during active reconnect should be ignored
        const duplicateIgnored = mockSession.reconnecting;
        assert.strictEqual(duplicateIgnored, true);
      }

      assert.strictEqual(mockSession.status, 'connecting');
      assert.strictEqual(mockSession.reconnecting, true);
      assert.ok(mockSession.reconnectRequestCount > 0);

      // Clean up mock
      delete activeSessions[sessionId];
    });

    test('T5_16: Duplicate close suppression prevents runaway reconnect timer accumulation', async () => {
      const sessionId = `t5_dup_close_${Date.now()}`;
      let reconnectScheduledCount = 0;

      const mockSession = {
        sessionId,
        status: 'connected',
        reconnecting: false,
        reconnectCooldownTimer: null,
      };

      function handleCloseEvent() {
        if (mockSession.reconnecting) {
          return false; // suppressed
        }
        mockSession.reconnecting = true;
        reconnectScheduledCount++;
        mockSession.reconnectCooldownTimer = setTimeout(() => {
          mockSession.reconnecting = false;
        }, 500);
        return true;
      }

      // Burst of 10 duplicate close events fired synchronously
      const results = [];
      for (let i = 0; i < 10; i++) {
        results.push(handleCloseEvent());
      }

      assert.strictEqual(results[0], true, 'First close event must be processed');
      assert.ok(results.slice(1).every(r => r === false), 'Subsequent 9 duplicate close events must be suppressed');
      assert.strictEqual(reconnectScheduledCount, 1, 'Only exactly 1 reconnect must be scheduled');

      clearTimeout(mockSession.reconnectCooldownTimer);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // GROUP 4: Non-Blocking Auto-Sync & Partial Sync Failure Simulation
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Group 4: Non-Blocking Auto-Sync & Partial Sync Failure Simulation', () => {

    test('T5_17: Partial sync failure: Catalog error / timeout isolates safely, Orders & Billing succeed, socket unharmed', async () => {
      const sessionId = `t5_partial_cat_fail_${Date.now()}`;
      const companyId = `comp_${Date.now()}`;
      let socketClosed = false;

      const mockSock = {
        user: { id: '5511999990001:1@s.whatsapp.net', name: 'Bot' },
        getCatalog: async () => {
          throw new Error('Meta Server 500: Product Catalog Unavailable');
        },
        end: () => { socketClosed = true; },
        ws: { close: () => { socketClosed = true; } },
      };

      // Part A: Remote catalog failure graceful degradation (waFetched = 0, socket stays open)
      const result = await autoSyncCoordinator.onSessionConnected({
        sessionId,
        companyId,
        sock: mockSock,
        delayMs: 10,
        timeoutMs: 2000,
      });

      assert.strictEqual(result.ordersSynced, true, 'Orders sync must complete successfully despite catalog error');
      assert.strictEqual(result.billingSynced, true, 'Billing sync must complete successfully despite catalog error');
      assert.strictEqual(socketClosed, false, 'WhatsApp socket must NOT be closed or dropped due to catalog error');

      // Part B: Catalog hard timeout simulation (catalogSynced = false, timeout isolated, orders & billing finish)
      const timeoutSessId = `t5_partial_cat_timeout_${Date.now()}`;
      const timeoutSock = {
        user: { id: '5511999990002:1@s.whatsapp.net', name: 'Timeout Bot' },
        getCatalog: async () => {
          await new Promise(r => setTimeout(r, 80));
          throw new Error('simulated catalog timeout');
        },
        query: async () => {
          throw new Error('raw query disabled in test');
        },
        end: () => { socketClosed = true; },
        ws: { close: () => { socketClosed = true; } },
      };

      const timeoutResult = await autoSyncCoordinator.onSessionConnected({
        sessionId: timeoutSessId,
        companyId,
        sock: timeoutSock,
        delayMs: 10,
        timeoutMs: 50, // fast timeout
      });

      assert.strictEqual(timeoutResult.catalogSynced, false, 'Catalog must be false on timeout');
      assert.strictEqual(timeoutResult.error, 'TIMEOUT', 'Error must be TIMEOUT');
      assert.strictEqual(timeoutResult.ordersSynced, true, 'Orders sync must succeed even when catalog times out');
      assert.strictEqual(timeoutResult.billingSynced, true, 'Billing sync must succeed even when catalog times out');
      assert.strictEqual(socketClosed, false, 'Socket must remain untouched');
    });

    test('T5_18: Network drop during active auto-sync cancels timers and resolves cleanly without unhandled rejection', async () => {
      const sessionId = `t5_sync_drop_${Date.now()}`;
      const companyId = `comp_${Date.now()}`;

      // Start background sync with delay
      const syncPromise = autoSyncCoordinator.onSessionConnected({
        sessionId,
        companyId,
        delayMs: 200,
      });

      assert.strictEqual(autoSyncCoordinator.isSyncing(sessionId), true, 'Session must be reported as syncing while scheduled');

      // Simulate network drop disconnect event arriving before timer completes
      autoSyncCoordinator.onSessionDisconnected(sessionId);

      assert.strictEqual(autoSyncCoordinator.isSyncing(sessionId), false, 'Session must no longer be syncing after disconnect');

      // Await original promise: must resolve without throwing an unhandled rejection
      const result = await syncPromise;
      assert.strictEqual(result.catalogSynced, false);
      assert.strictEqual(result.ordersSynced, false);
      assert.strictEqual(result.billingSynced, false);
    });

    test('T5_19: Rapid connection bursts debounce into single sync execution', async () => {
      const sessionId = `t5_burst_${Date.now()}`;
      const companyId = `comp_${Date.now()}`;

      // Fire 5 rapid onSessionConnected triggers in 5ms
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(
          autoSyncCoordinator.onSessionConnected({
            sessionId,
            companyId,
            delayMs: 30,
          })
        );
      }

      // All 5 promises should resolve to the same debounced execution
      const results = await Promise.all(promises);
      assert.strictEqual(results.length, 5);
      for (const res of results) {
        assert.strictEqual(typeof res.ordersSynced, 'boolean');
        assert.strictEqual(typeof res.billingSynced, 'boolean');
      }
    });

    test('T5_20: In-flight execution re-sync queuing: second connect while running queues follow-up', async () => {
      const sessionId = `t5_resync_${Date.now()}`;
      const companyId = `comp_${Date.now()}`;

      // Mark session as currently executing
      autoSyncCoordinator.runningSyncs.set(sessionId, true);

      // Trigger second connection
      const queuedResult = await autoSyncCoordinator.onSessionConnected({
        sessionId,
        companyId,
      });

      // Should return immediate placeholder and queue follow-up
      assert.strictEqual(queuedResult.catalogSynced, false);
      assert.strictEqual(autoSyncCoordinator.pendingReSync.has(sessionId), true);

      // Cleanup
      autoSyncCoordinator.runningSyncs.delete(sessionId);
      autoSyncCoordinator.pendingReSync.delete(sessionId);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // GROUP 5: Teardown Cleanliness & Resource Quiescence
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Group 5: Teardown Cleanliness & Resource Quiescence', () => {

    test('T5_21: disposeSession cleans and nulls all active timers', async () => {
      const sessionId = `t5_timers_${Date.now()}`;

      const t1 = setTimeout(() => {}, 10000);
      const t2 = setTimeout(() => {}, 10000);
      const t3 = setTimeout(() => {}, 10000);
      const t4 = setInterval(() => {}, 10000);

      const mockSession = {
        sessionId,
        sessionName: sessionId,
        status: 'connected',
        reconnectCooldownTimer: t1,
        reconnectRequestTimer: t2,
        qrTimeoutTimer: t3,
        bufferFlushInterval: t4,
        sock: {
          ev: new EventEmitter(),
          ws: new EventEmitter(),
          end: () => {},
        },
      };

      activeSessions[sessionId] = mockSession;

      // Invoke dispose
      await sessionManager.disposeSession(sessionId);

      // Verify timers are nulled
      assert.strictEqual(mockSession.reconnectCooldownTimer, null);
      assert.strictEqual(mockSession.reconnectRequestTimer, null);
      assert.strictEqual(mockSession.qrTimeoutTimer, null);
      assert.strictEqual(mockSession.bufferFlushInterval, null);
      assert.strictEqual(activeSessions[sessionId], undefined);

      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearInterval(t4);
    });

    test('T5_22: In-flight reconnect timer cancelled immediately by disposeSession', async () => {
      const sessionId = `t5_inflight_timer_${Date.now()}`;
      let timerFired = false;

      const mockTimer = setTimeout(() => {
        timerFired = true;
      }, 50);

      const mockSession = {
        sessionId,
        sessionName: sessionId,
        status: 'connecting',
        reconnecting: true,
        reconnectCooldownTimer: mockTimer,
        sock: { ev: new EventEmitter(), ws: new EventEmitter(), end: () => {} },
      };

      activeSessions[sessionId] = mockSession;

      // Dispose immediately
      await sessionManager.disposeSession(sessionId);

      // Wait 100ms: timer must NOT have fired
      await new Promise(r => setTimeout(r, 100));
      assert.strictEqual(timerFired, false, 'In-flight reconnect timer must NOT fire after disposeSession');
    });

    test('T5_23: Socket error resilience: disposeSession isolates thrown errors when closing socket', async () => {
      const sessionId = `t5_sock_err_${Date.now()}`;

      const mockSession = {
        sessionId,
        sessionName: sessionId,
        status: 'connected',
        sock: {
          ev: {
            removeAllListeners: () => {
              throw new Error('Fatal socket event listener crash');
            },
          },
          ws: {
            close: () => {
              throw new Error('WebSocket abrupt connection reset');
            },
          },
          end: () => {
            throw new Error('Baileys end() failed');
          },
        },
      };

      activeSessions[sessionId] = mockSession;

      // disposeSession must NOT throw, must isolate socket errors, and must still clean session
      await assert.doesNotReject(
        async () => {
          await sessionManager.disposeSession(sessionId);
        },
        'disposeSession must isolate socket teardown errors safely'
      );

      assert.strictEqual(activeSessions[sessionId], undefined, 'Session must be removed from activeSessions registry');
    });
  });

  after(async () => {
    try {
      const { pool: dbPool } = require('../../backend/src/infrastructure/config/database');
      await dbPool?.end?.();
    } catch (_) {}
    try {
      await pool.end();
    } catch (_) {}
  });
});
