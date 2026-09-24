const axios = require('axios');
const { query } = require('../src/infrastructure/config/database');

async function testOpenAIKey() {
  console.log('Testing OpenAI key from system_settings...');
  const s = await query("SELECT value FROM system_settings WHERE key = 'ai_config'");
  const aiConfig = JSON.parse(s.rows[0].value);
  const provider = aiConfig.advancedAISettings.providers.find(p => p.id === 'openai');
  console.log('Provider found:', provider.id, 'Model:', provider.model);
  const apiKey = provider.apiKey;

  try {
    const res = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: provider.model || 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'responda ok' }],
      max_tokens: 10
    }, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    console.log('OpenAI API Call Success! Response:', res.data.choices[0].message);
  } catch (err) {
    console.error('OpenAI API Call FAILED!');
    if (err.response) {
      console.error('Status:', err.response.status);
      console.error('Data:', JSON.stringify(err.response.data, null, 2));
    } else {
      console.error(err.message);
    }
  }

  process.exit(0);
}

testOpenAIKey().catch(e => {
  console.error(e);
  process.exit(1);
});
