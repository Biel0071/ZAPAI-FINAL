const { pool } = require('./backend/src/infrastructure/config/database');
(async () => {
  try {
    await pool.query("ALTER TABLE conversations ADD COLUMN IF NOT EXISTS ai_reactivate_at TIMESTAMP WITHOUT TIME ZONE");
    console.log("Column ai_reactivate_at added successfully!");
    
    // Clean up duplicated messages if they exist (based on duplicate whatsapp_message_id and same conversation)
    // Actually, it might be safer to just delete duplicate messages with exactly the same content and created_at close to each other.
    // Or just clear pending/sending messages that are stuck.
    await pool.query(`
      DELETE FROM messages 
      WHERE id IN (
        SELECT id FROM (
          SELECT id, ROW_NUMBER() OVER (partition BY whatsapp_message_id ORDER BY id ASC) as rnum
          FROM messages
          WHERE whatsapp_message_id IS NOT NULL
        ) t WHERE t.rnum > 1
      )
    `);
    console.log("Duplicated messages cleaned!");
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
