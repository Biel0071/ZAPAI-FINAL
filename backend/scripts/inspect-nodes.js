const { query } = require('../config/database');

async function main() {
  const nodes = await query("SELECT node_id, hostname, ip, status, cpu_cores, ram_total, uptime_seconds, services FROM nodes");
  console.log('Nodes in database:');
  console.log(nodes.rows);

  const deploys = await query("SELECT * FROM deployments ORDER BY created_at DESC LIMIT 5");
  console.log('Deployments in database:');
  console.log(deploys.rows);
}

main().catch(console.error).finally(() => process.exit(0));
