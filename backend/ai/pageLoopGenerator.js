const { replicatePage } = require('./pageReplicator');

async function generatePages(pageNames = [], options = {}) {
  const templatePage = options.templatePage || 'Inbox';
  const results = [];

  for (const name of pageNames) {
    try {
      const replication = await replicatePage(templatePage, name);
      results.push({
        name,
        success: true,
        ...replication,
      });
    } catch (error) {
      results.push({
        name,
        success: false,
        error: error.message || String(error),
      });
    }
  }

  return results;
}

async function runFromCli() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.log('Usage: node ai/pageLoopGenerator.js Leads Campaigns Contacts Reports');
    process.exit(1);
  }

  const generated = await generatePages(args);
  console.log(JSON.stringify(generated, null, 2));
}

if (require.main === module) {
  runFromCli().catch((error) => {
    console.error('[pageLoopGenerator] failed:', error);
    process.exit(1);
  });
}

module.exports = {
  generatePages,
};
