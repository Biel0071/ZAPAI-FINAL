'use strict';

const MAX_PROVABLE_AGE_MS = 10 * 60 * 1000;

/**
 * Decides whether a fromMe echo may be tagged as sent from the phone itself (blue bubble).
 * Conservative on purpose: a system message mislabelled as "phone" is worse than a phone
 * message left untagged. We never tag when
 *  - the system sent it (in-memory ids, ack pipeline or the persisted outbound queue), or
 *  - the message is old (history sync / after a restart the in-memory registry is empty and
 *    we cannot prove it was not ours).
 */
function shouldMarkWhatsappDevice({ isSystemSent, messageTimestampSec, now = Date.now() }) {
  if (isSystemSent) return false;
  const raw = typeof messageTimestampSec?.toNumber === 'function' ? messageTimestampSec.toNumber() : Number(messageTimestampSec);
  const ts = raw * 1000;
  if (!Number.isFinite(ts) || ts <= 0) return false;
  return now - ts <= MAX_PROVABLE_AGE_MS;
}

module.exports = { shouldMarkWhatsappDevice, MAX_PROVABLE_AGE_MS };
