const http = require('http');

async function testCompose() {
  const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ6YXBhZG1pbiIsInVzZXJuYW1lIjoiemFwYWRtaW4iLCJ0ZW5hbnRJZCI6ImRlZmF1bHQiLCJjb21wYW55SWQiOiJkZWZhdWx0Iiwicm9sZSI6Im1hc3Rlcl9hZG1pbiIsImlhdCI6MTc4OTQ5MTM1OCwiZXhwIjoxNzg5NTIwMTU4fQ.Uk_T2cXp2SJ9GtFatQye9Gtv7hMJkjTWEn2iW9-YlqI';

  const payload = {
    contactId: '5511988880001',
    contactName: 'Carlos Teste',
    currentDraft: 'temos por 2490',
    action: 'improve',
    recentMessages: [
      { role: 'user', content: "Olá, gostaria de saber sobre a caixa d'água de 5000 litros" },
      { role: 'assistant', content: "Temos sim! Trabalhamos com caixas de 5000L em polietileno virgem." },
      { role: 'user', content: 'Quanto fica?' },
    ],
  };

  const req = http.request('http://127.0.0.1:4025/api/ai/compose', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token,
    },
  }, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      console.log('STATUS:', res.statusCode);
      console.log('BODY:', data);
      process.exit(0);
    });
  });

  req.on('error', (err) => {
    console.error('ERROR:', err);
    process.exit(1);
  });

  req.write(JSON.stringify(payload));
  req.end();
}

testCompose();
