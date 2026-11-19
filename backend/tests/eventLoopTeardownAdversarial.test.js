const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');

function runChildNodeScript(codeSnippet, timeoutMs = 6000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const child = spawn(process.execPath, ['-e', codeSnippet], {
      cwd: path.resolve(__dirname, '..', '..'),
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, NODE_ENV: 'test' },
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', d => { stdout += d.toString(); });
    child.stderr.on('data', d => { stderr += d.toString(); });

    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`Child process timed out after ${timeoutMs}ms (Event loop hung!). Stdout: ${stdout}, Stderr: ${stderr}`));
    }, timeoutMs);

    child.on('close', (code, signal) => {
      clearTimeout(timer);
      resolve({
        code,
        signal,
        durationMs: Date.now() - start,
        stdout,
        stderr,
      });
    });

    child.on('error', err => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

test('EVENT LOOP TEARDOWN 1: websocketGateway.js background timers (.unref) allow clean process termination', async () => {
  const code = `
    const gateway = require('./backend/services/websocketGateway');
    const EventEmitter = require('events');
    const io = new EventEmitter();
    io.on = io.addListener;
    io.off = io.removeListener;
    gateway.init(io);
    // Process finishes synchronous execution. If timers were NOT .unref()'d, Node would hang here.
    console.log('WS_INITIALIZED_CLEANLY');
  `;
  const result = await runChildNodeScript(code, 4000);
  assert.equal(result.code, 0, `Process exited with code ${result.code}`);
  assert.ok(result.stdout.includes('WS_INITIALIZED_CLEANLY'), 'Child script reached end of execution');
  assert.ok(result.durationMs < 3000, `Child exited promptly in ${result.durationMs}ms`);
});

test('EVENT LOOP TEARDOWN 2: reactivationService.js 60s background timer is .unref()\'d and allows clean exit', async () => {
  const code = `
    const { closeDatabase } = require('./backend/src/infrastructure/config/database');
    const reactivation = require('./backend/services/reactivationService');
    // Close db pool so only the reactivation setInterval could potentially hang the process
    closeDatabase().then(() => {
      console.log('REACTIVATION_TEST_COMPLETE');
    });
  `;
  const result = await runChildNodeScript(code, 4000);
  assert.equal(result.code, 0, `Process exited with code ${result.code}`);
  assert.ok(result.stdout.includes('REACTIVATION_TEST_COMPLETE'), 'Child script closed database and finished');
  assert.ok(result.durationMs < 3500, `Child exited promptly in ${result.durationMs}ms without waiting for 60s timer`);
});

test('EVENT LOOP TEARDOWN 3: outboundQueueService.js background timers (.unref) do not keep event loop alive', async () => {
  const code = `
    const { closeDatabase } = require('./backend/src/infrastructure/config/database');
    const queue = require('./backend/services/outboundQueueService');
    closeDatabase().then(async () => {
      await queue.initializeOutboundQueue({ store: { databaseEnabled: false } });
      // Queue worker is started with setInterval (1000ms). Because it is .unref()'d, the process must exit now.
      console.log('QUEUE_INITIALIZED_CLEANLY');
    });
  `;
  const result = await runChildNodeScript(code, 4000);
  assert.equal(result.code, 0, `Process exited with code ${result.code}`);
  assert.ok(result.stdout.includes('QUEUE_INITIALIZED_CLEANLY'));
  assert.ok(result.durationMs < 3500, `Child exited promptly in ${result.durationMs}ms`);
});

test('EVENT LOOP TEARDOWN 4: closeDatabase() terminates PostgreSQL pool and is strictly idempotent', async () => {
  const code = `
    const { pool, query, closeDatabase } = require('./backend/src/infrastructure/config/database');
    async function run() {
      // Execute a real query on the pool
      await query('SELECT 1 AS alive');
      assert = require('assert');
      assert.equal(pool.ending, false, 'Pool should be active initially');

      // Call closeDatabase twice in parallel to test idempotency
      await Promise.all([closeDatabase(), closeDatabase()]);
      assert.equal(pool.ending, true, 'Pool should be in ending state');

      // Call a third time sequentially
      await closeDatabase();
      console.log('DATABASE_TEARDOWN_CLEAN');
    }
    run().catch(err => {
      console.error('FAILED:', err);
      process.exit(1);
    });
  `;
  const result = await runChildNodeScript(code, 4000);
  assert.equal(result.code, 0, `Process exited with code ${result.code}`);
  assert.ok(result.stdout.includes('DATABASE_TEARDOWN_CLEAN'), 'Database teardown succeeded idempotently');
  assert.ok(result.durationMs < 3000, `Database pool closed cleanly in ${result.durationMs}ms`);
});
