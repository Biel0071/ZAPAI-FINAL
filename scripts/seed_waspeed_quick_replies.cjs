const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });
const { Client } = require('pg');

async function main() {
  const bundleFile = path.resolve(__dirname, 'waspeed_ready_bundle.json');
  if (!fs.existsSync(bundleFile)) {
    console.error('Bundle file waspeed_ready_bundle.json not found!');
    process.exit(1);
  }

  const items = JSON.parse(fs.readFileSync(bundleFile, 'utf8'));
  console.log(`Loaded ${items.length} quick reply items from bundle.`);

  // Database connection config
  const dbConfig = process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL }
    : {
        host: process.env.DB_HOST || '127.0.0.1',
        port: Number(process.env.DB_PORT) || 5432,
        user: process.env.DB_USER || 'zapai',
        password: process.env.DB_PASSWORD || 'zapai_secret_2026',
        database: process.env.DB_NAME || 'zapai_crm',
      };

  console.log('Connecting to PostgreSQL database:', dbConfig.database || dbConfig.connectionString);
  const client = new Client(dbConfig);

  try {
    await client.connect();
    console.log('Connected to PostgreSQL successfully.');

    // Ensure table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS quick_replies (
        id TEXT PRIMARY KEY,
        company_id TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL DEFAULT '',
        category TEXT NOT NULL DEFAULT 'general',
        tags TEXT[] NOT NULL DEFAULT '{}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS quick_replies_company_updated
        ON quick_replies(company_id, updated_at DESC);
    `);

    let inserted = 0;
    let updated = 0;

    for (const item of items) {
      const contentPayload = JSON.stringify({
        text: item.content || '',
        items: item.items || [],
        steps: item.steps || [],
        mediaUrl: item.mediaUrl || null,
        mediaType: item.mediaType || null,
        aiMemory: item.aiMemory || null,
        filename: item.filename || null,
        favorite: Boolean(item.favorite),
        isFlow: Boolean(item.isFlow),
      });

      const res = await client.query(
        `INSERT INTO quick_replies (id, company_id, title, content, category, tags, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())
         ON CONFLICT (id) DO UPDATE SET
           title = EXCLUDED.title,
           content = EXCLUDED.content,
           category = EXCLUDED.category,
           tags = EXCLUDED.tags,
           updated_at = NOW()
         WHERE quick_replies.company_id = EXCLUDED.company_id
         RETURNING id`,
        [
          item.id,
          item.company_id || 'default',
          item.title,
          contentPayload,
          item.category || 'ATENDIMENTO GERAL',
          item.tags || [],
        ]
      );

      if (res.rowCount > 0) {
        inserted++;
      } else {
        updated++;
      }
    }

    console.log(`\n======================================================`);
    console.log(`✅ Seed Concluído com Sucesso!`);
    console.log(`   Total de Respostas Rápidas Populadas: ${items.length}`);
    console.log(`   Tenant (company_id): default`);
    console.log(`======================================================`);

    // Verify in database
    const check = await client.query(`
      SELECT category, count(*) as count 
      FROM quick_replies 
      WHERE company_id = 'default' 
      GROUP BY category 
      ORDER BY count DESC;
    `);
    console.log('\nDistribuição Oficial por Categoria no Banco:');
    console.table(check.rows);

  } catch (err) {
    console.error('Erro durante o seed de quick_replies:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main().catch(console.error);
