#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const { decideMessageAction } = require('../services/automationDecisionEngine');

let io = null;

try {
  ({ io } = require('socket.io-client'));
} catch {
  io = null;
}

const BASE_URL = process.env.BASE_URL || 'http://localhost:4000';
const REQUEST_TIMEOUT_MS = Number(process.env.SMOKE_TIMEOUT_MS || 12000);
const REAL_PHONE = String(process.env.SMOKE_REAL_PHONE || '').trim();
const SMOKE_TENANT_ID = String(process.env.SMOKE_TENANT_ID || process.env.DEFAULT_COMPANY_ID || 'default').trim();
const SMOKE_JWT_SECRET = String(process.env.SMOKE_JWT_SECRET || process.env.JWT_SECRET || '').trim();
const SMOKE_JWT_TOKEN = String(process.env.SMOKE_JWT_TOKEN || '').trim();
const IS_CI_MODE = process.argv.includes('--ci');
const REPORTS_DIR = path.resolve(process.cwd(), 'reports');
const REPORT_FILE = path.join(REPORTS_DIR, 'smoke-report.json');

const results = [];
const scriptStartedAt = Date.now();

function toBase64Url(value) {
  return Buffer.from(value).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function createSmokeJwtToken(secret, tenantId) {
  const now = Math.floor(Date.now() / 1000);
  const header = toBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = toBase64Url(
    JSON.stringify({
      companyId: tenantId,
      exp: now + 60 * 30,
      iat: now,
      tenantId,
    })
  );
  const signature = toBase64Url(
    crypto.createHmac('sha256', secret).update(`${header}.${payload}`).digest()
  );
  return `${header}.${payload}.${signature}`;
}

const AUTH_BEARER_TOKEN =
  SMOKE_JWT_TOKEN || (SMOKE_JWT_SECRET ? createSmokeJwtToken(SMOKE_JWT_SECRET, SMOKE_TENANT_ID) : '');

const AUTH_HEADERS = AUTH_BEARER_TOKEN
  ? {
      authorization: `Bearer ${AUTH_BEARER_TOKEN}`,
      'x-company-id': SMOKE_TENANT_ID,
    }
  : {};

function nowIso() {
  return new Date().toISOString();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function iconForStatus(status) {
  if (status === 'PASS') {
    return '✔';
  }

  if (status === 'FAIL') {
    return '✖';
  }

  return '⚠';
}

function addResult({ name, status, details, durationMs }) {
  results.push({
    name,
    status,
    details,
    durationMs: Number.isFinite(durationMs) ? Math.max(0, durationMs) : 0,
  });
}

function check(condition, name, detailsPass, detailsFail, startedAtMs) {
  const durationMs = Number.isFinite(startedAtMs) ? Date.now() - startedAtMs : 0;

  if (condition) {
    addResult({ name, status: 'PASS', details: detailsPass, durationMs });
    return true;
  }

  addResult({ name, status: 'FAIL', details: detailsFail, durationMs });
  return false;
}

function summarizeResults() {
  const fail = results.filter((item) => item.status === 'FAIL').length;
  const skip = results.filter((item) => item.status === 'SKIP').length;
  const pass = results.filter((item) => item.status === 'PASS').length;

  return { pass, fail, skip };
}

function buildReportPayload() {
  const summary = summarizeResults();

  return {
    timestamp: nowIso(),
    status: summary.fail > 0 ? 'FAIL' : 'PASS',
    summary,
    tests: results.map((item) => ({
      name: item.name,
      status: item.status,
      duration: `${item.durationMs}ms`,
      error: item.status === 'FAIL' ? String(item.details || 'Unknown failure') : null,
    })),
  };
}

async function writeJsonReport() {
  const reportPayload = buildReportPayload();
  await fs.mkdir(REPORTS_DIR, { recursive: true });
  await fs.writeFile(REPORT_FILE, `${JSON.stringify(reportPayload, null, 2)}\n`, 'utf8');
}

function unwrapEnvelope(payload) {
  if (!payload || typeof payload !== 'object') {
    return payload;
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'success') && Object.prototype.hasOwnProperty.call(payload, 'data')) {
    return payload.data;
  }

  return payload;
}

async function requestJson(path, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers: {
        'content-type': 'application/json',
        ...AUTH_HEADERS,
        ...(options.headers || {}),
      },
      signal: controller.signal,
    });

    const text = await response.text();
    let json = null;

    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = { raw: text };
    }

    return {
      ok: response.ok,
      status: response.status,
      body: json,
      data: unwrapEnvelope(json),
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      body: { error: error.message || String(error) },
      data: null,
    };
  } finally {
    clearTimeout(timer);
  }
}

function logHeader() {
  console.log('========================================');
  console.log('STABILIZATION SMOKE TEST');
  console.log('baseUrl:', BASE_URL);
  console.log('authEnabled:', Boolean(AUTH_BEARER_TOKEN));
  console.log('tenantId:', SMOKE_TENANT_ID || 'n/a');
  console.log('startedAt:', nowIso());
  console.log('========================================');
}

async function printResultsAndExit() {
  await writeJsonReport();

  console.log('\n----------- RESULT SUMMARY -----------');
  for (const item of results) {
    console.log(`${iconForStatus(item.status)} ${item.status} ${item.name} (${item.durationMs}ms) -> ${item.details}`);
  }

  const summary = summarizeResults();

  console.log('--------------------------------------');
  console.log(`PASS=${summary.pass} FAIL=${summary.fail} SKIP=${summary.skip}`);
  console.log('finishedAt:', nowIso());
  console.log('durationMs:', Date.now() - scriptStartedAt);
  console.log('reportFile:', REPORT_FILE);

  if (IS_CI_MODE) {
    console.log('ciMode: enabled');
  }

  process.exit(summary.fail > 0 ? 1 : 0);
}

function checkDecisionEngineContract() {
  let startedAtMs = Date.now();
  const greeting = decideMessageAction({ text: 'oi', agent: { name: 'Camila' } });
  check(greeting.action === 'trigger_flow' && greeting.flowKey === 'greeting', 'Decision contract: greeting', JSON.stringify(greeting), JSON.stringify(greeting), startedAtMs);

  startedAtMs = Date.now();
  const price = decideMessageAction({ text: 'quanto custa?', agent: { name: 'Camila' } });
  check(price.action === 'trigger_flow' && price.flowKey === 'price', 'Decision contract: price', JSON.stringify(price), JSON.stringify(price), startedAtMs);

  startedAtMs = Date.now();
  const support = decideMessageAction({ text: 'preciso de suporte', agent: { name: 'Camila' } });
  check(support.action === 'escalate', 'Decision contract: support', JSON.stringify(support), JSON.stringify(support), startedAtMs);

  startedAtMs = Date.now();
  const ack = decideMessageAction({ text: 'ok', agent: { name: 'Camila' } });
  check(ack.action === 'wait', 'Decision contract: acknowledgement', JSON.stringify(ack), JSON.stringify(ack), startedAtMs);
}

async function connectSocketAndCollect() {
  const captured = {
    conversationUpdate: false,
    messageNew: false,
    newMessage: false,
  };

  if (!io) {
    captured.skipped = 'socket.io-client unavailable';
    return {
      socket: { disconnect() {} },
      captured,
    };
  }

  const socket = io(BASE_URL, {
    extraHeaders: {
      ...AUTH_HEADERS,
    },
    reconnection: false,
    timeout: REQUEST_TIMEOUT_MS,
    transports: ['websocket', 'polling'],
  });

  socket.on('connect', () => {
    captured.connected = true;
  });

  socket.on('message:new', () => {
    captured.messageNew = true;
  });

  socket.on('new_message', () => {
    captured.newMessage = true;
  });

  socket.on('conversation:update', () => {
    captured.conversationUpdate = true;
  });

  await sleep(600);

  return {
    socket,
    captured,
  };
}

async function run() {
  logHeader();

  let startedAtMs = Date.now();
  const health = await requestJson('/health');
  check(health.ok, 'API health', `HTTP ${health.status}`, JSON.stringify(health.body), startedAtMs);

  startedAtMs = Date.now();
  const sessionStatusResp = await requestJson('/sessions/status');
  const sessionStatus = sessionStatusResp.data || {};
  check(sessionStatusResp.ok, 'Session status endpoint', `status=${sessionStatus.status || 'unknown'}`, JSON.stringify(sessionStatusResp.body), startedAtMs);

  startedAtMs = Date.now();
  const aiEnable = await requestJson('/ai/enable', { method: 'POST', body: JSON.stringify({ enabled: true }) });
  check(aiEnable.ok, 'AI enable endpoint', `HTTP ${aiEnable.status}`, JSON.stringify(aiEnable.body), startedAtMs);

  startedAtMs = Date.now();
  const conversationsResp = await requestJson('/conversations?limit=15');
  const conversations = Array.isArray(conversationsResp.data) ? conversationsResp.data : [];
  check(conversationsResp.ok, 'Conversations list endpoint', `count=${conversations.length}`, JSON.stringify(conversationsResp.body), startedAtMs);

  const targetPhone =
    REAL_PHONE ||
    (conversations[0] && conversations[0].phone) ||
    `551199999${String(Date.now()).slice(-4)}`;

  const realtime = await connectSocketAndCollect();

  const inboundText = '[SMOKE] inbound stabilization message';
  startedAtMs = Date.now();
  const inbound = await requestJson('/receive-message', {
    method: 'POST',
    body: JSON.stringify({
      phone: targetPhone,
      text: inboundText,
      sessionId: 'main',
      name: 'Smoke Test Contact',
    }),
  });

  check(inbound.ok, 'Receive message endpoint', `HTTP ${inbound.status}`, JSON.stringify(inbound.body), startedAtMs);

  await sleep(1200);
  realtime.socket.disconnect();

  startedAtMs = Date.now();
  if (realtime.captured.skipped) {
    addResult({
      name: 'Realtime message event',
      status: 'SKIP',
      details: realtime.captured.skipped,
      durationMs: Date.now() - startedAtMs,
    });
  } else {
    check(
      realtime.captured.messageNew || realtime.captured.newMessage,
      'Realtime message event',
      JSON.stringify(realtime.captured),
      JSON.stringify(realtime.captured),
      startedAtMs
    );
  }

  startedAtMs = Date.now();
  const conversationsAfterResp = await requestJson('/conversations?limit=50');
  const conversationsAfter = Array.isArray(conversationsAfterResp.data) ? conversationsAfterResp.data : [];
  const targetConversation = conversationsAfter.find((item) => String(item.phone) === String(targetPhone)) || conversationsAfter[0] || null;

  check(Boolean(targetConversation), 'Target conversation resolution', targetConversation ? `conversationId=${targetConversation.id}` : 'none', JSON.stringify(conversationsAfter.slice(0, 3)), startedAtMs);

  if (targetConversation) {
    startedAtMs = Date.now();
    const runtimeBeforeResp = await requestJson(`/conversations/${targetConversation.id}/runtime`);
    const runtimeBefore = runtimeBeforeResp.data?.runtime || runtimeBeforeResp.data || {};
    check(runtimeBeforeResp.ok, 'Conversation runtime fetch', JSON.stringify(runtimeBefore), JSON.stringify(runtimeBeforeResp.body), startedAtMs);

    startedAtMs = Date.now();
    const humanHandoff = await requestJson(`/conversations/${targetConversation.id}/handoff`, {
      method: 'POST',
      body: JSON.stringify({ mode: 'human', timeoutMs: 120000 }),
    });
    check(humanHandoff.ok, 'Handoff to human', `HTTP ${humanHandoff.status}`, JSON.stringify(humanHandoff.body), startedAtMs);

    startedAtMs = Date.now();
    const runtimeHumanResp = await requestJson(`/conversations/${targetConversation.id}/runtime`);
    const runtimeHuman = runtimeHumanResp.data?.runtime || runtimeHumanResp.data || {};
    check(runtimeHuman.controlMode === 'human_active', 'Runtime set to human_active', JSON.stringify(runtimeHuman), JSON.stringify(runtimeHuman), startedAtMs);

    startedAtMs = Date.now();
    const resumeAi = await requestJson(`/conversations/${targetConversation.id}/handoff`, {
      method: 'POST',
      body: JSON.stringify({ mode: 'ai' }),
    });
    check(resumeAi.ok, 'Resume AI handoff', `HTTP ${resumeAi.status}`, JSON.stringify(resumeAi.body), startedAtMs);

    startedAtMs = Date.now();
    const runtimeAiResp = await requestJson(`/conversations/${targetConversation.id}/runtime`);
    const runtimeAi = runtimeAiResp.data?.runtime || runtimeAiResp.data || {};
    check(runtimeAi.controlMode === 'ai_active', 'Runtime set to ai_active', JSON.stringify(runtimeAi), JSON.stringify(runtimeAi), startedAtMs);

    startedAtMs = Date.now();
    const messageListResp = await requestJson(`/conversations/${targetConversation.id}/messages`);
    const messageList = Array.isArray(messageListResp.data) ? messageListResp.data : [];
    check(messageListResp.ok && messageList.length > 0, 'Conversation message persistence', `count=${messageList.length}`, JSON.stringify(messageListResp.body), startedAtMs);
  }

  checkDecisionEngineContract();

  const connected = String(sessionStatus.status || '').toLowerCase() === 'connected' || sessionStatus.connected === true;

  if (!connected) {
    addResult({
      name: 'Live WhatsApp outbound check',
      status: 'SKIP',
      details: 'Session is not connected yet (QR flow).',
      durationMs: 0,
    });
  } else if (!REAL_PHONE) {
    addResult({
      name: 'Live WhatsApp outbound check',
      status: 'SKIP',
      details: 'Set SMOKE_REAL_PHONE to execute real outbound validation.',
      durationMs: 0,
    });
  } else {
    startedAtMs = Date.now();
    const outbound = await requestJson('/send-message', {
      method: 'POST',
      body: JSON.stringify({
        phone: REAL_PHONE,
        text: '[SMOKE] live outbound validation',
        sessionId: 'main',
      }),
    });

    check(outbound.ok, 'Live WhatsApp outbound check', `HTTP ${outbound.status}`, JSON.stringify(outbound.body), startedAtMs);
  }

  await printResultsAndExit();
}

run().catch((error) => {
  addResult({
    name: 'Smoke runner fatal error',
    status: 'FAIL',
    details: error.message || String(error),
    durationMs: 0,
  });

  printResultsAndExit().catch((reportError) => {
    console.error('Failed to write smoke report:', reportError.message || reportError);
    process.exit(1);
  });
});
