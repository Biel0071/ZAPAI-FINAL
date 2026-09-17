const { spawn } = require('child_process');

const VPS_HOST = 'root@209.50.241.22';

const remoteCmd = `cd /opt/zapai/backend && node -e "
const { getAIEnabled, enableAI } = require('./src/infrastructure/config/aiToggle');
const { getAIIntegrationStatus } = require('./services/ai.service');
const { query } = require('./src/infrastructure/config/database');

(async () => {
  console.log('--- CHECKING AI STATUS ON VPS ---');
  const aiToggle = await getAIEnabled('default');
  console.log('1. getAIEnabled(default):', aiToggle);

  const integration = await getAIIntegrationStatus({}, 'default');
  console.log('2. getAIIntegrationStatus:', JSON.stringify(integration));

  const settings = await query('SELECT key, value FROM system_settings WHERE key ILIKE \\'%ai%\\'');
  console.log('3. system_settings AI rows:', JSON.stringify(settings.rows));

  const fs = require('fs');
  const envContent = fs.readFileSync('/opt/zapai/backend/.env', 'utf8');
  console.log('--- BACKEND .ENV KEYS ---');
  envContent.split('\\n').forEach(l => {
    const trimmed = l.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const idx = trimmed.indexOf('=');
    if (idx > 0) {
      const k = trimmed.slice(0, idx).trim();
      const v = trimmed.slice(idx + 1).trim();
      console.log(k, '=> length:', v.length);
    }
  });

  // Check pm2 process environment
  console.log('--- PROCESS.ENV CURRENT KEYS ---');
  console.log('ENCRYPTION_KEY exists:', !!process.env.ENCRYPTION_KEY);
  console.log('OPENAI_API_KEY exists:', !!process.env.OPENAI_API_KEY);
  console.log('ANTHROPIC_API_KEY exists:', !!process.env.ANTHROPIC_API_KEY);
  console.log('GEMINI_API_KEY exists:', !!process.env.GEMINI_API_KEY);
  console.log('GROQ_API_KEY exists:', !!process.env.GROQ_API_KEY);
})();
"`;

const proc = spawn('ssh', [
  '-o', 'StrictHostKeyChecking=no',
  '-o', 'ConnectTimeout=15',
  VPS_HOST,
  remoteCmd
], { stdio: 'inherit', shell: false });

proc.on('close', (code) => {
  process.exit(code);
});
