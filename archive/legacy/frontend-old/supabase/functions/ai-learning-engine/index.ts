import { createClient } from "npm:@supabase/supabase-js@2";

const EXTERNAL_API_URL = Deno.env.get("EXTERNAL_API_URL") ?? "http://localhost:4000";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const jsonHeaders = {
  ...corsHeaders,
  "Content-Type": "application/json",
};

type Conversation = {
  id?: string;
  sessionId?: string;
  phone?: string;
  contactName?: string;
  name?: string;
  lastMessage?: string;
  updatedAt?: string;
  unread?: number;
  status?: string;
  tags?: string[];
};

type IssueType = "unanswered_question" | "lost_lead" | "frequent_question" | "failed_conversation" | "drop_off";

type Suggestion = {
  conversation_id: string;
  issue_type: IssueType;
  problem_detected: string;
  suggested_response: string;
  suggested_prompt_improvement: string;
  suggested_new_flow: string;
  suggested_improvement: string;
  frequent_question?: string | null;
  drop_off_moment?: string | null;
  status: "pending";
  source_run_date: string;
  metadata: Record<string, unknown>;
};

function getSupabase() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

function isLikelyQuestion(message: string) {
  return message.includes("?");
}

function isLikelyLostLead(message: string) {
  const text = message.toLowerCase();
  return ["vou pensar", "depois", "muito caro", "sem interesse", "não agora"].some((snippet) => text.includes(snippet));
}

function isLikelyFailedConversation(conversation: Conversation) {
  const unread = conversation.unread ?? 0;
  return unread >= 2 && (conversation.status === "offline" || conversation.status === "away");
}

function isLikelyDropOff(conversation: Conversation) {
  if (!conversation.updatedAt) return false;
  const updatedAt = new Date(conversation.updatedAt).getTime();
  if (Number.isNaN(updatedAt)) return false;
  const hoursSinceUpdate = (Date.now() - updatedAt) / (1000 * 60 * 60);
  return (conversation.unread ?? 0) > 0 && hoursSinceUpdate > 24;
}

function buildSuggestion(conversation: Conversation, issueType: IssueType, runDate: string): Suggestion {
  const conversationId = conversation.id ?? conversation.sessionId ?? conversation.phone ?? crypto.randomUUID();
  const lastMessage = conversation.lastMessage?.trim() || "Sem mensagem";

  const defaults: Record<IssueType, Omit<Suggestion, "conversation_id" | "issue_type" | "source_run_date" | "status" | "metadata">> = {
    unanswered_question: {
      problem_detected: "Cliente fez pergunta e não recebeu resposta clara.",
      suggested_response: "Olá! Obrigada pela pergunta. Vou te responder agora com todos os detalhes para avançarmos.",
      suggested_prompt_improvement: "Sempre responder perguntas diretas do cliente em até 2 mensagens, com clareza e CTA de continuidade.",
      suggested_new_flow: "Fluxo de resposta imediata para perguntas diretas com validação de entendimento.",
      suggested_improvement: "Adicionar prioridade para perguntas sem resposta.",
      frequent_question: lastMessage,
      drop_off_moment: null,
    },
    lost_lead: {
      problem_detected: "Lead demonstrou interesse inicial e abandonou antes de converter.",
      suggested_response: "Posso montar uma condição especial para facilitar sua decisão. Quer que eu te envie agora?",
      suggested_prompt_improvement: "Quando detectar objeção de preço, aplicar resposta de valor + proposta objetiva.",
      suggested_new_flow: "Fluxo de recuperação de lead com 2 tentativas em 24h.",
      suggested_improvement: "Reforçar contorno de objeções comerciais.",
      frequent_question: null,
      drop_off_moment: "Após objeção comercial",
    },
    frequent_question: {
      problem_detected: "Pergunta recorrente identificada em múltiplas conversas.",
      suggested_response: "Essa é uma dúvida comum! Posso te explicar rapidamente e já te ajudar no próximo passo.",
      suggested_prompt_improvement: "Adicionar FAQ recorrente ao prompt para reduzir tempo de resposta.",
      suggested_new_flow: "Fluxo de FAQ com respostas padronizadas e CTA final.",
      suggested_improvement: "Expandir base de perguntas frequentes no contexto da IA.",
      frequent_question: lastMessage,
      drop_off_moment: null,
    },
    failed_conversation: {
      problem_detected: "Conversa com sinais de falha de continuidade no atendimento.",
      suggested_response: "Percebi que sua solicitação ficou pendente. Posso retomar agora e resolver com você?",
      suggested_prompt_improvement: "Se houver falha de continuidade, acionar retomada proativa em tom consultivo.",
      suggested_new_flow: "Fluxo de recuperação de conversa com confirmação de contexto.",
      suggested_improvement: "Aplicar fallback inteligente para evitar interrupções.",
      frequent_question: null,
      drop_off_moment: "Após resposta incompleta",
    },
    drop_off: {
      problem_detected: "Cliente abandonou a conversa em etapa crítica.",
      suggested_response: "Vi que a conversa parou no meio. Quer que eu continue de onde paramos para agilizar?",
      suggested_prompt_improvement: "Detectar inatividade em etapas críticas e enviar retomada contextual.",
      suggested_new_flow: "Fluxo de reengajamento por inatividade com lembrete útil.",
      suggested_improvement: "Criar gatilho de reengajamento baseado em abandono.",
      frequent_question: null,
      drop_off_moment: "Após envio de proposta",
    },
  };

  return {
    conversation_id: conversationId,
    issue_type: issueType,
    status: "pending",
    source_run_date: runDate,
    metadata: {
      contactName: conversation.contactName ?? conversation.name ?? "",
      phone: conversation.phone ?? "",
      lastMessage,
      updatedAt: conversation.updatedAt ?? null,
    },
    ...defaults[issueType],
  };
}

async function fetchConversations() {
  const response = await fetch(`${EXTERNAL_API_URL}/conversations`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) throw new Error("Falha ao carregar conversas externas para análise.");
  const data = (await response.json()) as Conversation[];
  return Array.isArray(data) ? data : [];
}

async function callExternalPrompt<T>(method: "GET" | "POST", body?: unknown): Promise<T> {
  const candidatePaths = ["/ai/prompt", "/api/ai/prompt"];

  for (const path of candidatePaths) {
    const response = await fetch(`${EXTERNAL_API_URL}${path}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: method === "POST" ? JSON.stringify(body ?? {}) : undefined,
    });

    if (response.ok) {
      return (await response.json()) as T;
    }
  }

  throw new Error("Não foi possível acessar o prompt no backend externo.");
}


async function runAnalysis() {
  const supabase = getSupabase();
  const runDate = new Date().toISOString().slice(0, 10);
  const conversations = await fetchConversations();

  const suggestions: Suggestion[] = [];
  const questionCounter = new Map<string, number>();

  for (const conversation of conversations) {
    const message = (conversation.lastMessage ?? "").trim();

    if (isLikelyQuestion(message) && (conversation.unread ?? 0) > 0) {
      suggestions.push(buildSuggestion(conversation, "unanswered_question", runDate));
      questionCounter.set(message, (questionCounter.get(message) ?? 0) + 1);
    }

    if (isLikelyLostLead(message)) {
      suggestions.push(buildSuggestion(conversation, "lost_lead", runDate));
    }

    if (isLikelyFailedConversation(conversation)) {
      suggestions.push(buildSuggestion(conversation, "failed_conversation", runDate));
    }

    if (isLikelyDropOff(conversation)) {
      suggestions.push(buildSuggestion(conversation, "drop_off", runDate));
    }
  }

  for (const [question, count] of questionCounter.entries()) {
    if (count < 2) continue;
    const baseConversation = conversations.find((conversation) => (conversation.lastMessage ?? "").trim() === question);
    if (!baseConversation) continue;
    suggestions.push({
      ...buildSuggestion(baseConversation, "frequent_question", runDate),
      frequent_question: question,
      metadata: { ...buildSuggestion(baseConversation, "frequent_question", runDate).metadata, frequency: count },
    });
  }

  if (suggestions.length) {
    const { error } = await supabase.from("ai_learning_logs").upsert(suggestions, {
      onConflict: "conversation_id,issue_type,source_run_date",
      ignoreDuplicates: false,
    });
    if (error) throw new Error(error.message);
  }

  const missingResponses = suggestions.filter((item) => item.issue_type === "unanswered_question").length;
  const lostLeads = suggestions.filter((item) => item.issue_type === "lost_lead").length;
  const failedConversations = suggestions.filter((item) => item.issue_type === "failed_conversation").length;
  const dropOffPoints = suggestions.filter((item) => item.issue_type === "drop_off").length;
  const frequentQuestions = suggestions.filter((item) => item.issue_type === "frequent_question").length;
  const converted = Math.max(0, conversations.length - lostLeads);
  const conversionRate = conversations.length ? (converted / conversations.length) * 100 : 0;

  const { data: existingRun } = await supabase
    .from("ai_learning_runs")
    .select("prompt_improvements_applied")
    .eq("run_date", runDate)
    .maybeSingle();

  const { error: runError } = await supabase.from("ai_learning_runs").upsert(
    {
      run_date: runDate,
      total_conversations_analyzed: conversations.length,
      missing_responses: missingResponses,
      lost_leads: lostLeads,
      failed_conversations: failedConversations,
      drop_off_points: dropOffPoints,
      frequent_questions: frequentQuestions,
      conversion_rate: Number(conversionRate.toFixed(2)),
      prompt_improvements_applied: existingRun?.prompt_improvements_applied ?? 0,
    },
    { onConflict: "run_date" },
  );

  if (runError) throw new Error(runError.message);

  return { success: true, createdLogs: suggestions.length };
}

async function getDashboard() {
  const supabase = getSupabase();

  const { data: latestRun } = await supabase
    .from("ai_learning_runs")
    .select("run_date, total_conversations_analyzed, missing_responses, lost_leads, conversion_rate, prompt_improvements_applied")
    .order("run_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  const runDate = latestRun?.run_date ?? new Date().toISOString().slice(0, 10);

  const { data: issues, error } = await supabase
    .from("ai_learning_logs")
    .select("id, conversation_id, issue_type, problem_detected, suggested_response, suggested_prompt_improvement, suggested_new_flow, status, frequent_question, drop_off_moment, created_at")
    .eq("source_run_date", runDate)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw new Error(error.message);

  const frequentMap = new Map<string, number>();
  const dropMap = new Map<string, number>();

  for (const item of issues ?? []) {
    if (item.frequent_question) frequentMap.set(item.frequent_question, (frequentMap.get(item.frequent_question) ?? 0) + 1);
    if (item.drop_off_moment) dropMap.set(item.drop_off_moment, (dropMap.get(item.drop_off_moment) ?? 0) + 1);
  }

  return {
    runDate,
    metrics: {
      totalConversationsAnalyzed: latestRun?.total_conversations_analyzed ?? 0,
      missingResponses: latestRun?.missing_responses ?? 0,
      lostLeads: latestRun?.lost_leads ?? 0,
      conversionRate: Number(latestRun?.conversion_rate ?? 0),
      promptImprovementsApplied: latestRun?.prompt_improvements_applied ?? 0,
    },
    issues: (issues ?? []).map((item) => ({
      id: item.id,
      conversationId: item.conversation_id,
      issueType: item.issue_type,
      problemDetected: item.problem_detected,
      suggestedResponse: item.suggested_response,
      suggestedPromptImprovement: item.suggested_prompt_improvement,
      suggestedNewFlow: item.suggested_new_flow,
      status: item.status,
      frequentQuestion: item.frequent_question,
      dropOffMoment: item.drop_off_moment,
      createdAt: item.created_at,
    })),
    frequentQuestions: [...frequentMap.entries()]
      .map(([question, count]) => ({ question, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
    dropPoints: [...dropMap.entries()]
      .map(([point, count]) => ({ point, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
  };
}

async function applyImprovement(logId: string, newPrompt: string) {
  const supabase = getSupabase();

  const { data: log, error: logError } = await supabase
    .from("ai_learning_logs")
    .select("id, suggested_prompt_improvement, source_run_date")
    .eq("id", logId)
    .single();

  if (logError || !log) throw new Error(logError?.message ?? "Sugestão não encontrada.");

  if (!newPrompt || !newPrompt.trim()) {
    throw new Error("newPrompt é obrigatório para aplicar melhoria.");
  }

  const { data: history, error: historyError } = await supabase
    .from("prompt_history")
    .insert({
      prompt_content: newPrompt,
      applied_from_log_id: log.id,
      version_label: `AI Learning ${new Date().toISOString()}`,
    })
    .select("id")
    .single();

  if (historyError) throw new Error(historyError.message);

  const { error: updateLogError } = await supabase
    .from("ai_learning_logs")
    .update({ status: "applied", applied_at: new Date().toISOString() })
    .eq("id", log.id);

  if (updateLogError) throw new Error(updateLogError.message);

  const { data: runRow } = await supabase
    .from("ai_learning_runs")
    .select("prompt_improvements_applied")
    .eq("run_date", log.source_run_date)
    .maybeSingle();

  await supabase
    .from("ai_learning_runs")
    .upsert(
      {
        run_date: log.source_run_date,
        prompt_improvements_applied: (runRow?.prompt_improvements_applied ?? 0) + 1,
      },
      { onConflict: "run_date" },
    );

  return { success: true, newPrompt, promptVersionId: history.id };
}

async function editSuggestion(payload: { logId: string; suggestedResponse?: string; suggestedPromptImprovement?: string; suggestedNewFlow?: string }) {
  const supabase = getSupabase();
  const { error } = await supabase
    .from("ai_learning_logs")
    .update({
      suggested_response: payload.suggestedResponse,
      suggested_prompt_improvement: payload.suggestedPromptImprovement,
      suggested_new_flow: payload.suggestedNewFlow,
      status: "edited",
    })
    .eq("id", payload.logId);

  if (error) throw new Error(error.message);
  return { success: true };
}

async function ignoreSuggestion(logId: string) {
  const supabase = getSupabase();
  const { error } = await supabase.from("ai_learning_logs").update({ status: "ignored" }).eq("id", logId);
  if (error) throw new Error(error.message);
  return { success: true };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Ambiente incompleto para AI Learning Engine.");
    }

    const method = req.method.toUpperCase();
    const body = method === "POST" ? await req.json() : {};
    const action = String((body?.action as string) || "get-dashboard");

    if (action === "get-dashboard") {
      const data = await getDashboard();
      return new Response(JSON.stringify(data), { status: 200, headers: jsonHeaders });
    }

    if (action === "run-analysis") {
      const data = await runAnalysis();
      return new Response(JSON.stringify(data), { status: 200, headers: jsonHeaders });
    }

    if (action === "apply-improvement") {
      const logId = String(body?.logId || "");
      const newPrompt = String(body?.newPrompt || "");
      if (!logId) throw new Error("logId é obrigatório.");
      const data = await applyImprovement(logId, newPrompt);
      return new Response(JSON.stringify(data), { status: 200, headers: jsonHeaders });
    }

    if (action === "edit-suggestion") {
      const logId = String(body?.logId || "");
      if (!logId) throw new Error("logId é obrigatório.");
      const data = await editSuggestion({
        logId,
        suggestedResponse: typeof body?.suggestedResponse === "string" ? body.suggestedResponse : undefined,
        suggestedPromptImprovement:
          typeof body?.suggestedPromptImprovement === "string" ? body.suggestedPromptImprovement : undefined,
        suggestedNewFlow: typeof body?.suggestedNewFlow === "string" ? body.suggestedNewFlow : undefined,
      });
      return new Response(JSON.stringify(data), { status: 200, headers: jsonHeaders });
    }

    if (action === "ignore-suggestion") {
      const logId = String(body?.logId || "");
      if (!logId) throw new Error("logId é obrigatório.");
      const data = await ignoreSuggestion(logId);
      return new Response(JSON.stringify(data), { status: 200, headers: jsonHeaders });
    }

    return new Response(JSON.stringify({ error: "Ação inválida." }), { status: 400, headers: jsonHeaders });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido no AI Learning Engine.";
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: jsonHeaders });
  }
});
