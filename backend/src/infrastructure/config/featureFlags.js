/**
 * Feature Flags Configuration — Enterprise Sync Engine
 * Allows real-time dynamic activation & instant rollback without application restart.
 */

const featureFlags = {
  ENABLE_SYNC_ENGINE: process.env.ENABLE_SYNC_ENGINE === 'true' || true,
  ENABLE_EVENT_BUS: process.env.ENABLE_EVENT_BUS === 'true' || true,
  ENABLE_EVENT_STORE: process.env.ENABLE_EVENT_STORE === 'true' || false,
  ENABLE_TRACING: process.env.ENABLE_TRACING === 'true' || true,
  ENABLE_SYNC_CENTER: process.env.ENABLE_SYNC_CENTER === 'true' || true,
  ENABLE_REPLAY: process.env.ENABLE_REPLAY === 'true' || false,
  ENABLE_DLQ: process.env.ENABLE_DLQ === 'true' || true,
  ENABLE_METRICS: process.env.ENABLE_METRICS === 'true' || true,
};

function getFlags() {
  return { ...featureFlags };
}

function setFlag(flagName, value) {
  if (flagName in featureFlags) {
    featureFlags[flagName] = Boolean(value);
    console.log(`[FEATURE_FLAGS] Flag '${flagName}' alterada para ${featureFlags[flagName]}`);
    return true;
  }
  return false;
}

function isEnabled(flagName) {
  return Boolean(featureFlags[flagName]);
}

module.exports = {
  getFlags,
  isEnabled,
  setFlag,
};
