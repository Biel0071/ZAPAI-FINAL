const { query } = require('../config/database');

async function main() {
  const result = await query("SELECT node_id, hostname, ip, status, cpu_cores, ram_total, uptime_seconds, services FROM nodes");
  console.log('Nodes in database:');
  console.log(result.rows);
}

main().catch(console.error).finally(() => process.exit(0));
