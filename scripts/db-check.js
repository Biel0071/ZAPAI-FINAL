const { query } = require('../backend/src/infrastructure/config/database');

async function main() {
  const tables = await query("SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename");
  console.log("=== TABELAS NO POSTGRESQL ===");
  console.log(tables.rows.map(x => x.tablename));

  const migrations = await query("SELECT * FROM schema_migrations");
  console.log("\n=== MIGRAÇÕES EXECUTADAS ===");
  console.log(migrations.rows);

  // Check counts in memory and learning tables
  const memNodes = await query("SELECT COUNT(*)::int as count FROM agent_memory_nodes");
  const memEdges = await query("SELECT COUNT(*)::int as count FROM agent_memory_edges");
  const experiences = await query("SELECT COUNT(*)::int as count FROM ai_experience_events");
  const suggestions = await query("SELECT COUNT(*)::int as count FROM ai_learning_suggestions");
  const playbooks = await query("SELECT COUNT(*)::int as count FROM ai_playbooks");
  const conversations = await query("SELECT COUNT(*)::int as count FROM conversations");
  const messages = await query("SELECT COUNT(*)::int as count FROM messages");
  
  console.log("\n=== CONTAGEM DE DADOS ===");
  console.log("Conversations:", conversations.rows[0].count);
  console.log("Messages:", messages.rows[0].count);
  console.log("Agent Memory Nodes:", memNodes.rows[0].count);
  console.log("Agent Memory Edges:", memEdges.rows[0].count);
  console.log("AI Experience Events:", experiences.rows[0].count);
  console.log("AI Learning Suggestions:", suggestions.rows[0].count);
  console.log("AI Playbooks:", playbooks.rows[0].count);

  process.exit(0);
}

main().catch(e => {
  console.error("ERRO:", e);
  process.exit(1);
});
