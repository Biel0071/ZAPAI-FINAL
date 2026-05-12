import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function getClient() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Configuração de backend incompleta.");
  }

  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

function sanitizeUsername(input: unknown): string {
  return String(input ?? "").trim().slice(0, 80);
}

function sanitizePassword(input: unknown): string {
  return String(input ?? "").slice(0, 120);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Método não permitido" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const payload = await req.json().catch(() => ({}));
    const username = sanitizeUsername((payload as { username?: unknown }).username);
    const password = sanitizePassword((payload as { password?: unknown }).password);

    if (!username || !password) {
      return new Response(JSON.stringify({ ok: false, error: "Credenciais inválidas." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = getClient();
    const { data, error } = await supabase.rpc("verify_admin_credentials", {
      _username: username,
      _password: password,
    });

    if (error) {
      throw new Error(error.message || "Falha ao validar credenciais");
    }

    const result = (data && typeof data === "object" ? (data as Record<string, unknown>) : {}) as Record<string, unknown>;
    const token =
      (typeof result.token === "string" && result.token.trim()) ||
      (typeof result.accessToken === "string" && result.accessToken.trim()) ||
      (typeof result.access_token === "string" && result.access_token.trim()) ||
      null;
    const refreshToken =
      (typeof result.refreshToken === "string" && result.refreshToken.trim()) ||
      (typeof result.refresh_token === "string" && result.refresh_token.trim()) ||
      null;

    const explicitOk = typeof result.ok === "boolean" ? result.ok : null;
    const ok = explicitOk ?? Boolean(token);
    const role = String(result.role ?? "user");

    return new Response(JSON.stringify({ ok, role, ...(token ? { token } : {}), ...(refreshToken ? { refreshToken } : {}) }), {
      status: ok ? 200 : 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro inesperado";
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});