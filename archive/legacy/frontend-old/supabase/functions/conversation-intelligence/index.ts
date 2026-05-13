import { createClient } from "npm:@supabase/supabase-js@2";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type ConversationMessage = { role: "user" | "assistant"; content: string };

type AnalyzePayload = {
  conversationId: string;
  conversationMessages: ConversationMessage[];
};

type ResponsePayload = {
  context: {
    prompt: string;
    customerMessage: string;
    conversationHistory: ConversationMessage[];
    leadAnalysis: {
      intent: string;
      lead_temperature: string;
      confidence: number;
      next_action: string;
    };
    salesStrategy: {
      tone: string;
      goal: string;
      priority: string;
    };
  };
};

function getClient() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Configuração de backend incompleta.");
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

async function callGateway(body: Record<string, unknown>) {
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY indisponível.");

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error("Rate limits exceeded, please try again later.");
    }
    if (response.status === 402) {
      throw new Error("Payment required, please add funds to your Lovable AI workspace.");
    }
    const errorText = await response.text();
    throw new Error(`AI gateway error: ${errorText}`);
  }

  return response.json();
}

async function analyzeConversation(payload: AnalyzePayload) {
  const result = await callGateway({
    model: "google/gemini-3-flash-preview",
    messages: [
      {
        role: "system",
        content:
          "Você analisa conversas comerciais e retorna diagnóstico estruturado com foco em fechamento de vendas.",
      },
      {
        role: "user",
        content: `Analise a conversa completa e retorne estrutura pela ferramenta.\n\n${JSON.stringify(payload.conversationMessages)}`,
      },
    ],
    tools: [
      {
        type: "function",
        function: {
          name: "conversation_intelligence",
          description: "Retorna análise completa da conversa para estratégia comercial",
          parameters: {
            type: "object",
            properties: {
              summary: { type: "string" },
              customer_interest_score: { type: "number" },
              objections: { type: "array", items: { type: "string" } },
              questions: { type: "array", items: { type: "string" } },
              purchase_signals: { type: "array", items: { type: "string" } },
              recommended_action: { type: "string" },
            },
            required: [
              "summary",
              "customer_interest_score",
              "objections",
              "questions",
              "purchase_signals",
              "recommended_action",
            ],
            additionalProperties: false,
          },
        },
      },
    ],
    tool_choice: {
      type: "function",
      function: { name: "conversation_intelligence" },
    },
  });

  const toolCall = result?.choices?.[0]?.message?.tool_calls?.[0];
  const args = toolCall?.function?.arguments ? JSON.parse(toolCall.function.arguments) : null;

  if (!args) throw new Error("Não foi possível extrair análise estruturada.");

  const parsed = {
    summary: String(args.summary || ""),
    customer_interest_score: Number(args.customer_interest_score || 0),
    objections: Array.isArray(args.objections) ? args.objections.map(String) : [],
    questions: Array.isArray(args.questions) ? args.questions.map(String) : [],
    purchase_signals: Array.isArray(args.purchase_signals) ? args.purchase_signals.map(String) : [],
    recommended_action: String(args.recommended_action || "educate"),
  };

  const supabase = getClient();
  await supabase.from("conversation_insights").insert({
    conversation_id: payload.conversationId,
    summary: parsed.summary,
    customer_interest_score: parsed.customer_interest_score,
    objections: parsed.objections,
    questions: parsed.questions,
    purchase_signals: parsed.purchase_signals,
    recommended_action: parsed.recommended_action,
  });

  return parsed;
}

async function generateOptimizedResponse(payload: ResponsePayload) {
  const { context } = payload;
  const history = context.conversationHistory ?? [];

  const response = await callGateway({
    model: "google/gemini-3-flash-preview",
    messages: [
      {
        role: "system",
        content: `${context.prompt}\n\nRegra obrigatória: resposta amigável, orientada a vendas, máximo 50 palavras e sempre terminar com pergunta.`,
      },
      {
        role: "assistant",
        content: `Estratégia comercial: tone=${context.salesStrategy.tone}, goal=${context.salesStrategy.goal}, priority=${context.salesStrategy.priority}, intent=${context.leadAnalysis.intent}, temperatura=${context.leadAnalysis.lead_temperature}`,
      },
      ...history,
      { role: "user", content: context.customerMessage },
    ],
    max_tokens: 120,
    temperature: 0.4,
  });

  const content = response?.choices?.[0]?.message?.content;
  const text = typeof content === "string" ? content.trim() : "Perfeito! Posso finalizar seu pedido agora. Prefere pagar por PIX ou retirar na loja?";
  return { response: text };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const action = String(body?.action || "");

    if (action === "analyze-conversation") {
      const data = await analyzeConversation(body as AnalyzePayload);
      return new Response(JSON.stringify(data), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "generate-response") {
      const data = await generateOptimizedResponse(body as ResponsePayload);
      return new Response(JSON.stringify(data), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Ação inválida" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro inesperado";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
