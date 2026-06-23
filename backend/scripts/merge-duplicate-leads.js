require('dotenv').config();
const db = require('../config/database');
const { normalizePhone } = require('../services/whatsapp/shared/identifiers');

async function run() {
  console.log('--- STARTING DATABASE NORMALIZATION & CLEANUP ---');

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Normalize and merge contacts table
    console.log('1. Normalizing contacts table...');
    const contactsRes = await client.query('SELECT id, phone, company_id, name, session_id FROM contacts');
    const contactGroups = new Map(); // key = company_id + '_' + normalizedPhone -> Array of contacts

    for (const row of contactsRes.rows) {
      const normalized = normalizePhone(row.phone);
      const key = `${row.company_id}_${normalized}`;
      if (!contactGroups.has(key)) {
        contactGroups.set(key, []);
      }
      contactGroups.get(key).push(row);
    }

    for (const [key, group] of contactGroups.entries()) {
      const companyId = key.split('_')[0];
      const normalized = key.substring(companyId.length + 1);

      // Sort: prefer rows where phone is already normalized, then smaller id
      group.sort((a, b) => {
        const aNormalized = (a.phone === normalized) ? 1 : 0;
        const bNormalized = (b.phone === normalized) ? 1 : 0;
        if (bNormalized !== aNormalized) return bNormalized - aNormalized;
        return a.id - b.id;
      });

      const survivor = group[0];
      
      // Delete duplicates
      for (let i = 1; i < group.length; i++) {
        const duplicate = group[i];
        console.log(`Duplicate contact found: ${duplicate.phone} (id=${duplicate.id}) -> deleting (survivor: id=${survivor.id}, phone=${normalized})`);
        await client.query('DELETE FROM contacts WHERE id = $1', [duplicate.id]);
      }

      // Update survivor
      if (survivor.phone !== normalized) {
        await client.query(
          'UPDATE contacts SET phone = $1, updated_at = NOW() WHERE id = $2',
          [normalized, survivor.id]
        );
      }
    }

    // 2. Normalize and merge leads table
    console.log('2. Normalizing leads table...');
    const leadsRes = await client.query('SELECT id, company_id, phone, name FROM leads');
    const leadGroups = new Map(); // key = company_id + '_' + normalizedPhone -> Array of leads

    for (const row of leadsRes.rows) {
      const normalized = normalizePhone(row.phone);
      const key = `${row.company_id}_${normalized}`;
      if (!leadGroups.has(key)) {
        leadGroups.set(key, []);
      }
      leadGroups.get(key).push(row);
    }

    for (const [key, group] of leadGroups.entries()) {
      const companyId = key.split('_')[0];
      const normalized = key.substring(companyId.length + 1);

      // Sort: prefer rows where phone is already normalized, then smaller id
      group.sort((a, b) => {
        const aNormalized = (a.phone === normalized) ? 1 : 0;
        const bNormalized = (b.phone === normalized) ? 1 : 0;
        if (bNormalized !== aNormalized) return bNormalized - aNormalized;
        return a.id - b.id;
      });

      const survivor = group[0];

      // Merge and delete duplicates
      for (let i = 1; i < group.length; i++) {
        const duplicate = group[i];
        console.log(`Duplicate lead found: id=${duplicate.id} (${duplicate.phone}) -> merging into survivor id=${survivor.id} (${normalized})`);
        
        // update conversations pointing to duplicate lead
        const convUpdate = await client.query(
          'UPDATE conversations SET lead_id = $1, updated_at = NOW() WHERE lead_id = $2',
          [survivor.id, duplicate.id]
        );
        console.log(`  Updated ${convUpdate.rowCount} conversation(s) to point to lead id=${survivor.id}`);
        
        // delete the duplicate lead
        await client.query('DELETE FROM leads WHERE id = $1', [duplicate.id]);
        console.log(`  Deleted duplicate lead id=${duplicate.id}`);
      }

      // Update survivor
      if (survivor.phone !== normalized) {
        await client.query(
          'UPDATE leads SET phone = $1 WHERE id = $2',
          [normalized, survivor.id]
        );
      }
    }

    // 3. Merge duplicate conversations (same lead_id, session_id, company_id)
    console.log('3. Merging duplicate conversations...');
    const convsRes = await client.query('SELECT id, lead_id, session_id, company_id, status FROM conversations');
    
    // Group conversations by (lead_id, session_id, company_id)
    const convGroups = new Map();
    for (const row of convsRes.rows) {
      const key = `${row.lead_id}_${row.session_id}_${row.company_id}`;
      if (!convGroups.has(key)) {
        convGroups.set(key, []);
      }
      convGroups.get(key).push(row);
    }

    // Map to get message count for each conversation to decide who survives
    const msgCountRes = await client.query('SELECT conversation_id, COUNT(*) as count FROM messages GROUP BY conversation_id');
    const msgCountMap = new Map(msgCountRes.rows.map(r => [r.conversation_id, parseInt(r.count, 10)]));

    for (const [key, convs] of convGroups.entries()) {
      if (convs.length <= 1) continue;

      console.log(`Found duplicate conversations for key ${key}: ${convs.map(c => c.id).join(', ')}`);
      
      // Sort conversations by message count desc, then id asc (oldest first if counts are equal)
      convs.sort((a, b) => {
        const countA = msgCountMap.get(a.id) || 0;
        const countB = msgCountMap.get(b.id) || 0;
        if (countB !== countA) return countB - countA;
        return a.id - b.id; // lower id is older
      });

      const survivor = convs[0];
      console.log(`  Survivor is conversation id=${survivor.id} (message count: ${msgCountMap.get(survivor.id) || 0})`);

      for (let i = 1; i < convs.length; i++) {
        const duplicate = convs[i];
        console.log(`  Merging duplicate conversation id=${duplicate.id} into survivor id=${survivor.id}`);
        
        // update messages to point to survivor
        const msgUpdate = await client.query(
          'UPDATE messages SET conversation_id = $1 WHERE conversation_id = $2',
          [survivor.id, duplicate.id]
        );
        console.log(`    Updated ${msgUpdate.rowCount} message(s) to point to conversation id=${survivor.id}`);

        // delete duplicate conversation
        await client.query('DELETE FROM conversations WHERE id = $1', [duplicate.id]);
        console.log(`    Deleted duplicate conversation id=${duplicate.id}`);
      }
    }

    // 4. Normalize and merge ai_conversation_memory table
    console.log('4. Normalizing ai_conversation_memory table...');
    const aiMemRes = await client.query('SELECT id, contact_id, company_id, phone, name FROM ai_conversation_memory');
    const aiMemGroups = new Map(); // key = company_id + '_' + normalizedPhone

    for (const row of aiMemRes.rows) {
      const normalized = normalizePhone(row.phone || row.contact_id);
      const key = `${row.company_id}_${normalized}`;
      if (!aiMemGroups.has(key)) {
        aiMemGroups.set(key, []);
      }
      aiMemGroups.get(key).push(row);
    }

    for (const [key, group] of aiMemGroups.entries()) {
      const companyId = key.split('_')[0];
      const normalized = key.substring(companyId.length + 1);

      // Sort: prefer rows where phone/contact_id is already normalized, then smaller id
      group.sort((a, b) => {
        const aNormalized = (a.phone === normalized && a.contact_id === normalized) ? 1 : 0;
        const bNormalized = (b.phone === normalized && b.contact_id === normalized) ? 1 : 0;
        if (bNormalized !== aNormalized) return bNormalized - aNormalized;
        return a.id - b.id;
      });

      const survivor = group[0];

      // Delete duplicates
      for (let i = 1; i < group.length; i++) {
        const duplicate = group[i];
        console.log(`Duplicate AI memory found: id=${duplicate.id} (${duplicate.phone || duplicate.contact_id}) -> deleting`);
        await client.query('DELETE FROM ai_conversation_memory WHERE id = $1', [duplicate.id]);
      }

      // Update survivor
      if (survivor.phone !== normalized || survivor.contact_id !== normalized) {
        await client.query(
          'UPDATE ai_conversation_memory SET contact_id = $1, phone = $2, updated_at = NOW() WHERE id = $3',
          [normalized, normalized, survivor.id]
        );
      }
    }

    // 5. Normalize chat_id in other AI memory tables
    console.log('5. Normalizing chat_id in ai_memory_short, ai_memory_long, ai_context...');
    
    // ai_memory_short
    const shortMemRes = await client.query('SELECT id, chat_id FROM ai_memory_short');
    for (const row of shortMemRes.rows) {
      const normalized = normalizePhone(row.chat_id);
      if (normalized !== row.chat_id) {
        await client.query('UPDATE ai_memory_short SET chat_id = $1 WHERE id = $2', [normalized, row.id]);
      }
    }

    // ai_memory_long (handle UNIQUE constraint on chat_id, category, content)
    const longMemRes = await client.query('SELECT id, chat_id, category, content FROM ai_memory_long');
    const longMemGroups = new Map(); // key = normalizedChatId + '_' + category + '_' + content
    for (const row of longMemRes.rows) {
      const normalized = normalizePhone(row.chat_id);
      const key = `${normalized}_${row.category}_${row.content}`;
      if (!longMemGroups.has(key)) {
        longMemGroups.set(key, []);
      }
      longMemGroups.get(key).push(row);
    }

    for (const [key, group] of longMemGroups.entries()) {
      const parts = key.split('_');
      const content = parts.slice(2).join('_');
      const category = parts[1];
      const normalized = parts[0];

      // Sort: prefer rows where chat_id is already normalized, then smaller id
      group.sort((a, b) => {
        const aNormalized = (a.chat_id === normalized) ? 1 : 0;
        const bNormalized = (b.chat_id === normalized) ? 1 : 0;
        if (bNormalized !== aNormalized) return bNormalized - aNormalized;
        return a.id - b.id;
      });

      const survivor = group[0];

      // Delete duplicates
      for (let i = 1; i < group.length; i++) {
        const duplicate = group[i];
        console.log(`Duplicate AI long memory found: id=${duplicate.id} -> deleting`);
        await client.query('DELETE FROM ai_memory_long WHERE id = $1', [duplicate.id]);
      }

      // Update survivor
      if (survivor.chat_id !== normalized) {
        await client.query(
          'UPDATE ai_memory_long SET chat_id = $1, updated_at = NOW() WHERE id = $2',
          [normalized, survivor.id]
        );
      }
    }

    // ai_context (handle UNIQUE constraint on chat_id)
    const ctxRes = await client.query('SELECT id, chat_id FROM ai_context');
    const ctxGroups = new Map(); // key = normalizedChatId

    for (const row of ctxRes.rows) {
      const normalized = normalizePhone(row.chat_id);
      if (!ctxGroups.has(normalized)) {
        ctxGroups.set(normalized, []);
      }
      ctxGroups.get(normalized).push(row);
    }

    for (const [normalized, group] of ctxGroups.entries()) {
      // Sort: prefer rows where chat_id is already normalized, then smaller id
      group.sort((a, b) => {
        const aNormalized = (a.chat_id === normalized) ? 1 : 0;
        const bNormalized = (b.chat_id === normalized) ? 1 : 0;
        if (bNormalized !== aNormalized) return bNormalized - aNormalized;
        return a.id - b.id;
      });

      const survivor = group[0];

      // Delete duplicates
      for (let i = 1; i < group.length; i++) {
        const duplicate = group[i];
        console.log(`Duplicate AI context found: id=${duplicate.id} -> deleting`);
        await client.query('DELETE FROM ai_context WHERE id = $1', [duplicate.id]);
      }

      // Update survivor
      if (survivor.chat_id !== normalized) {
        await client.query(
          'UPDATE ai_context SET chat_id = $1, updated_at = NOW() WHERE id = $2',
          [normalized, survivor.id]
        );
      }
    }

    // 6. Normalize phone in messages table
    console.log('6. Normalizing phone in messages table...');
    const msgsRes = await client.query('SELECT id, phone FROM messages WHERE phone IS NOT NULL');
    for (const row of msgsRes.rows) {
      const normalized = normalizePhone(row.phone);
      if (normalized !== row.phone) {
        await client.query('UPDATE messages SET phone = $1 WHERE id = $2', [normalized, row.id]);
      }
    }

    await client.query('COMMIT');
    console.log('--- DB INTEGRITY RESTORED SUCCESSFULLY ---');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('--- DB CLEANUP FAILED: TRANSACTION ROLLED BACK ---');
    console.error(err);
  } finally {
    client.release();
    await db.pool.end();
  }
}

run();
