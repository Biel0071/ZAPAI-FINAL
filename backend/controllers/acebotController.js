const acebot = require('../ai/acebot');

exports.runWorkflow = async (req, res) => {
  try {
    const output = await acebot.runWorkflow(req.body || {});
    return res.status(200).json({ success: true, output });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Failed to run acebot workflow.',
      details: error.message,
    });
  }
};

exports.createModule = async (req, res) => {
  try {
    const moduleName = String(req.body?.moduleName || '').trim();
    if (!moduleName) {
      return res.status(400).json({ success: false, error: 'moduleName is required.' });
    }

    const output = await acebot.createModule(moduleName);
    return res.status(200).json({ success: true, output });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Failed to create module via acebot.',
      details: error.message,
    });
  }
};

exports.startSelfImprovingMode = async (req, res) => {
  try {
    const intervalMs = Number(req.body?.intervalMs || 0) || undefined;
    const autoApply = req.body?.autoApply !== false;
    const smartDecisionMode = req.body?.smartDecisionMode === true;
    const output = await acebot.startSelfImprovingMode({ intervalMs, autoApply, smartDecisionMode });
    return res.status(200).json({ success: true, output });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Failed to start self-improving engine mode.',
      details: error.message,
    });
  }
};

exports.startSmartSelfImprovingMode = async (req, res) => {
  try {
    const statusOutput = await acebot.getSelfImprovingStatus();
    const isRunning = Boolean(statusOutput?.status?.active);

    if (isRunning) {
      return res.status(200).json({
        success: true,
        mode: 'self-improving',
        smartDecisionMode: true,
        running: true,
      });
    }

    const output = await acebot.startSmartSelfImprovingMode({
      intervalMs: 60000,
      autoApply: req.body?.autoApply,
    });

    console.log('[ENGINE] Smart self-improving mode activated');

    return res.status(200).json({
      success: true,
      mode: 'self-improving',
      smartDecisionMode: true,
      running: Boolean(output?.status?.active),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Failed to start smart self-improving engine mode.',
      details: error.message,
    });
  }
};

exports.stopSelfImprovingMode = async (_req, res) => {
  try {
    const output = await acebot.stopSelfImprovingMode();
    return res.status(200).json({ success: true, output });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Failed to stop self-improving engine mode.',
      details: error.message,
    });
  }
};

exports.getSelfImprovingStatus = async (_req, res) => {
  try {
    const output = await acebot.getSelfImprovingStatus();
    return res.status(200).json({ success: true, output });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch self-improving engine status.',
      details: error.message,
    });
  }
};

exports.runSelfImprovementCycle = async (req, res) => {
  try {
    const autoApply = req.body?.autoApply !== false;
    const smartDecisionMode = req.body?.smartDecisionMode === true;
    const output = await acebot.runSelfImprovementCycle({ autoApply, smartDecisionMode });
    return res.status(200).json({ success: true, output });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Failed to run self-improvement cycle.',
      details: error.message,
    });
  }
};
