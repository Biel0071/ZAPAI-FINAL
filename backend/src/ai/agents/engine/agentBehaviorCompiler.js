'use strict';

const PERSONALITIES = Object.freeze({
  executivo_direto: {
    id: 'executivo_direto',
    label: 'Executivo e Direto',
    summary: 'Respostas curtas, objetividade máxima, foco em fechamento e mínima contextualização.',
    recommendedTone: 'objetivo',
    recommendedResponseStyle: 'short_natural',
    recommendedTemperature: 0.35,
    promptDirectives: [
      'Responda de forma executiva, direta e objetiva, indo logo para a resposta principal sem rodeios.',
      'Evite contextualizações longas ou introduções repetitivas; apresente preço, prazo ou condição diretamente.',
      'Conclua com uma chamada objetiva de próximo passo ou fechamento.',
    ],
  },
  analitico_dados: {
    id: 'analitico_dados',
    label: 'Analítico e Orientado a Dados',
    summary: 'Mais análise, comparações claras, argumentação baseada nas informações disponíveis e detalhamento quando necessário.',
    recommendedTone: 'profissional',
    recommendedResponseStyle: 'detailed',
    recommendedTemperature: 0.45,
    promptDirectives: [
      'Adote postura analítica: estruture a resposta com comparações claras entre opções, prós, valores, prazos ou cálculos exatos.',
      'Baseie cada argumento exclusivamente nos dados oficiais disponíveis do catálogo, loja e histórico da conversa.',
      'Quando houver múltiplas opções ou condições de pagamento, compare-as de forma organizada para apoiar a decisão do cliente.',
    ],
  },
  consultivo_amigavel: {
    id: 'consultivo_amigavel',
    label: 'Consultivo e Amigável',
    summary: 'Linguagem acolhedora, explicações didáticas, identificação de necessidades e orientação passo a passo.',
    recommendedTone: 'acolhedor',
    recommendedResponseStyle: 'balanced',
    recommendedTemperature: 0.7,
    promptDirectives: [
      'Mantenha linguagem acolhedora, humana, empática e acessível.',
      'Investigue e confirme a necessidade real do cliente antes de empurrar uma oferta, orientando passo a passo.',
      'Explique condições, diferenças entre opções e próximos passos com clareza e cordialidade.',
    ],
  },
  operacional_diagnostico: {
    id: 'operacional_diagnostico',
    label: 'Operacional e Diagnóstico',
    summary: 'Identificação estruturada de problemas, procedimentos, verificação de dados e respostas técnicas.',
    recommendedTone: 'tecnico',
    recommendedResponseStyle: 'balanced',
    recommendedTemperature: 0.35,
    promptDirectives: [
      'Atue em modo diagnóstico e operacional: identifique sintomas, requisitos técnicos ou pré-condições antes de concluir.',
      'Forneça procedimentos objetivos em etapas verificáveis e valide dados cadastrais/técnicos necessários (modelo, CEP, quantidade, pedido).',
      'Priorize precisão técnica e prevenção de erros operacionais.',
    ],
  },
});

const OBJECTIVES = Object.freeze({
  fechamento: {
    id: 'fechamento',
    label: 'Fechamento Imediato',
    summary: 'Qualificar rápido, responder objeções de preço/pagamento e conduzir para pedido ou pagamento.',
    strategyDirective: 'Objetivo comercial prioritário: conduzir a conversa para confirmação do pedido, coleta dos dados essenciais e conclusão da venda com segurança.',
  },
  suporte: {
    id: 'suporte',
    label: 'Suporte Humanizado',
    summary: 'Resolver dúvidas, acompanhar entregas/garantias e escalonar casos críticos com transparência.',
    strategyDirective: 'Objetivo prioritário de suporte: diagnosticar o problema, orientar a solução prática e acompanhar até a confirmação de resolução.',
  },
  qualificacao: {
    id: 'qualificacao',
    label: 'Qualificação de Lead',
    summary: 'Mapear necessidade, volume, prazo, cidade/CEP e perfil de pagamento antes da proposta final.',
    strategyDirective: 'Objetivo prioritário de qualificação: descobrir necessidade específica, volume/escopo, prazo e região antes de apresentar proposta fechada.',
  },
  agendamento: {
    id: 'agendamento',
    label: 'Agendamento de Visitas',
    summary: 'Validar interesse, região e disponibilidade para confirmar data e horário de visita ou reunião.',
    strategyDirective: 'Objetivo prioritário de agendamento: confirmar endereço/região, objetivo da visita e propor opções concretas de dia e horário.',
  },
});

const TONES = Object.freeze({
  objetivo: {
    id: 'objetivo',
    label: 'Objetivo',
    directive: 'Tom de comunicação direto, assertivo e sem floreios.',
  },
  profissional: {
    id: 'profissional',
    label: 'Profissional',
    directive: 'Tom de comunicação corporativo, seguro, claro e respeitoso.',
  },
  acolhedor: {
    id: 'acolhedor',
    label: 'Acolhedor',
    directive: 'Tom de comunicação caloroso, empático, próximo e solícito.',
  },
  consultivo: {
    id: 'consultivo',
    label: 'Consultivo',
    directive: 'Tom de comunicação orientador, educativo e focado em ajudar o cliente a escolher melhor.',
  },
  tecnico: {
    id: 'tecnico',
    label: 'Técnico',
    directive: 'Tom de comunicação preciso, metódico e voltado à verificação técnica.',
  },
});

const RESPONSE_STYLES = Object.freeze({
  one_sentence: {
    id: 'one_sentence',
    label: 'Uma Frase (Ultra-direto)',
    minWords: 8,
    maxWords: 32,
    maxSentences: 1,
    suggestedMaxTokens: 160,
    instruction: 'Responda em apenas 1 frase curta e completa (até 32 palavras), sem rodeios.',
  },
  short_natural: {
    id: 'short_natural',
    label: 'Curto & Natural',
    minWords: 20,
    maxWords: 65,
    maxSentences: 3,
    suggestedMaxTokens: 320,
    instruction: 'Responda de forma concisa em 1 a 3 frases curtas (cerca de 30 a 65 palavras), direto ao ponto.',
  },
  balanced: {
    id: 'balanced',
    label: 'Equilibrado',
    minWords: 45,
    maxWords: 130,
    maxSentences: 5,
    suggestedMaxTokens: 560,
    instruction: 'Responda com equilíbrio em 2 a 5 frases claras (cerca de 50 a 130 palavras), cobrindo explicação, condição comercial e próximo passo.',
  },
  detailed: {
    id: 'detailed',
    label: 'Detalhado & Comparativo',
    minWords: 90,
    maxWords: 240,
    maxSentences: 9,
    suggestedMaxTokens: 900,
    instruction: 'Forneça resposta completa e estruturada (100 a 240 palavras), detalhando comparações, critérios, condições ou etapas de procedimento conforme os dados disponíveis.',
  },
});

function resolvePersonalityId(raw, fallbackTone = '', fallbackType = '') {
  const value = String(raw || '').trim().toLowerCase();
  if (PERSONALITIES[value]) return value;
  if (/execut|diret|objetiv|closing|closer/.test(value)) return 'executivo_direto';
  if (/analit|dado|compar/.test(value)) return 'analitico_dados';
  if (/operac|diagnost|tecnic|suport/.test(value)) return 'operacional_diagnostico';
  if (/consult|amigav|human|warm|comercial/.test(value)) return 'consultivo_amigavel';

  const typeHint = `${fallbackTone} ${fallbackType}`.toLowerCase();
  if (/execut|direct|objetiv/.test(typeHint)) return 'executivo_direto';
  if (/analit|data/.test(typeHint)) return 'analitico_dados';
  if (/tecnic|operac|diag/.test(typeHint)) return 'operacional_diagnostico';
  return 'consultivo_amigavel';
}

function resolveObjectiveId(raw) {
  const value = String(raw || '').trim().toLowerCase();
  if (OBJECTIVES[value]) return value;
  if (/suport|atend|help|support/.test(value)) return 'suporte';
  if (/qualif|triag|lead/.test(value)) return 'qualificacao';
  if (/agend|visit|reuni|sched/.test(value)) return 'agendamento';
  return 'fechamento';
}

function resolveToneId(raw, personalityDef) {
  const value = String(raw || '').trim().toLowerCase();
  if (TONES[value]) return value;
  if (value === 'friendly' || value === 'warm') return 'acolhedor';
  if (value === 'consultative') return 'consultivo';
  if (value === 'professional' || value === 'formal') return 'profissional';
  if (value === 'technical') return 'tecnico';
  if (value === 'direct') return 'objetivo';
  return personalityDef?.recommendedTone || 'acolhedor';
}

function resolveResponseStyleId(raw, personalityDef) {
  const value = String(raw || '').trim().toLowerCase();
  if (RESPONSE_STYLES[value]) return value;
  if (value === 'ultra_short' || value === 'clear_short') return 'short_natural';
  if (value === 'elaborate' || value === 'complete') return 'detailed';
  return personalityDef?.recommendedResponseStyle || 'balanced';
}

function compileAgentBehavior(agent = {}, modelMeta = null) {
  const personalityId = resolvePersonalityId(agent.personalityPreset || agent.personality_preset, agent.tone, agent.personalityType);
  const personalityDef = PERSONALITIES[personalityId];
  const objectiveId = resolveObjectiveId(agent.objective);
  const objectiveDef = OBJECTIVES[objectiveId];
  const toneId = resolveToneId(agent.tone, personalityDef);
  const toneDef = TONES[toneId];
  const responseStyleId = resolveResponseStyleId(agent.responseStyle || agent.response_style, personalityDef);
  const styleDef = RESPONSE_STYLES[responseStyleId];

  const parameterWarnings = [];

  const rawTemp = agent.temperature !== undefined && agent.temperature !== null && agent.temperature !== ''
    ? Number(agent.temperature)
    : personalityDef.recommendedTemperature;
  let effectiveTemperature = Number.isFinite(rawTemp) ? Math.min(1.5, Math.max(0, Number(rawTemp.toFixed(2)))) : personalityDef.recommendedTemperature;

  if (modelMeta && modelMeta.supportsTemperature === false) {
    parameterWarnings.push(`Modelo não suporta temperatura configurável (${effectiveTemperature} ignorado pelo modelo).`);
    effectiveTemperature = null;
  }

  const rawMaxTokens = Number(agent.maxTokens || agent.max_tokens);
  let effectiveMaxTokens = Number.isFinite(rawMaxTokens) && rawMaxTokens >= 64
    ? Math.round(rawMaxTokens)
    : styleDef.suggestedMaxTokens;

  if (modelMeta?.maxOutputTokens && effectiveMaxTokens > modelMeta.maxOutputTokens) {
    parameterWarnings.push(`max_tokens reduzido de ${effectiveMaxTokens} para o teto do modelo (${modelMeta.maxOutputTokens}).`);
    effectiveMaxTokens = modelMeta.maxOutputTokens;
  }

  const customWordCap = Number(agent.maxWords || 0);
  const wordLimit = customWordCap > 0
    ? Math.min(Math.max(Math.round(customWordCap), 15), 320)
    : styleDef.maxWords;

  const lines = [
    `[CONFIGURAÇÃO COMPORTAMENTAL CANÔNICA DO AGENTE]`,
    `- Personalidade Ativa: ${personalityDef.label} (${personalityId})`,
    ...personalityDef.promptDirectives.map((d) => `  • ${d}`),
    `- Objetivo Comercial: ${objectiveDef.label} (${objectiveId}) -> ${objectiveDef.strategyDirective}`,
    `- Tom de Atendimento: ${toneDef.label} (${toneId}) -> ${toneDef.directive}`,
    `- Estilo de Resposta: ${styleDef.label} (${responseStyleId}, máximo ~${wordLimit} palavras) -> ${styleDef.instruction}`,
    `- Temperatura Efetiva: ${effectiveTemperature !== null ? effectiveTemperature : 'padrão do modelo'} | Orçamento: ${effectiveMaxTokens} tokens`,
  ];

  return {
    personalityId,
    personalityLabel: personalityDef.label,
    objectiveId,
    objectiveLabel: objectiveDef.label,
    toneId,
    toneLabel: toneDef.label,
    responseStyleId,
    responseStyleLabel: styleDef.label,
    wordLimit,
    maxSentences: styleDef.maxSentences,
    temperature: effectiveTemperature,
    maxTokens: effectiveMaxTokens,
    systemPromptSection: lines.join('\n'),
    parameterWarnings,
  };
}

function enforceCompiledResponseBudget(text, agent = {}) {
  let normalized = String(text || '').trim();
  if (!normalized) return '';

  // Strip robotic self-references cleanly without injecting hardcoded store/brand copy
  normalized = normalized
    .replace(/\b(?:sou uma intelig[eê]ncia artificial.*?[.!?]|como modelo de ia.*?[.!?])\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  const compiled = compileAgentBehavior(agent);
  const limit = compiled.wordLimit;
  const maxSentences = compiled.maxSentences;

  // Keep bulleted structure when responseStyle === 'detailed'
  const words = normalized.split(/\s+/).filter(Boolean);
  if (compiled.responseStyleId !== 'detailed') {
    const protectedText = normalized.replace(/(\d)\.(\d)/g, '$1\u0001$2');
    const sentenceRegex = /[^.!?]+[.!?]+(?:[\s"'\u{1F300}-\u{1F9FF}]|$)/gu;
    const rawSentences = protectedText.match(sentenceRegex) || [protectedText];
    const cleanSentences = rawSentences.map((s) => s.replace(/\u0001/g, '.').trim()).filter(Boolean);

    if (cleanSentences.length > maxSentences) {
      let combined = '';
      for (let i = 0; i < Math.min(cleanSentences.length, maxSentences); i += 1) {
        const candidate = combined ? `${combined} ${cleanSentences[i]}` : cleanSentences[i];
        if (candidate.split(/\s+/).filter(Boolean).length <= limit + 8 || !combined) {
          combined = candidate;
        } else {
          break;
        }
      }
      normalized = combined || cleanSentences[0];
    }
  }

  const finalWords = normalized.split(/\s+/).filter(Boolean);
  if (finalWords.length <= limit + 10) {
    return normalized;
  }

  const sliced = finalWords.slice(0, limit).join(' ');
  const lastStop = Math.max(sliced.lastIndexOf('.'), sliced.lastIndexOf('!'), sliced.lastIndexOf('?'));
  if (lastStop > 24) {
    return sliced.slice(0, lastStop + 1).trim();
  }
  return `${sliced.replace(/[,:;\-]+$/, '')}...`;
}

function getBehaviorCatalog() {
  return {
    personalities: Object.values(PERSONALITIES),
    objectives: Object.values(OBJECTIVES),
    tones: Object.values(TONES),
    responseStyles: Object.values(RESPONSE_STYLES),
  };
}

module.exports = {
  PERSONALITIES,
  OBJECTIVES,
  TONES,
  RESPONSE_STYLES,
  resolvePersonalityId,
  resolveObjectiveId,
  resolveToneId,
  resolveResponseStyleId,
  compileAgentBehavior,
  enforceCompiledResponseBudget,
  getBehaviorCatalog,
};
