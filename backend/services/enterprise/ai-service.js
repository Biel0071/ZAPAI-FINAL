const fs = require('fs/promises');
const path = require('path');
const { analyzeLeadIntent } = require('../leadAnalyzer');
const { generateAIResponse } = require('../aiResponseEngine');

const AI_MEMORY_FILE = path.join(__dirname, '..', '..', 'data', 'ai_memory.json');

function classifyDecisionFromConfidence(confidence = 0) {
  const safeConfidence = Math.max(0, Math.min(1, Number(confidence || 0)));

  if (safeConfidence > 0.8) {
    return 'auto_reply';
  }

  if (safeConfidence >= 0.5) {
    return 'suggest_reply';
  }

  return 'human';
}

async function appendAiMemory(entry = {}) {
  let data = [];

  try {
    const raw = await fs.readFile(AI_MEMORY_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    data = Array.isArray(parsed) ? parsed : [];
  } catch {
    data = [];
  }

  data.push({
    ...entry,
    createdAt: new Date().toISOString(),
  });

  if (data.length > 5000) {
    data = data.slice(-5000);
  }

  await fs.writeFile(AI_MEMORY_FILE, JSON.stringify(data, null, 2), 'utf8');
}

async function evaluateInboundAi({ agent, chatId, conversationHistory = [], customerMessage, store, forceAutoReply = false, conversationId = null, sessionId = null }) {
  const recentHistory = Array.isArray(conversationHistory) ? conversationHistory.slice(-10) : [];
  const lead = analyzeLeadIntent(customerMessage, recentHistory);
  const confidence = Math.max(0, Math.min(1, Number(lead?.confidence || 0)));
  let action = classifyDecisionFromConfidence(confidence);

  if (forceAutoReply) {
    action = 'auto_reply';
  }

  let aiReply = null;

  if (action === 'auto_reply' || action === 'suggest_reply') {
    aiReply = await generateAIResponse({
      agent,
      conversation: {
        id: conversationId || chatId,
        phone: chatId,
      },
      conversationHistory: recentHistory,
      customerMessage,
      leadAnalysis: lead,
      salesStrategy: {},
      store,
      sessionId,
    });
  }

  const aiTelemetry = aiReply && typeof aiReply === 'object' ? aiReply : {};
  const safeReply = String(aiTelemetry.response || aiReply || '').trim() || null;

  await appendAiMemory({
    chatId,
    context: recentHistory,
    decision: action,
    lead,
    response: safeReply,
  });

  return {
    action,
    confidence,
    decision: action,
    lead,
    response: safeReply || '',
    provider: aiTelemetry.provider,
    model: aiTelemetry.model,
    responseTimeMs: Number(aiTelemetry.responseTimeMs) || null,
    promptTokens: Number(aiTelemetry.promptTokens) || 0,
    completionTokens: Number(aiTelemetry.completionTokens) || 0,
    totalTokens: Number(aiTelemetry.totalTokens) || 0,
    agentName: aiTelemetry.agentName || agent?.name || null,
  };
}

module.exports = {
  evaluateInboundAi,
};
