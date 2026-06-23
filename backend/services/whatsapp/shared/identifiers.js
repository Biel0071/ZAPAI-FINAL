/**
 * Pure identifier helpers for WhatsApp domain.
 * Extracted from whatsappService.legacy.js (Phase 2a).
 * No side effects; no module-scoped mutable state.
 */

const DEFAULT_SESSION = 'main';

function normalizeSessionName(sessionName = DEFAULT_SESSION) {
  const normalized = String(sessionName || DEFAULT_SESSION)
    .trim()
    .replace(/\s+/g, '_')
    .toLowerCase();

  return normalized || DEFAULT_SESSION;
}

function getCompanyId(companyId) {
  return companyId || process.env.DEFAULT_COMPANY_ID || 'default';
}

function isRawLid(phone) {
  if (!phone) return false;
  const str = String(phone).toLowerCase();
  return str.includes('@lid') || (/^15\d{13}$/.test(str.replace(/\D/g, '')));
}

function normalizePhone(phone = '') {
  const value = String(phone || '').trim();
  const lowerValue = value.toLowerCase();

  if (lowerValue.includes('@g.us')) {
    return lowerValue;
  }

  let clean = lowerValue;
  if (clean.includes('@')) {
    clean = clean.split('@')[0];
  }
  clean = clean.replace(/\D/g, '');

  const isLidDigits = /^15\d{13}$/.test(clean);

  if (isLidDigits || lowerValue.includes('@lid')) {
    const rawLid = clean;
    // 1. Check global map (populated from DB)
    if (global.lidToPhoneMap && global.lidToPhoneMap.has(rawLid)) {
      return normalizePhone(global.lidToPhoneMap.get(rawLid));
    }
    // 2. Check active sessions (in memory)
    try {
      const registry = require('../state/registry');
      if (registry && registry.activeSessions) {
        for (const session of Object.values(registry.activeSessions)) {
          const sock = session?.sock;
          const mapping = sock?.lidMapping;
          if (mapping) {
            let jid = null;
            if (mapping instanceof Map && mapping.has(rawLid)) {
              jid = mapping.get(rawLid);
            } else if (typeof mapping === 'object' && mapping[rawLid]) {
              jid = mapping[rawLid];
            }
            if (jid) {
              const mappedPhone = jid.split('@')[0];
              const lidMapper = require('./lidMapper');
              lidMapper.saveMapping(rawLid, mappedPhone).catch((err) => {
                console.error('[LID-RESOLVE] Async save mapping failed:', err);
              });
              return normalizePhone(mappedPhone);
            }
          }
          const store = session?.realtimeStore;
          if (store?.contacts) {
            for (const contact of Object.values(store.contacts)) {
              if (contact && (contact.lid === rawLid || contact.id === rawLid || contact.id === `${rawLid}@lid`)) {
                if (contact.id && contact.id.endsWith('@s.whatsapp.net')) {
                  const mappedPhone = contact.id.split('@')[0];
                  const lidMapper = require('./lidMapper');
                  lidMapper.saveMapping(rawLid, mappedPhone).catch((err) => {
                    console.error('[LID-RESOLVE] Async save mapping from contact failed:', err);
                  });
                  return normalizePhone(mappedPhone);
                }
              }
            }
          }
        }
      }
    } catch (err) {
      // ignore
    }

    return `${rawLid}@lid`;
  }

  if (clean.length === 10 || clean.length === 11) {
    if (!clean.startsWith('55')) {
      clean = '55' + clean;
    }
  }
  return clean;
}

function getPhoneAliases(phone = '') {
  const normalized = normalizePhone(phone);
  if (!normalized) {
    return [];
  }

  const aliases = new Set([normalized]);

  if (normalized.endsWith('@g.us')) {
    return Array.from(aliases);
  }

  const digits = normalized.replace(/\D/g, '');
  if (!digits) {
    return Array.from(aliases);
  }

  if (normalized.endsWith('@lid')) {
    aliases.add(digits);
  } else if (digits.length >= 14 && !digits.startsWith('55')) {
    aliases.add(`${digits}@lid`);
  }

  return Array.from(aliases);
}


function normalizeWhatsappJid(phone = '') {
  const value = String(phone || '').trim();
  if (!value) {
    throw new Error('JID inválido: número de telefone vazio');
  }

  if (value.endsWith('@g.us') || value.endsWith('@lid')) {
    return value.toLowerCase();
  }

  let clean = value;
  if (clean.includes('@')) {
    clean = clean.split('@')[0];
  }

  // Remove + spaces ( ) -
  clean = clean.replace(/[+\s().-]/g, '');

  if (!clean || !/^\d+$/.test(clean)) {
    throw new Error('JID inválido: o número de telefone está vazio ou contém caracteres inválidos');
  }

  if (clean.length >= 14 && !clean.startsWith('55')) {
    return `${clean}@lid`;
  }

  return `${clean}@s.whatsapp.net`;
}

function ensureWhatsAppJid(phone = '') {
  return normalizeWhatsappJid(phone);
}

module.exports = {
  DEFAULT_SESSION,
  ensureWhatsAppJid,
  getCompanyId,
  getPhoneAliases,
  normalizePhone,
  normalizeSessionName,
  normalizeWhatsappJid,
  isRawLid,
};
