function analyzeErrorEntry(errorEntry = {}) {
  const message = String(errorEntry.error || '').toLowerCase();
  const stack = String(errorEntry.stack || '').toLowerCase();
  const combined = `${message} ${stack}`;

  if (combined.includes('cannot find module') || combined.includes('failed to resolve import')) {
    return {
      probableCause: 'Missing import or broken module path in frontend bundle.',
      suggestedFix: 'Create missing file/export or adjust import path to an existing module.',
    };
  }

  if (combined.includes('404') || combined.includes('route not found') || combined.includes('failed to fetch')) {
    return {
      probableCause: 'API failure caused by route mismatch or unavailable backend endpoint.',
      suggestedFix: 'Add/fix backend route mapping and validate frontend endpoint path.',
    };
  }

  if (combined.includes('cannot read properties of undefined') || combined.includes('is not a function')) {
    return {
      probableCause: 'Component runtime crash from unexpected null/undefined data or wrong prop contract.',
      suggestedFix: 'Add null guards and validate response shape before rendering.',
    };
  }

  if (combined.includes('chunkloaderror') || combined.includes('loading chunk')) {
    return {
      probableCause: 'Frontend chunk load mismatch after deployment or cache stale assets.',
      suggestedFix: 'Force reload client assets and ensure build artifact/version alignment.',
    };
  }

  return {
    probableCause: 'Unknown runtime error signature.',
    suggestedFix: 'Inspect stack trace and latest code diff for the failing page/component.',
  };
}

function analyzeErrorLogs(errorLogs = []) {
  const latest = Array.isArray(errorLogs) && errorLogs.length > 0 ? errorLogs[0] : {};
  return analyzeErrorEntry(latest);
}

module.exports = {
  analyzeErrorEntry,
  analyzeErrorLogs,
};
