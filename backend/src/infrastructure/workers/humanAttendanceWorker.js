/**
 * Background Worker — Continuous Human Attendance & Evolution Worker
 * Periodically mines new human operator responses to continuously level up the AI agent.
 */

const humanAttendanceLearner = require('../../ai/evolutionary/humanAttendanceLearner');

let isRunning = false;

async function processHumanAttendanceLearning(companyId = 'default') {
  if (isRunning) return;
  isRunning = true;

  try {
    const result = await humanAttendanceLearner.mineAndEvolveFromManualAttendance({
      companyId: String(companyId || 'default'),
      limit: 100,
    });

    if (result && result.newSamplesLearned > 0) {
      console.log(`[HUMAN-ATTENDANCE-WORKER] Evolução concluída: +${result.newSamplesLearned} novos aprendizados humanos assimilados.`);
    }
  } catch (err) {
    console.error('[HUMAN-ATTENDANCE-WORKER] Erro no ciclo de aprendizado contínuo:', err.message);
  } finally {
    isRunning = false;
  }
}

module.exports = {
  processHumanAttendanceLearning,
  runHumanAttendanceLearningCycle: processHumanAttendanceLearning,
};
