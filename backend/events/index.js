const { MESSAGE_EVENTS } = require('./message.events');
const { CONVERSATION_EVENTS } = require('./conversation.events');
const { CONTACT_EVENTS } = require('./contact.events');
const { CAMPAIGN_EVENTS } = require('./campaign.events');
const { AUTOMATION_EVENTS } = require('./automation.events');
const { AI_EVENTS } = require('./ai.events');
const { SESSION_EVENTS } = require('./session.events');
const { SYSTEM_EVENTS } = require('./system.events');

module.exports = {
  ...MESSAGE_EVENTS,
  ...CONVERSATION_EVENTS,
  ...CONTACT_EVENTS,
  ...CAMPAIGN_EVENTS,
  ...AUTOMATION_EVENTS,
  ...AI_EVENTS,
  ...SESSION_EVENTS,
  ...SYSTEM_EVENTS,
  DOMAINS: {
    MESSAGE_EVENTS,
    CONVERSATION_EVENTS,
    CONTACT_EVENTS,
    CAMPAIGN_EVENTS,
    AUTOMATION_EVENTS,
    AI_EVENTS,
    SESSION_EVENTS,
    SYSTEM_EVENTS,
  },
};
