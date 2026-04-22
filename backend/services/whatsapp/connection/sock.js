/**
 * Baileys `sock` inspection helpers.
 * Extracted from whatsappService.legacy.js (Phase 2a).
 */

function sessionPhoneFromSock(sock) {
  const userId = sock?.user?.id;

  if (!userId) {
    return null;
  }

  return String(userId).split(':')[0] || null;
}

module.exports = {
  sessionPhoneFromSock,
};
