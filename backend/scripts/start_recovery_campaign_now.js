const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const campaignDispatchEngine = require('../services/campaignDispatchEngine');
const campaignRepository = require('../src/data/repositories/campaignRepository');

async function main() {
  const campaignId = process.argv[2] || 'cmp-recuperacao-02102026';
  console.log(`Iniciando disparo manual da campanha: ${campaignId}...`);

  const campaign = await campaignRepository.getCampaignById(campaignId, 'default');
  if (!campaign) {
    console.error(`Campanha ${campaignId} não encontrada!`);
    process.exit(1);
  }

  console.log(`Nome: "${campaign.name}"`);
  console.log(`Total de destinatários: ${campaign.selectedContacts?.length || 0}`);

  try {
    const result = await campaignDispatchEngine.startCampaign(campaignId, 'default', null);
    console.log('Resultado do início:', result);
    console.log('Acompanhe o status pelo dashboard em /campaigns ou via script de status.');
  } catch (err) {
    console.error('Erro ao iniciar campanha:', err.message);
  }

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
