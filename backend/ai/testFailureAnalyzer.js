function flattenFailures(report = {}) {
  return Array.isArray(report.failures) ? report.failures : [];
}

function detectKnownIssue(failures = []) {
  const combined = failures
    .map((item) => `${item.test || ''} ${item.message || ''}`.toLowerCase())
    .join(' ');

  if (combined.includes('/ai/project-status') && combined.includes('404')) {
    return {
      code: 'ROUTE_MISMATCH_AI_PROJECT_STATUS',
      probableCause: 'The AI project status endpoint is referenced by tests but route mapping is missing or outdated.',
      suggestedFix: 'Register GET /ai/project-status in routes/ai.js and connect it to aiController.projectStatus.',
    };
  }

  if (combined.includes('/chats') && combined.includes('404')) {
    return {
      code: 'ROUTE_MISMATCH_CHATS',
      probableCause: 'Chats endpoint mismatch between expected smoke test route and backend route registry.',
      suggestedFix: 'Add compatibility GET /chats route in messages routes and ensure server mounts it.',
    };
  }

  if (combined.includes('cannot find module')) {
    return {
      code: 'MISSING_IMPORT',
      probableCause: 'A required module is missing from dependencies or incorrect import path was introduced.',
      suggestedFix: 'Install missing dependency and verify import/require path.',
    };
  }

  if (combined.includes('frontend') && combined.includes('unavailable')) {
    return {
      code: 'FRONTEND_NOT_RUNNING',
      probableCause: 'Frontend dev server is not active on expected local ports.',
      suggestedFix: 'Start frontend with npm run dev and verify VITE host/port.',
    };
  }

  if (combined.includes('message_received event not observed')) {
    return {
      code: 'SOCKET_EVENT_MISSING_RECEIVED',
      probableCause: 'Realtime message receive event was not emitted or not consumed by socket client.',
      suggestedFix: 'Verify message:new/new_message emits and socket subscription lifecycle.',
    };
  }

  if (combined.includes('message_sent event not observed')) {
    return {
      code: 'SOCKET_EVENT_MISSING_SENT',
      probableCause: 'Realtime sent-message event was not emitted after reply simulation.',
      suggestedFix: 'Emit new_message for outbound flow and validate fromMe flag handling.',
    };
  }

  return {
    code: 'UNKNOWN',
    probableCause: 'No known automatic failure signature matched.',
    suggestedFix: 'Inspect detailed logs and failing test entries to identify root cause.',
  };
}

function analyzeTestFailures(report = {}, context = {}) {
  const failedTests = flattenFailures(report).map((item) => item.test || item.message || 'unknown');
  const issue = detectKnownIssue(flattenFailures(report));

  return {
    failedTests,
    probableCause: issue.probableCause,
    suggestedFix: issue.suggestedFix,
    knownIssueCode: issue.code,
    context,
  };
}

module.exports = {
  analyzeTestFailures,
};
