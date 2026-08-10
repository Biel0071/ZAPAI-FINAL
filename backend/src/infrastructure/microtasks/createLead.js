const contactRepository = require('../../data/repositories/contactRepository');

async function runTask(payload = {}) {
  const companyId = payload.companyId || process.env.DEFAULT_COMPANY_ID || 'default';
  let contact = await contactRepository.findContactByPhone(payload.phone, companyId);

  if (!contact) {
    contact = await contactRepository.createContact({
      companyId,
      name: payload.name,
      phone: payload.phone,
    });
  }

  if (payload.name && payload.name !== 'Unknown' && contact.name !== payload.name) {
    contact = await contactRepository.updateContactName(payload.phone, payload.name, companyId);
  }

  return {
    ...payload,
    companyId,
    contact,
  };
}

module.exports = { runTask };
