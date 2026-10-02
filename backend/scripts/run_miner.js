const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const humanAttendanceLearner = require('../src/ai/evolutionary/humanAttendanceLearner');

async function run() {
  const stats = await humanAttendanceLearner.calculateAgentLevel({ companyId: 'default' });
  console.log('AGENT STATS:', JSON.stringify(stats, null, 2));
  const patterns = await humanAttendanceLearner.getLearnedPatterns({ companyId: 'default' });
  console.log('LEARNED PATTERNS COUNT:', patterns.length);
  console.log('SAMPLE LEARNED PATTERN:', JSON.stringify(patterns[0], null, 2));
  process.exit(0);
}

run().catch(err => {
  console.error('Miner error:', err);
  process.exit(1);
});
