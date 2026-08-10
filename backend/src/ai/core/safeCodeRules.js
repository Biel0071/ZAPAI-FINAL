const SAFE_CODE_RULES = {
  allow: [
    'create-file',
    'update-file',
    'register-route',
    'register-sidebar',
    'register-api',
  ],
  deny: [
    'delete-file',
    'rm -rf',
    'remove-folder',
    'git reset --hard',
    'drop-table',
  ],
};

function isAllowedOperation(operation) {
  return SAFE_CODE_RULES.allow.includes(String(operation || '').trim());
}

function isDeniedText(content) {
  const normalized = String(content || '').toLowerCase();
  return SAFE_CODE_RULES.deny.some((entry) => normalized.includes(entry));
}

module.exports = {
  SAFE_CODE_RULES,
  isAllowedOperation,
  isDeniedText,
};
