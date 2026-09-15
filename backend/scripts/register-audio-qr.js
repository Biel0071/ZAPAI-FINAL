const { query } = require('../src/infrastructure/config/database');

async function main() {
  const payload = {
    text: "Gravei um áudio rápido explicando todos os detalhes da Caixa d'água de 5.000L para você:",
    items: [
      {
        type: 'audio',
        value: '/upload/quick-replies/audio_explicacao_caixa_5000l.mp3',
        filename: 'audio_explicacao_caixa_5000l.mp3',
      },
      {
        type: 'text',
        value: "Gravei um áudio rápido explicando os detalhes da Caixa d'água 5.000L!",
      }
    ],
    mediaUrl: '/upload/quick-replies/audio_explicacao_caixa_5000l.mp3',
    mediaType: 'audio',
    aiMemory: 'Áudio explicativo da caixa d água 5000 litros falando sobre polietileno virgem e proteção UV',
    filename: 'audio_explicacao_caixa_5000l.mp3',
  };

  await query(
    `INSERT INTO quick_replies (id, company_id, title, category, tags, content, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())
     ON CONFLICT (id) DO UPDATE SET
       title = EXCLUDED.title,
       category = EXCLUDED.category,
       tags = EXCLUDED.tags,
       content = EXCLUDED.content,
       updated_at = NOW()`,
    [
      'qr_audio_explicacao_caixa',
      'default',
      'explicacao audio caixa 5000l',
      'audio',
      ['explicar', 'explicacao', 'audio', 'voz', 'caixa', '5000l'],
      JSON.stringify(payload),
    ]
  );

  console.log('SUCCESS: Audio Quick Reply registered in PostgreSQL');
  process.exit(0);
}

main().catch((err) => {
  console.error('ERROR:', err);
  process.exit(1);
});
