async function check() {
  try {
    const loginRes = await fetch('http://127.0.0.1:4025/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'zapadmin', password: 'zapadmin1010' })
    });
    const { token } = await loginRes.json();
    const res = await fetch('http://127.0.0.1:4025/api/conversations?limit=30', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    const list = Array.isArray(data) ? data : (data.data || data.conversations || []);
    const dep = list.find(c => (c.name || '').includes('Deposito') || (c.name || '').includes('Depósito'));
    console.log('Deposito conversation object:', dep);
  } catch (e) {
    console.error(e);
  }
}
check();
