const { analyzeProject } = require('./projectAnalyzer');
const { refreshPipeline, listPipeline } = require('./devPipeline');
const { replicatePage } = require('./pageReplicator');

function extractPageName(question) {
  const text = String(question || '');
  const match = text.match(/create\s+(?:a\s+)?([a-z0-9_-]+)\s+page/i);
  if (!match) return null;

  const raw = match[1];
  return raw
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join('');
}

async function answerQuestion(question, options = {}) {
  const text = String(question || '').trim();
  if (!text) {
    return {
      answer: 'Please ask a project question.',
      data: null,
    };
  }

  const normalized = text.toLowerCase();

  if (normalized.includes('missing page')) {
    const analysis = await analyzeProject({ autoCreateMissingPages: false });
    return {
      answer: `Missing pages: ${analysis.missingPages.length}`,
      data: { missingPages: analysis.missingPages },
    };
  }

  if (normalized.includes('api') && normalized.includes('not implemented')) {
    const analysis = await analyzeProject({ autoCreateMissingPages: false });
    return {
      answer: `APIs not implemented: ${analysis.missingApis.length}`,
      data: { missingApis: analysis.missingApis },
    };
  }

  const requestedPage = extractPageName(text);
  if (requestedPage) {
    const result = await replicatePage(options.templatePage || 'Inbox', requestedPage);
    const refreshed = await refreshPipeline({ autoCreateMissingPages: false });

    return {
      answer: `Page ${requestedPage} created and router updated.`,
      data: {
        createdPage: requestedPage,
        replication: result,
        pipelineTasks: refreshed.pipeline,
      },
    };
  }

  if (normalized.includes('pipeline')) {
    const refreshed = await refreshPipeline({ autoCreateMissingPages: false });
    return {
      answer: `Pipeline has ${refreshed.pipeline.length} tasks.`,
      data: { pipeline: refreshed.pipeline },
    };
  }

  const analysis = await analyzeProject({ autoCreateMissingPages: false });
  const pipeline = listPipeline();

  return {
    answer: 'Project analyzed. Ask about missing pages, missing APIs, pipeline, or ask to create a page.',
    data: {
      missingPages: analysis.missingPages,
      missingApis: analysis.missingApis,
      pipeline,
    },
  };
}

module.exports = {
  answerQuestion,
};
