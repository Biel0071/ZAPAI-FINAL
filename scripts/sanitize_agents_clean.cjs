const { pool } = require('../backend/src/infrastructure/config/database');

(async () => {
  const r = await pool.query("SELECT key, value FROM system_settings WHERE key = 'ai_agents_config_v2:default'");
  if (r.rows.length > 0) {
    const agents = JSON.parse(r.rows[0].value);
    // Keep only ZAIBOT (Platform Assistant) and Camila (Primary Store Attendant)
    const cleaned = agents.filter(a => a.key === 'zaibot' || a.key === 'camila');
    
    // Ensure Camila is properly configured as the store's primary sales employee
    for (const a of cleaned) {
      if (a.key === 'camila') {
        a.name = 'Camila';
        a.role = 'Vendas';
        a.active = true;
        a.status = 'active';
        a.sessionIds = ['main'];
        a.avatar = '/assets/evolution/camila_avatar.png';
      }
    }
    
    await pool.query("UPDATE system_settings SET value = $1 WHERE key = 'ai_agents_config_v2:default'", [JSON.stringify(cleaned)]);
    console.log('Sanitized agents to ZAIBOT and Camila:', cleaned.map(a => a.key));
  }
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
