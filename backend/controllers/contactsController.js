const conversationRepository = require('../repositories/conversationRepository');
const contactsService = require('../services/contactsService');

function getStore(req) {
  return req.app.locals.store;
}

async function listContacts(req, res) {
  const store = getStore(req);

  try {
    let conversations = [];

    if (store?.databaseEnabled) {
      conversations = await conversationRepository.listConversations(
        req.query?.companyId || process.env.DEFAULT_COMPANY_ID || 'default',
        Number(req.query?.limit) || 500
      );
    } else {
      conversations = Array.isArray(store?.conversations) ? store.conversations : [];
    }

    const contacts = contactsService.listContactsFromConversations(conversations);
    return res.status(200).json(contacts);
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to list contacts.' });
  }
}

module.exports = {
  listContacts,
};
