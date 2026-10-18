'use strict';

const http = require('http');
const crypto = require('crypto');
const path = require('path');
const envPath = path.resolve(__dirname, '../backend/.env');
try {
  require(path.resolve(__dirname, '../backend/node_modules/dotenv')).config({ path: envPath });
} catch (_) {
  require('dotenv').config({ path: envPath });
}

function createToken(payload, secret) {
  const encHeader = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const encPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(`${encHeader}.${encPayload}`).digest('base64url');
  return `${encHeader}.${encPayload}.${sig}`;
}

const secret = process.env.JWT_SECRET || process.env.AUTH_JWT_SECRET || 'zapflow-secret-key-change-in-production';
const token = createToken({
  id: 'admin-1',
  role: 'admin',
  company_id: 'default',
  tenantId: 'default',
  exp: Math.floor(Date.now() / 1000) + 3600,
}, secret);

function fetchUrl(reqPath) {
  return new Promise((resolve, reject) => {
    http.get({
      hostname: '127.0.0.1',
      port: 4025,
      path: reqPath,
      headers: { 'Authorization': 'Bearer ' + token }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    }).on('error', reject);
  });
}

(async () => {
  console.log('=== TEST LIVE EVOLUTION API ON PRODUCTION VPS ===');
  
  // 1. Check conversation-scores endpoint
  const scores = await fetchUrl('/api/ai/evolution/conversation-scores?limit=3');
  console.log('1. GET /api/ai/evolution/conversation-scores -> HTTP', scores.status);
  console.log('Summary:', {
    totalConversations: scores.body.data?.totalConversations,
    totalEarnedXp: scores.body.data?.totalEarnedXp,
    averageScore: scores.body.data?.averageScore,
    totalConversions: scores.body.data?.totalConversions,
    scoresCount: scores.body.data?.scores?.length,
  });
  if (scores.body.data?.scores?.[0]) {
    console.log('Top Scored Conversation:', {
      conversationId: scores.body.data.scores[0].conversationId,
      contactName: scores.body.data.scores[0].contactName,
      algorithm: scores.body.data.scores[0].algorithmCode,
      totalXp: scores.body.data.scores[0].totalXp,
      milestones: scores.body.data.scores[0].breakdown,
    });
  }

  // 2. Check agent-evolution-metrics endpoint
  const metrics = await fetchUrl('/api/ai/evolution/agent-evolution-metrics');
  console.log('2. GET /api/ai/evolution/agent-evolution-metrics -> HTTP', metrics.status);
  console.log('Agent Level Data:', {
    levelTitle: metrics.body.data?.agentLevel?.levelTitle,
    level: metrics.body.data?.agentLevel?.level,
    totalXp: metrics.body.data?.agentLevel?.totalXp,
    progressPct: metrics.body.data?.agentLevel?.progressPct,
    realConversationXp: metrics.body.data?.agentLevel?.realConversationXp,
    scoredConversationsCount: metrics.body.data?.agentLevel?.scoredConversationsCount,
  });

  // 3. Check single conversation score endpoint
  if (scores.body.data?.scores?.[0]?.conversationId) {
    const single = await fetchUrl(`/api/ai/evolution/conversation-scores/${scores.body.data.scores[0].conversationId}`);
    console.log(`3. GET /api/ai/evolution/conversation-scores/${scores.body.data.scores[0].conversationId} -> HTTP`, single.status);
    console.log('Single Audit XP:', single.body.data?.totalXp, 'Algorithm:', single.body.data?.algorithm?.code);
  }

  console.log('=== END VERIFICATION ===');
  process.exit(0);
})().catch(err => {
  console.error('Error during test:', err);
  process.exit(1);
});
