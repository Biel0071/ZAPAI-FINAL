const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const NGROK_API_URL = 'http://127.0.0.1:4040/api/tunnels';

async function getPublicUrl(fallbackUrl = 'http://localhost:4000') {
  try {
    const response = await axios.get(NGROK_API_URL, { timeout: 2000 });
    const tunnels = response.data?.tunnels || [];
    const httpsTunnel = tunnels.find((tunnel) => tunnel.public_url?.startsWith('https://'));

    return httpsTunnel?.public_url || fallbackUrl;
  } catch {
    return fallbackUrl;
  }
}

function resolveNgrokCommand() {
  if (process.platform !== 'win32') {
    return 'ngrok';
  }

  const appData = process.env.APPDATA;
  const candidates = [
    appData && path.join(appData, 'npm', 'node_modules', 'ngrok', 'bin', 'ngrok.exe'),
    appData && path.join(appData, 'npm', 'ngrok.cmd'),
    'ngrok',
  ].filter(Boolean);

  return candidates.find((candidate) => candidate === 'ngrok' || fs.existsSync(candidate)) || 'ngrok';
}

async function waitForPublicUrl(timeoutMs = 20000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await axios.get(NGROK_API_URL, { timeout: 2000 });
      const tunnels = response.data?.tunnels || [];
      const httpsTunnel = tunnels.find((tunnel) => tunnel.public_url?.startsWith('https://'));

      if (httpsTunnel?.public_url) {
        return httpsTunnel.public_url;
      }
    } catch (error) {
      // ngrok API may not be ready yet
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error('Timed out while waiting for ngrok public URL.');
}

async function getExistingPublicUrl() {
  const publicUrl = await getPublicUrl(null);
  return publicUrl;
}

async function startNgrok(port) {
  const existingPublicUrl = await getExistingPublicUrl();

  if (existingPublicUrl) {
    return {
      publicUrl: existingPublicUrl,
      ngrokProcess: null,
    };
  }

  const ngrokCommand = resolveNgrokCommand();
  const ngrokProcess = spawn(ngrokCommand, ['http', String(port)], {
    shell: false,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let stderrOutput = '';

  ngrokProcess.stderr.on('data', (chunk) => {
    stderrOutput += chunk.toString();
  });

  ngrokProcess.stdout.on('data', () => {
    // keep stream active for process supervision
  });

  ngrokProcess.on('exit', (code) => {
    if (code && code !== 0) {
      console.error(`[SERVER] ngrok exited with code ${code}`);
    }
  });

  try {
    const publicUrl = await waitForPublicUrl();
    return { publicUrl, ngrokProcess };
  } catch (error) {
    ngrokProcess.kill();
    throw new Error(stderrOutput.trim() || error.message);
  }
}

module.exports = {
  getPublicUrl,
  startNgrok,
};
