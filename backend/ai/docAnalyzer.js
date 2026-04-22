const fs = require('fs/promises');
const mammoth = require('mammoth');
const OpenAI = require('openai');

function splitSentences(text) {
  return String(text || '')
    .split(/(?<=[.!?])\s+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function extractHeuristicTasks(text) {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const patterns = [
    /^(todo|task|ação|action|implement|create|build|fix|add|update)\b/i,
    /\b(deve|must|precisa|should)\b/i,
  ];

  return lines.filter((line) => patterns.some((pattern) => pattern.test(line))).slice(0, 20);
}

function extractHeuristicFeatures(text) {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const featurePattern = /\b(feature|m[oó]dulo|module|dashboard|api|endpoint|page|p[aá]gina|integration|integração)\b/i;
  return lines.filter((line) => featurePattern.test(line)).slice(0, 20);
}

function buildHeuristicResult(text) {
  const sentences = splitSentences(text);
  const summary = sentences.slice(0, 5).join(' ');

  return {
    summary: summary || 'No summary could be generated from the provided document.',
    tasks: extractHeuristicTasks(text),
    features: extractHeuristicFeatures(text),
  };
}

async function analyzeWithLLM(text) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return null;
  }

  const client = new OpenAI({ apiKey });
  const model = process.env.OPENAI_MODEL || 'gpt-4.1-mini';

  const response = await client.responses.create({
    model,
    input: [
      {
        role: 'system',
        content:
          'You analyze technical requirement documents. Return strict JSON with keys summary (string), tasks (array of strings), features (array of strings).',
      },
      {
        role: 'user',
        content: `Analyze this document text:\n\n${text.slice(0, 20000)}`,
      },
    ],
    text: {
      format: {
        type: 'json_schema',
        name: 'doc_analysis',
        schema: {
          type: 'object',
          additionalProperties: false,
          required: ['summary', 'tasks', 'features'],
          properties: {
            summary: { type: 'string' },
            tasks: {
              type: 'array',
              items: { type: 'string' },
            },
            features: {
              type: 'array',
              items: { type: 'string' },
            },
          },
        },
      },
    },
  });

  const content = response.output_text || '';
  if (!content) return null;

  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

async function analyzeDoc(filePath) {
  if (!filePath || !String(filePath).toLowerCase().endsWith('.docx')) {
    throw new Error('A .docx file path is required.');
  }

  await fs.access(filePath);
  const { value } = await mammoth.extractRawText({ path: filePath });
  const text = String(value || '').trim();

  if (!text) {
    return {
      summary: 'Document is empty or text could not be extracted.',
      tasks: [],
      features: [],
    };
  }

  const llmResult = await analyzeWithLLM(text).catch(() => null);
  if (llmResult) {
    return llmResult;
  }

  return buildHeuristicResult(text);
}

module.exports = {
  analyzeDoc,
};
