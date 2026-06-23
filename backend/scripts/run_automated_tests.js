const fs = require('fs');
const path = require('path');
const axios = require('axios');

const BASE_URL = 'http://localhost:4025';
const PHONE_NUMBER = '553193672075'; // target number (sends to itself)

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log('[TEST RUNNER] Starting inbox tests...');

  // 1. Authenticate to get JWT token
  let token;
  try {
    const loginRes = await axios.post(`${BASE_URL}/api/auth/login`, {
      username: 'zapadmin',
      password: 'zapadmin123',
      tenantId: 'default'
    }, {
      headers: { 'x-tenant-id': 'default' }
    });
    token = loginRes.data?.token || loginRes.data?.accessToken || loginRes.data?.data?.token;
    console.log('[TEST RUNNER] Authenticated successfully.');
  } catch (err) {
    console.error('[TEST RUNNER] Authentication failed:', err.response?.data || err.message);
    process.exit(1);
  }

  const authHeaders = {
    'Authorization': `Bearer ${token}`,
    'x-tenant-id': 'default',
    'Content-Type': 'application/json'
  };

  // 2. Poll connection status of 'teste1010' session
  console.log('[TEST RUNNER] Polling for session connection...');
  let connected = false;
  while (!connected) {
    try {
      const statusRes = await axios.get(`${BASE_URL}/api/sessions/status`, { headers: authHeaders });
      const resData = statusRes.data?.data || statusRes.data;
      const Session = resData?.sessions?.find(s => s.sessionId === 'teste1010') || resData;
      if (Session && (Session.connected === true || Session.status === 'connected')) {
        connected = true;
        console.log('[TEST RUNNER] WhatsApp session connected!');
      } else {
        console.log(`[TEST RUNNER] Current status: ${Session?.status || 'unknown'}. Waiting for scan...`);
        await sleep(3000);
      }
    } catch (err) {
      console.error('[TEST RUNNER] Failed to check status:', err.message);
      await sleep(3000);
    }
  }

  // 3. Create dummy media files
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }

  const audioPath1 = path.join(UPLOADS_DIR, 'temp_test_audio.mp3');
  const audioPath2 = path.join(UPLOADS_DIR, 'temp_test_audio_2.mp3');
  const docPath = path.join(UPLOADS_DIR, 'temp_test_doc.txt');

  fs.writeFileSync(audioPath1, Buffer.from([0x24, 0x49, 0x44, 0x33, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00])); // dummy mp3 header bytes
  fs.writeFileSync(audioPath2, Buffer.from([0x24, 0x49, 0x44, 0x33, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00]));
  fs.writeFileSync(docPath, 'This is a test document sent from ZapFlow automated diagnostics.');

  console.log('[TEST RUNNER] Dummy media files created.');

  // 4. Send messages
  try {
    // A. Text Message
    console.log('[TEST RUNNER] Sending text message...');
    const textRes = await axios.post(`${BASE_URL}/api/send-message`, {
      phone: PHONE_NUMBER,
      message: 'Teste de envio de texto do ZapFlow! 🚀',
      sessionId: 'teste1010'
    }, { headers: authHeaders });
    console.log('[TEST RUNNER] Text message response:', textRes.data?.success ? 'Success' : 'Failed');

    await sleep(2000);

    // B. First Audio Message
    console.log('[TEST RUNNER] Sending audio message 1...');
    const audioRes1 = await axios.post(`${BASE_URL}/api/send-message`, {
      phone: PHONE_NUMBER,
      mediaPath: '/uploads/temp_test_audio.mp3',
      mediaType: 'audio',
      ptt: true,
      sessionId: 'teste1010'
    }, { headers: authHeaders });
    console.log('[TEST RUNNER] Audio message 1 response:', audioRes1.data?.success ? 'Success' : 'Failed');

    await sleep(2000);

    // C. Second Audio Message
    console.log('[TEST RUNNER] Sending audio message 2...');
    const audioRes2 = await axios.post(`${BASE_URL}/api/send-message`, {
      phone: PHONE_NUMBER,
      mediaPath: '/uploads/temp_test_audio_2.mp3',
      mediaType: 'audio',
      ptt: false,
      sessionId: 'teste1010'
    }, { headers: authHeaders });
    console.log('[TEST RUNNER] Audio message 2 response:', audioRes2.data?.success ? 'Success' : 'Failed');

    await sleep(2000);

    // D. Document Message
    console.log('[TEST RUNNER] Sending document message...');
    const docRes = await axios.post(`${BASE_URL}/api/send-message`, {
      phone: PHONE_NUMBER,
      mediaPath: '/uploads/temp_test_doc.txt',
      mediaType: 'document',
      fileName: 'diagnostico_zapflow.txt',
      sessionId: 'teste1010'
    }, { headers: authHeaders });
    console.log('[TEST RUNNER] Document message response:', docRes.data?.success ? 'Success' : 'Failed');

    console.log('[TEST RUNNER] All messages sent! Verify receipt on your phone.');
  } catch (err) {
    console.error('[TEST RUNNER] Message sending failed:', err.response?.data || err.message);
  } finally {
    // 5. Clean up dummy files (commented out for UI verification)
    try {
      // if (fs.existsSync(audioPath1)) fs.unlinkSync(audioPath1);
      // if (fs.existsSync(audioPath2)) fs.unlinkSync(audioPath2);
      // if (fs.existsSync(docPath)) fs.unlinkSync(docPath);
      console.log('[TEST RUNNER] Dummy media files kept for verification.');
    } catch (cleanupErr) {
      console.error('[TEST RUNNER] Failed to clean up dummy files:', cleanupErr.message);
    }
  }
}

main();
