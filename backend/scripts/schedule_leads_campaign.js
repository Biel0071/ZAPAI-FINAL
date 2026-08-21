const { Pool } = require('pg');
const crypto = require('crypto');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://zapai:zapai_password@localhost:5432/zapai_crm'
});

async function scheduleCampaign() {
  try {
    console.log('--- BUSCANDO 20 LEADS RECENTES NÃO FECHADOS ---');
    // Fetch 20 recent non-closed leads
    const { rows: leads } = await pool.query(`
      SELECT l.id, l.phone, l.name
      FROM leads l
      LEFT JOIN conversations conv ON conv.lead_id = l.id
      WHERE (conv.status IS NULL OR conv.status != 'closed')
      ORDER BY l.created_at DESC
      LIMIT 20
    `);

    if (leads.length === 0) {
      console.log('Nenhum lead encontrado para agendamento.');
      process.exit(0);
    }

    console.log(`Encontrados ${leads.length} leads. Construindo payload da campanha...`);

    const selectedContacts = leads.map(l => ({
      id: l.id,
      name: l.name,
      phone: l.phone
    }));

    const campaignId = 'camp_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex');
    
    // Tomorrow at 8 AM local time
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(8, 0, 0, 0);

    const payload = {
      id: campaignId,
      name: 'Follow-up IA (Afunilamento Automático)',
      status: 'scheduled',
      selectedContacts,
      messages: [
        {
          type: 'text',
          text: 'Olá, vi que se interessou nos itens da loja vamos dar seguimento'
        }
      ],
      settings: {
        scheduledAt: tomorrow.toISOString(),
        randomDelayMin: 50000, // 50s
        randomDelayMax: 100000, // 100s
        enableAIPostDispatch: true,
        aiSetup: {
          autoFunnel: true,
          autoTagging: true
        }
      },
      queue: { total: 0, processed: 0, sent: 0, failed: 0, paused: false },
      tags: ['ia_auto'],
      startedAt: null,
      completedAt: null
    };

    console.log('--- INSERINDO CAMPANHA AGENDADA ---');
    const { rows: inserted } = await pool.query(
      `
        INSERT INTO campaigns (
          id,
          company_id,
          name,
          status,
          selected_contacts,
          messages,
          settings,
          queue,
          tags,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8::jsonb, $9, NOW(), NOW())
        RETURNING *
      `,
      [
        payload.id,
        process.env.DEFAULT_COMPANY_ID || 'default',
        payload.name,
        payload.status,
        JSON.stringify(payload.selectedContacts),
        JSON.stringify(payload.messages),
        JSON.stringify(payload.settings),
        JSON.stringify(payload.queue),
        payload.tags
      ]
    );

    console.log('✅ Campanha Agendada com Sucesso!');
    console.log(`ID: ${inserted[0].id}`);
    console.log(`Data/Hora Agendada: ${new Date(payload.settings.scheduledAt).toLocaleString('pt-BR')}`);
    console.log(`Delay: 50 a 100 segundos entre envios`);
    console.log(`Leads Inseridos: ${leads.length}`);
    console.log(`Ativar Robo Post-Dispatch: SIM`);
    console.log(`Afunilamento e Etiquetas Automáticas: SIM`);
    
    process.exit(0);
  } catch (err) {
    console.error('Erro fatal:', err);
    process.exit(1);
  }
}

scheduleCampaign();
