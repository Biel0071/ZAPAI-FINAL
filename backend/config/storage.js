const fs = require('fs/promises');
const path = require('path');

const dataDirectory = path.join(__dirname, '..', 'data');
const conversationsFilePath = path.join(dataDirectory, 'conversations.json');
const messagesFilePath = path.join(dataDirectory, 'messages.json');
const aiLearningLogsFilePath = path.join(dataDirectory, 'ai_learning_logs.json');
const promptHistoryFilePath = path.join(dataDirectory, 'prompt_history.json');

async function ensureDataFiles() {
  await fs.mkdir(dataDirectory, { recursive: true });
  await Promise.all([
    ensureJsonFile(conversationsFilePath),
    ensureJsonFile(messagesFilePath),
    ensureJsonFile(aiLearningLogsFilePath),
    ensureJsonFile(promptHistoryFilePath),
  ]);
}

async function ensureJsonFile(filePath) {
  try {
    await fs.access(filePath);
  } catch {
    await fs.writeFile(filePath, '[]', 'utf8');
  }
}

async function readJsonArray(filePath) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function loadStoreState() {
  await ensureDataFiles();

  const [conversations, messages, aiLearningLogs, promptHistory] = await Promise.all([
    readJsonArray(conversationsFilePath),
    readJsonArray(messagesFilePath),
    readJsonArray(aiLearningLogsFilePath),
    readJsonArray(promptHistoryFilePath),
  ]);

  return {
    aiLearningLogs,
    conversations,
    messages,
    promptHistory,
  };
}

async function saveStoreState({
  aiLearningLogs,
  conversations,
  messages,
  promptHistory,
}) {
  await ensureDataFiles();

  const writes = [];

  if (Array.isArray(conversations)) {
    writes.push(
      fs.writeFile(conversationsFilePath, JSON.stringify(conversations, null, 2), 'utf8')
    );
  }

  if (Array.isArray(messages)) {
    writes.push(
      fs.writeFile(messagesFilePath, JSON.stringify(messages, null, 2), 'utf8')
    );
  }

  if (Array.isArray(aiLearningLogs)) {
    writes.push(
      fs.writeFile(aiLearningLogsFilePath, JSON.stringify(aiLearningLogs, null, 2), 'utf8')
    );
  }

  if (Array.isArray(promptHistory)) {
    writes.push(
      fs.writeFile(promptHistoryFilePath, JSON.stringify(promptHistory, null, 2), 'utf8')
    );
  }

  await Promise.all(writes);
}

module.exports = {
  aiLearningLogsFilePath,
  conversationsFilePath,
  dataDirectory,
  loadStoreState,
  messagesFilePath,
  promptHistoryFilePath,
  saveStoreState,
};
