'use strict';

/**
 * Mirrors real WhatsApp (Business) labels into conversations.whatsapp_labels
 * (source = 'whatsapp'). System/funnel tags live in conversations.tags and are
 * the ONLY thing the AI edits, so WA labels can never be removed by the AI.
 *
 * Baileys emits:
 *   labels.edit        { id, name, color, deleted }
 *   labels.association { type: 'add' | 'remove', association: { type: 'label_jid' | 'label_message', chatId, labelId } }
 */

const WPP_LABEL_COLORS = [
  '#00d26a', '#5ac8fa', '#5856d6', '#ff2d55', '#ff9500',
  '#ffcc00', '#af52de', '#ff3b30', '#007aff', '#34c759',
  '#a2845e', '#8e8e93', '#d1d1d6', '#e5e5ea', '#1c1c1e',
  '#2c2c2e', '#3a3a3c', '#48484a', '#636366', '#8e8e93'
];

const placeholderName = (labelId) => `Etiqueta ${labelId}`;

function defaultDeps() {
  return {
    query: require('../../src/infrastructure/config/database').query,
    conversationRepository: require('../../src/data/repositories/conversationRepository')
  };
}

function emitConversation(io, conversation) {
  if (!io || !conversation) return;
  io.emit('conversation:update', conversation);
  io.emit('conversation_updated', conversation);
}

async function handleLabelEdit(label, ctx, deps = defaultDeps()) {
  if (!label?.id) return null;
  const { companyId, sessionId, io } = ctx;
  const id = String(label.id);
  const name = String(label.name || '').trim();
  const color = Number.isInteger(label.color) ? label.color : 0;
  const colorHex = WPP_LABEL_COLORS[color] || WPP_LABEL_COLORS[0];
  const deleted = Boolean(label.deleted);

  const prev = await deps.query(
    'SELECT name FROM whatsapp_labels WHERE id = $1 AND company_id = $2 AND session_id = $3 LIMIT 1',
    [id, companyId, sessionId]
  );
  const oldName = prev.rows?.[0]?.name || placeholderName(id);

  await deps.query(
    `INSERT INTO whatsapp_labels (id, company_id, session_id, name, color, color_hex, deleted, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
     ON CONFLICT (company_id, session_id, id)
     DO UPDATE SET name = EXCLUDED.name, color = EXCLUDED.color, color_hex = EXCLUDED.color_hex, deleted = EXCLUDED.deleted, updated_at = NOW()`,
    [id, companyId, sessionId, name, color, colorHex, deleted]
  );

  // Keep the mirror consistent with renames (and placeholders created before the name arrived) / deletions.
  if (deleted && oldName) {
    await deps.query(
      'UPDATE conversations SET whatsapp_labels = array_remove(whatsapp_labels, $1) WHERE company_id = $2 AND session_id = $3 AND $1 = ANY(whatsapp_labels)',
      [oldName, companyId, sessionId]
    );
  } else if (name && oldName && name !== oldName) {
    await deps.query(
      'UPDATE conversations SET whatsapp_labels = array_replace(whatsapp_labels, $1, $2) WHERE company_id = $3 AND session_id = $4 AND $1 = ANY(whatsapp_labels)',
      [oldName, name, companyId, sessionId]
    );
  }

  deps.conversationRepository.invalidateConversationCache?.(companyId);
  if (io) {
    io.emit('whatsapp:labels_updated', { companyId, sessionId, label: { id, name, color, colorHex, deleted } });
  }
  return { id, name, colorHex, deleted };
}

/**
 * @returns {Promise<object|null>} updated conversation or null when ignored
 */
async function handleLabelAssociation(evt, ctx, deps = defaultDeps()) {
  const action = evt?.type; // 'add' | 'remove'
  const association = evt?.association;
  if (action !== 'add' && action !== 'remove') return null;
  if (association?.type !== 'label_jid') return null; // message labels are not mirrored
  const { labelId, chatId } = association;
  if (!labelId || !chatId) return null;
  const { companyId, sessionId, io } = ctx;

  const lbl = await deps.query(
    'SELECT name, deleted FROM whatsapp_labels WHERE id = $1 AND company_id = $2 AND session_id = $3 LIMIT 1',
    [String(labelId), companyId, sessionId]
  );
  if (lbl.rows?.[0]?.deleted) return null;
  const labelName = lbl.rows?.[0]?.name || placeholderName(labelId);

  const conv = await deps.conversationRepository.getConversationByPhone(chatId, companyId, sessionId);
  if (!conv) return null;

  const current = Array.isArray(conv.whatsappLabels) ? conv.whatsappLabels : [];
  if (action === 'add' && current.includes(labelName)) return conv;
  if (action === 'remove' && !current.includes(labelName)) return conv;

  const res = await deps.query(
    action === 'add'
      ? `UPDATE conversations SET whatsapp_labels = array_append(whatsapp_labels, $1), updated_at = updated_at
           WHERE id = $2 AND company_id = $3 AND NOT ($1 = ANY(whatsapp_labels)) RETURNING id`
      : `UPDATE conversations SET whatsapp_labels = array_remove(whatsapp_labels, $1), updated_at = updated_at
           WHERE id = $2 AND company_id = $3 RETURNING id`,
    [labelName, conv.id, companyId]
  );
  if (!res.rows?.length) return conv;

  deps.conversationRepository.invalidateConversationCache?.(companyId);
  const updated = await deps.conversationRepository.getConversationById(conv.id, companyId);
  emitConversation(io, updated);
  return updated;
}

/** Pure mapper for an app-state quick_reply action (shortcut + message). */
function mapQuickReplyAction(action = {}) {
  const shortcut = String(action.shortcut || '').replace(/^\/+/, '').trim();
  const message = String(action.message || '').trim();
  if (!shortcut || !message) return null;
  return { shortcut, message, keywords: Array.isArray(action.keywords) ? action.keywords.map(String) : [] };
}

module.exports = { handleLabelEdit, handleLabelAssociation, mapQuickReplyAction, placeholderName, WPP_LABEL_COLORS };
