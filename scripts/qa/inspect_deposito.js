async function testEndpoint() {
  try {
    const loginRes = await fetch('http://127.0.0.1:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'zapadmin', password: 'zapadmin1010' })
    });
    const { token } = await loginRes.json();

    const res = await fetch('http://127.0.0.1:3000/api/conversations/12574/messages?limit=50', {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('Status code for /api/conversations/12574/messages:', res.status);
    const data = await res.json();
    console.log('Data length:', Array.isArray(data) ? data.length : typeof data);
    if (Array.isArray(data)) {
      console.log('Last 5 messages:');
      for (const m of data.slice(-5)) {
        console.log(`[${m.timestamp || m.createdAt}] id=${m.id} fromMe=${m.fromMe} text=${(m.text || m.content || '').slice(0, 40)}`);
      }
    } else {
      console.log('Non-array response:', data);
    }
  } catch (e) {
    console.error('Error:', e);
  }
}

testEndpoint();
