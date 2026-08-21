const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function createCampaign() {
  try {
    console.log("Searching for leads...");
    
    // Find 20 recent leads from roughly 4 days ago with AI enabled
    const res = await pool.query(`
      SELECT DISTINCT l.id, l.name, l.phone, l.created_at
      FROM leads l
      JOIN conversations c ON c.lead_id = l.id
      WHERE c.ai_enabled = true
        AND l.created_at <= NOW() - INTERVAL '3 days'
      ORDER BY l.created_at DESC
      LIMIT 20
    `);

    const leads = res.rows;
    console.log(`Found ${leads.length} leads.`);
    
    if (leads.length === 0) {
        console.log("No leads found matching criteria. Taking any 20 leads with AI enabled.");
        const fallbackRes = await pool.query(`
          SELECT DISTINCT l.id, l.name, l.phone, l.created_at
          FROM leads l
          JOIN conversations c ON c.lead_id = l.id
          WHERE c.ai_enabled = true
          ORDER BY l.created_at DESC
          LIMIT 20
        `);
        leads.push(...fallbackRes.rows);
    }

    const selectedContacts = leads.map(l => ({
      id: l.id,
      name: l.name || 'Unknown',
      phone: l.phone
    }));

    // Scheduled for today at 11:00 AM (local time, which is -03:00)
    // We construct the date explicitly.
    const now = new Date();
    const scheduledAt = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 11, 0, 0, 0);

    const payload = {
      id: uuidv4(),
      company_id: 'default',
      name: 'Follow-up IA - 11h',
      status: 'scheduled',
      selected_contacts: JSON.stringify(selectedContacts),
      messages: JSON.stringify([
        {
          id: uuidv4(),
          type: 'text',
          content: 'olá você se interessou em nossos produtos vamos continuar ?'
        }
      ]),
      settings: JSON.stringify({
        startAt: scheduledAt.toISOString(),
        scheduledAt: scheduledAt.toISOString(),
        useAI: true
      }),
      queue: JSON.stringify({
        total: selectedContacts.length,
        sent: 0,
        failed: 0,
        processed: 0,
        status: 'pending'
      }),
      tags: [],
      started_at: null,
      completed_at: null
    };

    console.log("Creating campaign:", payload.name, "scheduled at", payload.settings.scheduledAt);

    await pool.query(
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
          started_at,
          completed_at,
          created_at,
          updated_at
        )
        VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb,$8::jsonb,$9,$10,$11,NOW(),NOW())
      `,
      [
        payload.id,
        payload.company_id,
        payload.name,
        payload.status,
        payload.selected_contacts,
        payload.messages,
        payload.settings,
        payload.queue,
        payload.tags,
        payload.started_at,
        payload.completed_at
      ]
    );

    console.log("Campaign successfully created!");
  } catch (error) {
    console.error("Failed:", error);
  } finally {
    await pool.end();
  }
}

createCampaign();
