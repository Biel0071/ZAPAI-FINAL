const cron = require('node-cron');

function normalizeQuestion(text = '') {
  return String(text)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s?]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function groupMessagesByConversation(messages = []) {
  return messages.reduce((accumulator, message) => {
    const conversationId = `${message.sessionId || 'default'}:${message.phone}`;

    if (!accumulator[conversationId]) {
      accumulator[conversationId] = [];
    }

    accumulator[conversationId].push(message);
    return accumulator;
  }, {});
}

function buildSuggestion(issueType, conversationId, details = {}) {
  const templates = {
    customer_drop_off: {
      suggestedNewFlow: 'Criar uma retomada automática após inatividade com reforço de confiança e próximo passo claro.',
      suggestedPromptImprovement: 'Orientar a IA a confirmar interesse, prazo da obra e modalidade de entrega antes de encerrar a conversa.',
      suggestedResponse: 'Posso retomar seu orçamento e organizar retirada ou entrega para você. Quais itens e quantidades deseja confirmar?',
    },
    failed_conversation: {
      suggestedNewFlow: 'Adicionar validação de objeção e confirmação de entendimento antes de apresentar o fechamento.',
      suggestedPromptImprovement: 'Orientar a IA a reconhecer sinais de frustração e oferecer solução prática em até 3 frases.',
      suggestedResponse: 'Entendi sua dúvida e posso reorganizar o atendimento com mais clareza. Deseja que eu refaça o orçamento de forma objetiva?',
    },
    frequently_asked_question: {
      suggestedNewFlow: 'Criar resposta padrão reaproveitável para perguntas recorrentes com CTA para orçamento.',
      suggestedPromptImprovement: 'Adicionar instrução para responder perguntas frequentes com resposta curta, prova de confiança e próxima pergunta comercial.',
      suggestedResponse: details.question || 'Posso esclarecer essa informação e já organizar seu orçamento. Qual item e quantidade você precisa?',
    },
    lost_lead: {
      suggestedNewFlow: 'Inserir etapa de recuperação de lead com lembrete de nota fiscal, garantia e opções de retirada ou entrega.',
      suggestedPromptImprovement: 'Orientar a IA a retomar leads sem resposta com uma pergunta simples de avanço do pedido.',
      suggestedResponse: 'Posso retomar seu atendimento e deixar seu pedido organizado com transparência e garantia. Prefere retirada ou entrega?',
    },
    unanswered_question: {
      suggestedNewFlow: 'Criar resposta rápida para perguntas sem retorno em até uma interação.',
      suggestedPromptImprovement: 'Orientar a IA a priorizar mensagens com interrogação e responder objetivamente antes de avançar no fluxo.',
      suggestedResponse: 'Posso te responder com precisão e já seguir com o orçamento. Quais itens e quantidades deseja cotar?',
    },
  };

  const template = templates[issueType];

  return {
    conversationId,
    createdAt: new Date().toISOString(),
    id: `ail-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    issueType,
    problemDetected: details.problemDetected,
    status: 'pending',
    suggestedImprovement: {
      suggestedNewFlow: details.suggestedNewFlow || template.suggestedNewFlow,
      suggestedPromptImprovement:
        details.suggestedPromptImprovement || template.suggestedPromptImprovement,
      suggestedResponse: details.suggestedResponse || template.suggestedResponse,
    },
  };
}

function collectFrequentQuestions(messages = []) {
  const questions = messages
    .filter((message) => message.from === 'client')
    .map((message) => message.text)
    .filter((text) => text && text.includes('?'))
    .map(normalizeQuestion)
    .filter(Boolean);

  const counter = new Map();
  for (const question of questions) {
    counter.set(question, (counter.get(question) || 0) + 1);
  }

  return [...counter.entries()]
    .filter(([, count]) => count > 1)
    .sort((a, b) => b[1] - a[1])
    .map(([question, count]) => ({ count, question }));
}

function analyzeConversationsSnapshot(messages = [], conversations = []) {
  const grouped = groupMessagesByConversation(messages);
  const issues = [];
  const dropPoints = [];
  let missingResponses = 0;
  let lostLeads = 0;
  let failedConversations = 0;
  let answeredConversations = 0;

  for (const [conversationId, entries] of Object.entries(grouped)) {
    const sortedEntries = [...entries].sort(
      (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
    );

    const hasAgentReply = sortedEntries.some((message) => message.from === 'agent');
    const lastMessage = sortedEntries[sortedEntries.length - 1];
    const lastClientQuestion = [...sortedEntries]
      .reverse()
      .find((message) => message.from === 'client' && String(message.text || '').includes('?'));

    if (hasAgentReply) {
      answeredConversations += 1;
    }

    if (lastClientQuestion && (!lastMessage || lastMessage.from !== 'agent')) {
      missingResponses += 1;
      issues.push(
        buildSuggestion('unanswered_question', conversationId, {
          problemDetected: `Pergunta sem resposta detectada: ${lastClientQuestion.text}`,
        })
      );
    }

    if (!hasAgentReply && sortedEntries.filter((message) => message.from === 'client').length >= 2) {
      lostLeads += 1;
      issues.push(
        buildSuggestion('lost_lead', conversationId, {
          problemDetected: 'Lead enviou múltiplas mensagens e não recebeu continuidade adequada.',
        })
      );
    }

    const complaintMessage = sortedEntries.find(
      (message) =>
        message.from === 'client' &&
        /(não respondeu|demorou|caro|ruim|péssimo|problema|não atualizou)/i.test(
          message.text || ''
        )
    );

    if (complaintMessage) {
      failedConversations += 1;
      issues.push(
        buildSuggestion('failed_conversation', conversationId, {
          problemDetected: `Conversa com sinal de falha: ${complaintMessage.text}`,
        })
      );
    }

    if (lastMessage?.from === 'agent') {
      const clientCount = sortedEntries.filter((message) => message.from === 'client').length;
      const agentCount = sortedEntries.filter((message) => message.from === 'agent').length;

      if (clientCount > 0 && agentCount > 0) {
        dropPoints.push({
          conversationId,
          phone: lastMessage.phone,
          reason: 'Cliente parou após resposta do agente.',
          timestamp: lastMessage.timestamp,
        });
        issues.push(
          buildSuggestion('customer_drop_off', conversationId, {
            problemDetected: 'Cliente interrompeu a conversa após uma resposta do agente.',
          })
        );
      }
    }
  }

  const frequentQuestions = collectFrequentQuestions(messages);
  for (const question of frequentQuestions) {
    issues.push(
      buildSuggestion('frequently_asked_question', `faq:${question.question}`, {
        problemDetected: `Pergunta frequente detectada ${question.count} vezes.`,
        question: question.question,
      })
    );
  }

  const uniqueIssues = [];
  const seen = new Set();
  for (const issue of issues) {
    const key = `${issue.conversationId}:${issue.issueType}:${issue.problemDetected}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    uniqueIssues.push(issue);
  }

  const totalConversationsAnalyzed = conversations.length || Object.keys(grouped).length;
  const conversionRate = totalConversationsAnalyzed
    ? Number(((answeredConversations / totalConversationsAnalyzed) * 100).toFixed(2))
    : 0;

  return {
    conversationDropPoints: dropPoints,
    frequentCustomerQuestions: frequentQuestions,
    issues: uniqueIssues,
    metrics: {
      conversionRate,
      lostLeads,
      missingResponses,
      promptImprovementsApplied: 0,
      totalConversationsAnalyzed,
    },
  };
}

async function analyzeAndStore(store) {
  const analysis = analyzeConversationsSnapshot(store.messages, store.conversations);
  const appliedCount = (store.aiLearningLogs || []).filter((log) => log.status === 'applied').length;
  analysis.metrics.promptImprovementsApplied = appliedCount;

  const existingKeys = new Set(
    (store.aiLearningLogs || []).map(
      (log) => `${log.conversationId}:${log.issueType}:${log.problemDetected}`
    )
  );

  const newIssues = analysis.issues.filter((issue) => {
    const key = `${issue.conversationId}:${issue.issueType}:${issue.problemDetected}`;
    return !existingKeys.has(key);
  });

  store.aiLearningLogs = [...(store.aiLearningLogs || []), ...newIssues];

  if (typeof store.saveAiState === 'function') {
    await store.saveAiState();
  }

  return {
    ...analysis,
    issues: store.aiLearningLogs,
    metrics: {
      ...analysis.metrics,
      promptImprovementsApplied: (store.aiLearningLogs || []).filter(
        (log) => log.status === 'applied'
      ).length,
    },
  };
}

function buildDashboard(store) {
  const analysis = analyzeConversationsSnapshot(store.messages, store.conversations);

  return {
    conversationDropPoints: analysis.conversationDropPoints,
    dailyDetectedIssues: (store.aiLearningLogs || []).filter((issue) => {
      const today = new Date().toISOString().slice(0, 10);
      return String(issue.createdAt || '').startsWith(today);
    }),
    frequentCustomerQuestions: analysis.frequentCustomerQuestions,
    metrics: {
      ...analysis.metrics,
      promptImprovementsApplied: (store.aiLearningLogs || []).filter(
        (log) => log.status === 'applied'
      ).length,
    },
    promptHistory: store.promptHistory || [],
    suggestions: store.aiLearningLogs || [],
  };
}

function startDailyAnalysis(store) {
  return cron.schedule(
    '0 2 * * *',
    () => {
      analyzeAndStore(store).catch((error) => {
        console.error('[AI LEARNING] Daily analysis failed:', error.message);
      });
    },
    {
      scheduled: true,
      timezone: 'America/Sao_Paulo',
    }
  );
}

module.exports = {
  analyzeAndStore,
  buildDashboard,
  startDailyAnalysis,
};
