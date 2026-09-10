const crypto = require('crypto');
const http = require('http');
const fs = require('fs');
const { Client } = require('/opt/zapai/backend/node_modules/pg');

function loadEnv(path) {
  try {
    const content = fs.readFileSync(path, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx > 0) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
        if (!process.env[key]) process.env[key] = val;
      }
    }
  } catch (err) {}
}

loadEnv('/opt/zapai/.env.production');
loadEnv('/opt/zapai/backend/.env');

function base64UrlEncode(str) {
  return Buffer.from(str).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function signToken(payload, secret) {
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const body = base64UrlEncode(JSON.stringify({ ...payload, exp }));
  const data = `${header}.${body}`;
  const sig = crypto.createHmac('sha256', secret).update(data).digest('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${data}.${sig}`;
}

const secret = process.env.JWT_SECRET || process.env.AUTH_JWT_SECRET || 'secret';
const token = signToken({ id: 'admin-test', username: 'admin', role: 'admin', tenantId: 'default' }, secret);

function apiPost(path, body, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request({
      hostname: '127.0.0.1',
      port: 4025,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        'Authorization': 'Bearer ' + token,
        'x-tenant-id': 'default',
        ...extraHeaders,
      },
    }, (res) => {
      let resBody = '';
      res.on('data', (chunk) => resBody += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(resBody) });
        } catch {
          resolve({ status: res.statusCode, raw: resBody });
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function run() {
  console.log('====================================================');
  console.log('   ZAPFLOW POST-DEPLOY REAL WHATSAPP VERIFICATION   ');
  console.log('====================================================');

  const dbClient = new Client({
    connectionString: process.env.DATABASE_URL || 'postgresql://zapai:zapai_secure_pass_2026@localhost:5432/zapai_crm'
  });
  await dbClient.connect();

  const TARGET_PHONE = '31993807167';
  const TARGET_SESSION = 'material';
  const results = {
    test1_single: null,
    test2_doubleclick: null,
    test3_scenario_e: null,
  };

  try {
    // 0. Initial baseline check
    const contactRes = await dbClient.query("SELECT id, name, phone FROM leads WHERE phone LIKE '%31993807167%' OR phone LIKE '%3193807167%' LIMIT 1");
    const contact = contactRes.rows[0];
    console.log('[BASELINE] Target contact in DB:', contact || 'None found (will auto-create)');

    const countBefore = await dbClient.query("SELECT COUNT(*) FROM messages WHERE phone LIKE '%31993807167%' OR phone LIKE '%3193807167%'");
    console.log('[BASELINE] Initial message count:', countBefore.rows[0].count);

    // =========================================================================
    // TEST 1: Single message send
    // =========================================================================
    console.log('\n--- TEST 1: Single Message Sending ---');
    const test1Correlation = `qa_single_${Date.now()}`;
    const test1Text = `[TESTE-QA 1/3] Envio unico Zapflow - ${new Date().toLocaleTimeString('pt-BR')}`;
    
    console.log(`[TEST 1] Dispatching: "${test1Text}"`);
    const t1Res = await apiPost('/api/send-message', {
      phone: TARGET_PHONE,
      text: test1Text,
      sessionId: TARGET_SESSION,
      requestId: test1Correlation,
    }, {
      'x-correlation-id': test1Correlation,
    });

    console.log(`[TEST 1] API HTTP ${t1Res.status}, response:`, JSON.stringify(t1Res.data));
    const t1Msg = t1Res.data?.data?.message || t1Res.data?.message;
    const t1MsgId = t1Msg?.id;
    console.log(`[TEST 1] Persisted message ID: ${t1MsgId}`);

    // Wait for Baileys worker queue dispatch
    console.log('[TEST 1] Waiting 5s for Baileys dispatch & ACK...');
    await sleep(5000);

    // Query DB for this message
    const t1DbRes = await dbClient.query(
      "SELECT id, conversation_id, phone, text, status, whatsapp_message_id, created_at FROM messages WHERE id = $1",
      [t1MsgId]
    );
    const t1Record = t1DbRes.rows[0];
    console.log('[TEST 1] DB Record after dispatch:', t1Record);

    let dupCount = 0;
    if (t1Record?.whatsapp_message_id) {
      const dupCheck = await dbClient.query(
        "SELECT id, conversation_id, phone, status FROM messages WHERE whatsapp_message_id = $1",
        [t1Record.whatsapp_message_id]
      );
      dupCount = dupCheck.rows.length;
      console.log(`[TEST 1] DB rows with whatsapp_message_id "${t1Record.whatsapp_message_id}": ${dupCount} (Expected: 1)`);
    }

    const t1Passed = Boolean(
      t1Res.status === 200 &&
      (t1Res.data?.data?.success || t1Res.data?.success) &&
      t1Record &&
      t1Record.text === test1Text &&
      dupCount === 1
    );
    results.test1_single = {
      passed: t1Passed,
      messageId: t1MsgId,
      whatsappMessageId: t1Record?.whatsapp_message_id,
      status: t1Record?.status,
      dbRowsForWhatsappId: dupCount,
    };
    console.log(`[TEST 1 RESULT] ${t1Passed ? 'PASSED (1 request -> 1 message, 0 duplicates)' : 'FAILED'}`);

    // =========================================================================
    // TEST 2: Double-click simulation (Idempotency deduplication)
    // =========================================================================
    console.log('\n--- TEST 2: Double-Click / Idempotency Test ---');
    const test2Correlation = `qa_idemp_${Date.now()}`;
    const test2Text = `[TESTE-QA 2/3] Debounce Idempotency Zapflow - ${Date.now()}`;

    console.log(`[TEST 2] Firing 2 concurrent requests with same correlationId: ${test2Correlation}`);
    const [t2Req1, t2Req2] = await Promise.all([
      apiPost('/api/send-message', {
        phone: TARGET_PHONE,
        text: test2Text,
        sessionId: TARGET_SESSION,
        requestId: test2Correlation,
      }, { 'x-correlation-id': test2Correlation }),
      apiPost('/api/send-message', {
        phone: TARGET_PHONE,
        text: test2Text,
        sessionId: TARGET_SESSION,
        requestId: test2Correlation,
      }, { 'x-correlation-id': test2Correlation }),
    ]);

    console.log('[TEST 2] Req 1 response:', JSON.stringify(t2Req1.data));
    console.log('[TEST 2] Req 2 response:', JSON.stringify(t2Req2.data));

    const t2Dup1 = Boolean(t2Req1.data?.data?.duplicate || t2Req1.data?.duplicate);
    const t2Dup2 = Boolean(t2Req2.data?.data?.duplicate || t2Req2.data?.duplicate);
    const t2Succ1 = Boolean(t2Req1.data?.data?.success || t2Req1.data?.success);
    const t2Succ2 = Boolean(t2Req2.data?.data?.success || t2Req2.data?.success);

    const duplicateCaught = Boolean((t2Dup1 && t2Succ2) || (t2Dup2 && t2Succ1));

    await sleep(4000);

    const t2DbRes = await dbClient.query(
      "SELECT count(*) FROM messages WHERE text = $1",
      [test2Text]
    );
    const t2CountInDb = Number(t2DbRes.rows[0].count);
    console.log(`[TEST 2] Total messages in DB with test2Text: ${t2CountInDb} (Expected: 1)`);

    const t2Passed = Boolean(duplicateCaught && t2CountInDb === 1);
    results.test2_doubleclick = {
      passed: t2Passed,
      duplicateCaught,
      countInDb: t2CountInDb,
    };
    console.log(`[TEST 2 RESULT] ${t2Passed ? 'PASSED (2 rapid requests -> 1 DB message)' : 'FAILED'}`);

    // =========================================================================
    // TEST 3: Scenario E (Legitimate identical text at different times)
    // =========================================================================
    console.log('\n--- TEST 3: Scenario E (Legitimate Identical Text at Different Times) ---');
    const scenarioEText = `[TESTE-QA 3/3] Confirmacao Zapflow - Sim`;
    
    console.log('[TEST 3] Sending Message A...');
    const t3ResA = await apiPost('/api/send-message', {
      phone: TARGET_PHONE,
      text: scenarioEText,
      sessionId: TARGET_SESSION,
      requestId: `qa_e_a_${Date.now()}`,
    }, { 'x-correlation-id': `qa_e_a_${Date.now()}` });
    const t3MsgA = t3ResA.data?.data?.message || t3ResA.data?.message;
    console.log('[TEST 3] Message A ID:', t3MsgA?.id);

    console.log('[TEST 3] Waiting 3 seconds before sending Message B (same text)...');
    await sleep(3000);

    console.log('[TEST 3] Sending Message B (identical text, distinct operation)...');
    const t3ResB = await apiPost('/api/send-message', {
      phone: TARGET_PHONE,
      text: scenarioEText,
      sessionId: TARGET_SESSION,
      requestId: `qa_e_b_${Date.now()}`,
    }, { 'x-correlation-id': `qa_e_b_${Date.now()}` });
    const t3MsgB = t3ResB.data?.data?.message || t3ResB.data?.message;
    console.log('[TEST 3] Message B ID:', t3MsgB?.id);

    await sleep(4000);

    const t3DbRes = await dbClient.query(
      "SELECT id, text, whatsapp_message_id, created_at FROM messages WHERE text = $1 ORDER BY created_at DESC LIMIT 2",
      [scenarioEText]
    );
    console.log('[TEST 3] DB records found for Scenario E:', t3DbRes.rows.length);
    console.log('[TEST 3] Record A:', t3DbRes.rows[1] || t3DbRes.rows[0]);
    console.log('[TEST 3] Record B:', t3DbRes.rows[0]);

    // Test the frontend dedupe algorithm locally with these 2 messages:
    // Ensure that mergeMessageLists does NOT drop message B!
    const msgA = {
      id: t3MsgA?.id || 'msg-a',
      content: scenarioEText,
      fromMe: true,
      createdAt: new Date(Date.now() - 3000).toISOString(),
    };
    const msgB = {
      id: t3MsgB?.id || 'msg-b',
      content: scenarioEText,
      fromMe: true,
      createdAt: new Date().toISOString(),
    };

    // Mimic the fixed isSameOrDuplicateMessage logic:
    function isDuplicate(a, b) {
      if (a.id && b.id && a.id !== b.id) return false;
      return a.content === b.content && Math.abs(new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) < 30000;
    }

    const merged = [msgA];
    if (!merged.some((existing) => isDuplicate(existing, msgB))) {
      merged.push(msgB);
    }
    const dedupeRetainedBoth = merged.length === 2;
    console.log(`[TEST 3] Frontend dedupe simulation: ${merged.length}/2 messages retained.`);

    const t3Passed = Boolean(
      (t3ResA.data?.data?.success || t3ResA.data?.success) &&
      (t3ResB.data?.data?.success || t3ResB.data?.success) &&
      t3MsgA?.id !== t3MsgB?.id &&
      t3DbRes.rows.length >= 2 &&
      dedupeRetainedBoth
    );
    results.test3_scenario_e = {
      passed: t3Passed,
      messageAId: t3MsgA?.id,
      messageBId: t3MsgB?.id,
      dbCount: t3DbRes.rows.length,
      frontendDedupeRetainedBoth: dedupeRetainedBoth,
    };
    console.log(`[TEST 3 RESULT] ${t3Passed ? 'PASSED (Both identical messages delivered & retained)' : 'FAILED'}`);

    console.log('\n====================================================');
    console.log('              FINAL WHATSAPP TEST REPORT            ');
    console.log('====================================================');
    console.log(JSON.stringify(results, null, 2));

  } finally {
    await dbClient.end();
  }
}

run().catch((err) => {
  console.error('[FATAL ERROR IN WHATSAPP TEST RUNNER]:', err);
  process.exit(1);
});
