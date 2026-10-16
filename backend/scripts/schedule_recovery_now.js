const { query } = require('../src/infrastructure/config/database');

async function main() {
  console.log('--- Scheduling Recovery Campaign Now ---');
  const campaignId = 'cmp-recuperacao-02102026';

  const campRes = await query("SELECT * FROM campaigns WHERE id = $1", [campaignId]);
  if (campRes.rows.length === 0) {
    console.error(`Campaign ${campaignId} not found.`);
    process.exit(1);
  }

  const camp = campRes.rows[0];
  const contacts = Array.isArray(camp.selected_contacts) ? camp.selected_contacts : [];
  console.log(`Campaign ${campaignId} has ${contacts.length} contacts.`);

  const settings = {
    ...(camp.settings || {}),
    startAt: new Date(Date.now() - 10000).toISOString(), // 10 seconds ago so scheduler picks it immediately
    scheduledAt: new Date(Date.now() - 10000).toISOString(),
    intervalSeconds: 115,
    randomDelayMin: 85000,
    randomDelayMax: 140000,
    typingDelaySeconds: 9,
    typingDelayMinSeconds: 6,
    typingDelayMaxSeconds: 12,
    pauseEvery: 7,
    pauseEveryMin: 6,
    pauseEveryMax: 8,
    pauseSeconds: 180,
    pauseMinSeconds: 150,
    pauseMaxSeconds: 240,
    cadenceMode: 'safe',
    enableAIPostDispatch: true,
  };

  const queue = {
    total: contacts.length,
    sent: 0,
    failed: 0,
    processed: 0,
    paused: false,
    sentContactIds: []
  };

  await query(`
    UPDATE campaigns 
    SET status = 'scheduled',
        settings = $1::jsonb,
        queue = $2::jsonb,
        started_at = NULL,
        completed_at = NULL,
        updated_at = NOW()
    WHERE id = $3
  `, [JSON.stringify(settings), JSON.stringify(queue), campaignId]);

  console.log(`✅ Campaign ${campaignId} set to 'scheduled' with startAt <= NOW().`);
  console.log('The campaign scheduler in PM2 will pick it up on the next minute tick.');

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
