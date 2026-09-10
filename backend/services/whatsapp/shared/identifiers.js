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
  return str.includes('@lid') || (/^\d{15}$/.test(str.replace(/\D/g, '')));
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

  const isLidDigits = /^\d{15}$/.test(clean);

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

  // Brazilian mobile number 9th digit and DDD aliasing:
  // Country code 55 + 2-digit DDD + 8 or 9 digits.
  // 13 digits (with 9th digit '9'): 55 + DD + 9 + 8 digits -> e.g. 5531993807167
  // 12 digits (without 9th digit): 55 + DD + 8 digits -> e.g. 553193807167
  if (digits.startsWith('55')) {
    const ddd = digits.slice(2, 4);
    if (digits.length === 13 && digits[4] === '9') {
      const eightDigit = `55${ddd}${digits.slice(5)}`;
      aliases.add(eightDigit);
      // Also add local variants without country code 55
      aliases.add(digits.slice(2)); // e.g. 31993807167
      aliases.add(`${ddd}${digits.slice(5)}`); // e.g. 3193807167
      if (normalized.includes('@')) {
        aliases.add(`${eightDigit}@s.whatsapp.net`);
      }
    } else if (digits.length === 12) {
      const nineDigit = `55${ddd}9${digits.slice(4)}`;
      aliases.add(nineDigit);
      // Also add local variants without country code 55
      aliases.add(digits.slice(2)); // e.g. 3193807167
      aliases.add(`${ddd}9${digits.slice(4)}`); // e.g. 31993807167
      if (normalized.includes('@')) {
        aliases.add(`${nineDigit}@s.whatsapp.net`);
      }
    }
  }

  return Array.from(aliases);
}


function normalizeWhatsappJid(phone = '') {
  const value = String(phone || '').trim();
  if (!value) {
    throw new Error('JID inválido: número de telefone vazio');
  }

  if (value.endsWith('@g.us')) {
    return value.toLowerCase();
  }

  if (value.endsWith('@lid')) {
    // LID is the actual chat address used by current WhatsApp multi-device
    // sessions. Converting it back to a phone JID can make Baileys accept the
    // send locally without WhatsApp ever acknowledging delivery.
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

  if ((clean.length === 10 || clean.length === 11) && !clean.startsWith('55')) {
    clean = `55${clean}`;
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
