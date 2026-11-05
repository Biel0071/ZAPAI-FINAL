const app = require('/opt/zapai/backend/server');
const http = require('http');

async function debugRequest() {
  // Login first to get JWT
  const loginRes = await fetch('http://127.0.0.1:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'zapadmin', password: 'zapadmin1010' })
  });
  const { token } = await loginRes.json();

  // Test the route with full error capture
  // We can attach an error listener to unhandled errors
  const res = await fetch('http://127.0.0.1:3000/api/conversations/12574/messages?limit=50', {
    headers: { 
      Authorization: `Bearer ${token}`,
      'Accept': 'application/json'
    }
  });

  console.log('HTTP Status:', res.status);
  const text = await res.text();
  console.log('HTTP Response Body:', text);
  process.exit(0);
}

debugRequest().catch(console.error);

