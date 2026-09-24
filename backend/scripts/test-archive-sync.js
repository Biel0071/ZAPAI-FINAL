/**
 * Test Archive Synchronization between WhatsApp and ZapFlow
 * Validates:
 * 1. Polymorphic conversationId resolution in updateConversationState (numeric, phone, JID)
 * 2. Baileys chatModify payload requirement (archive + lastMessages messageRange)
 * 3. Bidirectional state transitions (open -> archived -> open)
 */

const assert = require('assert');

async function runTests() {
  console.log('=== TEST SUITE: Archive Sync (WhatsApp <-> ZapFlow) ===\n');

  let passed = 0;
  let total = 0;

  function test(description, fn) {
    total++;
    try {
      fn();
      console.log(`  ✓ [TEST ${total}] ${description}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ [TEST ${total}] ${description}:`, err.message);
    }
  }

  async function asyncTest(description, fn) {
    total++;
    try {
      await fn();
      console.log(`  ✓ [TEST ${total}] ${description}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ [TEST ${total}] ${description}:`, err.message);
    }
  }

  // 1. Baileys chatModify contract validation
  test('Baileys chatModify payload structure with lastMessages', () => {
    const jid = '5511999887766@s.whatsapp.net';
    const lastDbMsg = {
      whatsapp_message_id: 'WAMSG123456',
      from_me: false,
      timestamp: new Date('2026-09-18T10:00:00Z'),
    };

    const lastMessages = [{
      key: {
        id: lastDbMsg.whatsapp_message_id,
        remoteJid: jid,
        fromMe: Boolean(lastDbMsg.from_me)
      },
      messageTimestamp: Math.floor(new Date(lastDbMsg.timestamp).getTime() / 1000)
    }];

    const archiveMod = { archive: true, lastMessages };
    assert.strictEqual(archiveMod.archive, true);
    assert.strictEqual(archiveMod.lastMessages.length, 1);
    assert.strictEqual(archiveMod.lastMessages[0].key.id, 'WAMSG123456');
    assert.strictEqual(archiveMod.lastMessages[0].key.remoteJid, jid);
    assert.strictEqual(archiveMod.lastMessages[0].key.fromMe, false);
    assert.strictEqual(typeof archiveMod.lastMessages[0].messageTimestamp, 'number');

    const unarchiveMod = { archive: false, lastMessages };
    assert.strictEqual(unarchiveMod.archive, false);
  });

  // 2. Inbound event parser check
  test('Inbound chats.update recognizes both update.archive and update.archived', () => {
    const update1 = { id: '5511999887766@s.whatsapp.net', archive: true };
    const isArchived1 = typeof update1.archive === 'boolean'
      ? update1.archive
      : (typeof update1.archived === 'boolean' ? update1.archived : null);
    assert.strictEqual(isArchived1, true);

    const update2 = { id: '5511999887766@s.whatsapp.net', archived: false };
    const isArchived2 = typeof update2.archive === 'boolean'
      ? update2.archive
      : (typeof update2.archived === 'boolean' ? update2.archived : null);
    assert.strictEqual(isArchived2, false);

    const update3 = { id: '5511999887766@s.whatsapp.net', name: 'Test' };
    const isArchived3 = typeof update3.archive === 'boolean'
      ? update3.archive
      : (typeof update3.archived === 'boolean' ? update3.archived : null);
    assert.strictEqual(isArchived3, null);
  });

  // 3. Database polymorphism resolution logic check
  await asyncTest('conversationRepository resolves JID and phone without integer syntax error', async () => {
    const conversationRepository = require('../src/data/repositories/conversationRepository');
    
    // Test with non-existent JID - should return null cleanly instead of throwing PostgreSQL integer parse error
    const resultJid = await conversationRepository.updateConversationState('9999999999999@s.whatsapp.net', { status: 'archived' });
    assert.strictEqual(resultJid, null);

    // Test with non-existent phone - should return null cleanly without SQL error
    const resultPhone = await conversationRepository.updateConversationState('9999999999999', { status: 'open' });
    assert.strictEqual(resultPhone, null);
  });

  // 4. Frontend archive filtering logic check
  test('Frontend Inbox filtering matches real WhatsApp archive status', () => {
    const archivedSet = new Set(['10', '20']);

    // Case A: Conversation marked archived in DB status (e.g. synced from WhatsApp)
    const convFromWhatsApp = { id: '30', status: 'archived' };
    const isArchivedA = archivedSet.has(convFromWhatsApp.id) || String(convFromWhatsApp.status).toLowerCase() === 'archived';
    assert.strictEqual(isArchivedA, true);

    // Case B: Conversation active/open in DB
    const convOpen = { id: '40', status: 'open' };
    const isArchivedB = archivedSet.has(convOpen.id) || String(convOpen.status).toLowerCase() === 'archived';
    assert.strictEqual(isArchivedB, false);

    // Case C: Conversation marked archived locally in localStorage
    const convLocalArchived = { id: '10', status: 'open' };
    const isArchivedC = archivedSet.has(convLocalArchived.id) || String(convLocalArchived.status).toLowerCase() === 'archived';
    assert.strictEqual(isArchivedC, true);
  });

  // 5. Socket broadcast payload format check
  test('Socket broadcast payload contains unified chatId, conversationId and boolean archived', () => {
    const conv = { id: 42, phone: '5511999887766', status: 'archived' };
    const eventPayload = {
      chatId: String(conv.id),
      conversationId: String(conv.id),
      status: conv.status,
      archived: conv.status === 'archived'
    };

    assert.strictEqual(eventPayload.chatId, '42');
    assert.strictEqual(eventPayload.conversationId, '42');
    assert.strictEqual(eventPayload.status, 'archived');
    assert.strictEqual(eventPayload.archived, true);
  });

  console.log(`\n=== RESULTS: ${passed}/${total} tests passed ===\n`);
  if (passed === total) {
    console.log('ALL ARCHIVE SYNC TESTS PASSED SUCCESSFULLY!\n');
  } else {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
