/**
 * QR-code rendering helper for Baileys pairing.
 * Extracted from whatsappService.legacy.js (Phase 2a).
 */

const QRCode = require('qrcode');

async function toQrDataUrl(qr) {
  if (!qr) {
    return null;
  }

  return QRCode.toDataURL(qr, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 320,
  });
}

module.exports = {
  toQrDataUrl,
};
