const OpenAI = require('openai');
const { DEFAULT_SYSTEM_PROMPT } = require('./basePrompt');
const { getActivePrompt } = require('./promptManager');

let client;

function getClient() {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return null;
  }

  if (!client) {
    client = new OpenAI({ apiKey });
  }

  return client;
}

function formatConversationMessages(messages = []) {
  return messages
    .slice(-20)
    .map((message) => `${message.from === 'agent' ? 'Atendente' : 'Cliente'}: ${message.text || `[${message.mediaType || 'mensagem'}]`}`)
    .join('\n');
}

function formatContextSection(context = null) {
  if (!context || typeof context !== 'object') {
    return '';
  }

  const sections = [];

  if (context.summary) {
    sections.push(`Resumo anterior: ${context.summary}`);
  }

  if (context.intent) {
    sections.push(`Intencao detectada: ${context.intent}`);
  }

  if (context.sentiment) {
    sections.push(`Sentimento atual: ${context.sentiment}`);
  }

  if (Array.isArray(context.tags) && context.tags.length > 0) {
    sections.push(`Tags: ${context.tags.slice(0, 8).join(', ')}`);
  }

  if (context.prefersAudio) {
    sections.push('Preferencia detectada: cliente tende a aceitar audio/voz.');
  }

  if (Array.isArray(context.history) && context.history.length > 0) {
    const historyLines = context.history
      .slice(-12)
      .map((message) => `${message.role === 'assistant' ? 'Atendente' : 'Cliente'}: ${message.content || ''}`)
      .join('\n');
    sections.push(`Historico recente:\n${historyLines}`);
  }

  return sections.join('\n');
}

async function generateAutoReply(store, { phone, name, text, context = null }) {
  const openai = getClient();

  if (!openai) {
    return null;
  }

  const activePrompt = store ? getActivePrompt(store) : DEFAULT_SYSTEM_PROMPT;

  const response = await openai.responses.create({
    model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
    input: [
      {
        role: 'system',
        content: activePrompt,
      },
      {
        role: 'user',
        content: `Contact: ${name || 'Unknown'}\nPhone: ${phone}\nMessage: ${text}${
          context ? `\n${formatContextSection(context)}` : ''
        }`,
      },
    ],
  });

  return response.output_text?.trim() || null;
}

async function generateConversationSummaryWithAI(store, messages = []) {
  const openai = getClient();

  if (!openai || !Array.isArray(messages) || messages.length === 0) {
    return null;
  }

  const response = await openai.responses.create({
    model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
    input: [
      {
        role: 'system',
        content:
          'Resuma conversas comerciais de WhatsApp em português do Brasil com no máximo 18 palavras. Retorne apenas o resumo final.',
      },
      {
        role: 'user',
        content: `Gere um resumo curto da conversa abaixo:\n${formatConversationMessages(messages)}`,
      },
    ],
  });

  return response.output_text?.trim() || null;
}

module.exports = {
  getClient,
  SYSTEM_PROMPT: DEFAULT_SYSTEM_PROMPT,
  generateAutoReply,
  generateConversationSummaryWithAI,
};
