const { Pool } = require('pg');
const crypto = require('crypto');
const pool = new Pool({ connectionString: 'postgresql://zapai:zapai_password@localhost:5432/zapai_crm' });

async function run() {
  try {
    const id = 'qr_churrasqueira_' + Date.now();
    
    // Creating the complex content object for Quick Replies
    const contentObj = {
      text: "Aqui está a foto da churrasqueira que você pediu! É um modelo premium 5 espetos. Gosta desse estilo?",
      mediaUrl: "https://t2.tudocdn.net/159496?w=1200&h=1200", // Using a dummy placeholder URL, it will send a link or image
      mediaType: "image",
      aiMemory: "Imagem de uma churrasqueira pré-moldada de tijolos à vista vermelhos (cerâmica), com laterais arredondadas e grelha em inox. Contém suporte para 5 espetos e chapéu cônico no topo. Parece rústica e de ótima qualidade para áreas de lazer.",
      filename: "churrasqueira_premium.jpg",
      items: [
        {
          type: "image",
          value: "https://t2.tudocdn.net/159496?w=1200&h=1200",
          fileName: "churrasqueira_premium.jpg"
        },
        {
          type: "text",
          value: "Aqui está a foto da churrasqueira que você pediu! É um modelo premium 5 espetos. Gosta desse estilo?"
        }
      ]
    };

    await pool.query(
      `INSERT INTO quick_replies (id, company_id, title, content, category, tags, created_at, updated_at)
       VALUES ($1, $2, $3, $4::text, $5, $6, NOW(), NOW())
       ON CONFLICT (id) DO NOTHING`,
      [
        id,
        process.env.DEFAULT_COMPANY_ID || 'default',
        'churrasqueira',
        JSON.stringify(contentObj),
        'produtos',
        ['churrasqueira', 'foto']
      ]
    );

    console.log('✅ Resposta Rápida com Memória Visual (Churrasqueira) inserida com sucesso.');
  } catch(e) { console.error('Erro:', e); }
  process.exit(0);
}
run();
