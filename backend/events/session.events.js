/**
 * Domain Events — Session & WhatsApp Domain
 */

const SESSION_EVENTS = {
  CONNECTED: 'session.connected',
  DISCONNECTED: 'session.disconnected',
  RECONNECTING: 'session.reconnecting',
  QR_RECEIVED: 'session.qr_received',
};

module.exports = {
  SESSION_EVENTS,
};
