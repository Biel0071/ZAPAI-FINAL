const testRunnerEngine = require('../services/testRunnerEngine');
const testGeneratorService = require('../services/testGeneratorService');

async function listSuites(_req, res) {
  try {
    const suites = testRunnerEngine.getSuitesOverview();
    return res.status(200).json({
      success: true,
      data: suites,
    });
  } catch (error) {
    console.error('[TESTS_CTRL] Error listing suites:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Erro ao listar suítes de teste',
    });
  }
}

async function runTests(req, res) {
  try {
    const { suiteIds } = req.body || {};
    const result = await testRunnerEngine.runTestSuites(suiteIds);
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('[TESTS_CTRL] Error running tests:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Erro ao executar suítes de teste',
    });
  }
}

async function generateScript(req, res) {
  try {
    const { suiteId } = req.body || {};
    if (suiteId) {
      const generated = testGeneratorService.generateVitestScript(suiteId);
      return res.status(200).json({
        success: true,
        data: [generated],
      });
    }

    const allGenerated = testGeneratorService.generateAllScripts();
    return res.status(200).json({
      success: true,
      data: allGenerated,
    });
  } catch (error) {
    console.error('[TESTS_CTRL] Error generating scripts:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Erro ao gerar scripts de teste',
    });
  }
}

async function getGraph(_req, res) {
  try {
    const history = testRunnerEngine.getRunHistory();
    const latestRun = history[0];
    if (latestRun) {
      return res.status(200).json({
        success: true,
        data: latestRun.graph,
      });
    }

    // Executa uma primeira rodada se não houver histórico
    const freshRun = await testRunnerEngine.runTestSuites();
    return res.status(200).json({
      success: true,
      data: freshRun.graph,
    });
  } catch (error) {
    console.error('[TESTS_CTRL] Error getting test graph:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Erro ao obter grafo de testes',
    });
  }
}

async function getHistory(_req, res) {
  try {
    const history = testRunnerEngine.getRunHistory();
    return res.status(200).json({
      success: true,
      data: history,
    });
  } catch (error) {
    console.error('[TESTS_CTRL] Error getting history:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Erro ao obter histórico de testes',
    });
  }
}

module.exports = {
  listSuites,
  runTests,
  generateScript,
  getGraph,
  getHistory,
};
