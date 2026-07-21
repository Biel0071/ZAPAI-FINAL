const sessionManager = require('../backend/services/sessionManager');

async function run() {
  console.log('--- TESTING ON-WHATSAPP LOOKUP ---');
  try {
    const session = sessionManager.getSession('material');
    if (!session) {
      console.log('Session "material" not found in manager!');
      process.exit(1);
    }
    const sock = session.sock;
    if (!sock) {
      console.log('Socket not found in session "material"!');
      process.exit(1);
    }

    const numbers = [
      '553193807167@s.whatsapp.net',
      '5531993807167@s.whatsapp.net'
    ];

    for (const num of numbers) {
      try {
        console.log(`Querying onWhatsApp for ${num}...`);
        const res = await sock.onWhatsApp(num);
        console.log(`Result for ${num}:`, JSON.stringify(res));
      } catch (err) {
        console.error(`Query failed for ${num}:`, err.message);
      }
    }
  } catch (err) {
    console.error('Error:', err);
  }
}

// We need to wait a bit for sessionManager to start up and load sessions
setTimeout(() => {
  run();
}, 2000);
