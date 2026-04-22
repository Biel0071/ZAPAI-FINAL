const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
};

const jsonHeaders = {
  ...corsHeaders,
  "Content-Type": "application/json",
};

function normalizeBaseUrl(value?: string | null): string {
  return String(value ?? "").trim().replace(/\/$/, "");
}

function resolveTargetApiUrl(): string | null {
  const configured = normalizeBaseUrl(Deno.env.get("TARGET_API_URL"));
  if (!configured) return null;

  try {
    const parsed = new URL(configured);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return null;
    }

    return normalizeBaseUrl(parsed.toString()).replace(/\/api$/i, "");
  } catch {
    return null;
  }
}

function looksLikeNgrokOfflinePage(body: string): boolean {
  return /ERR_NGROK_3200/i.test(body) || /endpoint\s+.+\s+is\s+offline/i.test(body);
}

function toJsonBody(status: number, body: string): string {
  if (!body) return "{}";

  try {
    return JSON.stringify(JSON.parse(body));
  } catch {
    if (looksLikeNgrokOfflinePage(body)) {
      return JSON.stringify({
        error: "Upstream API offline",
        code: "UPSTREAM_OFFLINE",
      });
    }

    if (/<!doctype\s+html>/i.test(body)) {
      return JSON.stringify({
        error: "Upstream API returned HTML",
        code: "UPSTREAM_NON_JSON",
      });
    }

    return JSON.stringify({
      error: status >= 500 ? "Upstream API error" : body,
      code: "UPSTREAM_ERROR",
    });
  }
}

type ProxyPayload = {
  endpoint?: string;
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
};

type SessionStatusEnvelope = {
  connected: boolean;
  lastUpdate: number;
};

function resolveConnectedFromSessionPayload(payload: unknown): boolean {
  if (Array.isArray(payload)) {
    return payload.some((entry) => {
      if (!entry || typeof entry !== "object") return false;
      const raw = entry as Record<string, unknown>;
      if (typeof raw.connected === "boolean") return raw.connected;
      const status = String(raw.status ?? "").toLowerCase();
      return ["connected", "online", "active", "open", "running"].includes(status);
    });
  }

  if (!payload || typeof payload !== "object") return false;
  const raw = payload as Record<string, unknown>;
  if (typeof raw.connected === "boolean") return raw.connected;

  const candidates = [raw.sessions, raw.data, raw.items, raw.results].find((item) => Array.isArray(item));
  if (Array.isArray(candidates)) {
    return candidates.some((entry) => {
      if (!entry || typeof entry !== "object") return false;
      const item = entry as Record<string, unknown>;
      if (typeof item.connected === "boolean") return item.connected;
      const status = String(item.status ?? "").toLowerCase();
      return ["connected", "online", "active", "open", "running"].includes(status);
    });
  }

  const status = String(raw.status ?? "").toLowerCase();
  return ["connected", "online", "active", "open", "running"].includes(status);
}

type MediaBody = {
  file?: string | Blob;
  dataBase64?: string;
  fileName?: string;
  mimeType?: string;
  mediaType?: string;
  type?: string;
  mediaPath?: string;
  chatId?: string;
  caption?: string;
  text?: string;
  phone?: string;
  conversationId?: string;
  contactId?: string;
  sessionId?: string;
  [key: string]: unknown;
};

function isMediaBody(value: unknown): value is MediaBody {
  if (!value || typeof value !== "object") return false;
  const body = value as Record<string, unknown>;
  return "file" in body || "dataBase64" in body || "mediaPath" in body || "type" in body || "mediaType" in body;
}

function stripDataUriPrefix(value: string): string {
  const trimmed = value.trim();
  const marker = ";base64,";
  const index = trimmed.indexOf(marker);
  return index >= 0 ? trimmed.slice(index + marker.length) : trimmed;
}

function decodeBase64(base64Input: string): Uint8Array {
  const normalized = stripDataUriPrefix(base64Input).replace(/\s+/g, "");
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

function buildMediaFormData(input: MediaBody): FormData {
  const formData = new FormData();
  const mimeType = typeof input.mimeType === "string" && input.mimeType.trim() ? input.mimeType.trim() : "application/octet-stream";
  const fileName = typeof input.fileName === "string" && input.fileName.trim() ? input.fileName.trim() : `media-${Date.now()}`;

  const normalizedPhone = String(input.phone ?? "").replace(/\D/g, "");
  const resolvedChatId =
    (typeof input.chatId === "string" && input.chatId.trim() ? input.chatId.trim() : "") ||
    (normalizedPhone ? `${normalizedPhone}@s.whatsapp.net` : "");
  const resolvedType =
    (typeof input.type === "string" && input.type.trim() ? input.type.trim() : "") ||
    (typeof input.mediaType === "string" && input.mediaType.trim() ? input.mediaType.trim() : "");

  const explicitFile = input.file;
  const fallbackFileBase64 = typeof input.dataBase64 === "string" ? input.dataBase64 : undefined;
  const fileCandidate = explicitFile ?? fallbackFileBase64;

  if (fileCandidate instanceof Blob) {
    formData.append("file", fileCandidate, fileName);
  } else if (typeof fileCandidate === "string" && fileCandidate.trim()) {
    const bytes = decodeBase64(fileCandidate);
    const blob = new Blob([bytes], { type: mimeType });
    formData.append("file", blob, fileName);
  }

  for (const [key, value] of Object.entries(input)) {
    if (value === undefined || value === null) continue;
    if (key === "file" || key === "dataBase64") continue;

    if (value instanceof Blob) {
      formData.append(key, value, fileName);
      continue;
    }

    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      formData.append(key, String(value));
      continue;
    }

    formData.append(key, JSON.stringify(value));
  }

  if (resolvedChatId && !formData.has("chatId")) formData.append("chatId", resolvedChatId);
  if (resolvedType && !formData.has("type")) formData.append("type", resolvedType);

  return formData;
}

function parseEndpoint(endpoint: string): { pathname: string; search: string } | null {
  try {
    const parsed = new URL(endpoint, "https://proxy.local");
    return { pathname: parsed.pathname, search: parsed.search };
  } catch {
    return null;
  }
}

function mapEndpoint(pathname: string, search: string): string | null {
  if (pathname === "/api/conversations") return `/conversations${search}`;

  const messagesMatch = pathname.match(/^\/api\/messages\/([^/?]+)$/);
  if (messagesMatch?.[1]) {
    return `/messages/${decodeURIComponent(messagesMatch[1])}${search}`;
  }

  const conversationMessagesMatch = pathname.match(/^\/api\/conversations\/([^/]+)\/messages$/);
  if (conversationMessagesMatch?.[1]) {
    return `/conversations/${decodeURIComponent(conversationMessagesMatch[1])}/messages${search}`;
  }

  if (pathname === "/api/send-message" || pathname === "/send-message") return "/send-message";
  if (pathname === "/api/send-media" || pathname === "/send-media") return "/send-media";
  if (pathname === "/api/contacts") return "/contacts";
  if (pathname === "/api/analytics") return "/analytics";
  if (pathname === "/ai/enable" || pathname === "/api/ai/enable") return "/ai/enable";
  if (pathname === "/ai/disable" || pathname === "/api/ai/disable") return "/ai/disable";
  if (pathname === "/ai/improve" || pathname === "/api/ai/improve") return "/ai/improve";
  if (pathname === "/ai/prompt" || pathname === "/api/ai/prompt") return "/ai/prompt";
  if (pathname === "/ai/memory" || pathname === "/api/ai/memory") return "/ai/memory";
  if (pathname === "/ai/status" || pathname === "/api/ai/status") return "/ai/status";

  if (pathname === "/config/business-hours") return "/config/business-hours";
  if (pathname === "/config/absence-message") return "/config/absence-message";
  if (pathname === "/config/advanced-ai") return "/config/advanced-ai";

  if (pathname === "/queue") return "/queue";
  if (pathname === "/queue/process") return "/queue/process";

  if (pathname === "/messages") {
    const params = new URLSearchParams(search);
    const conversationId = params.get("conversationId");

    if (conversationId) {
      params.delete("conversationId");
      const rest = params.toString();
      return `/messages/${encodeURIComponent(conversationId)}${rest ? `?${rest}` : ""}`;
    }

    return `/messages${search}`;
  }

  if (pathname === "/public-url" || pathname === "/api/public-url") return "/public-url";

  if (pathname === "/session/start") return "/session/start";
  if (pathname === "/session/restart") return "/session/restart";
  if (pathname === "/session/logout") return "/session/logout";
  if (pathname === "/session-status" || pathname === "/api/session-status") return "/session-status";

  const singularSessionDeleteMatch = pathname.match(/^\/session\/([^/]+)$/);
  if (singularSessionDeleteMatch?.[1]) {
    return `/session/${decodeURIComponent(singularSessionDeleteMatch[1])}`;
  }

  if (pathname === "/sessions/create") return "/sessions/create";
  if (pathname === "/sessions") return "/sessions";

  const sessionDeleteMatch = pathname.match(/^\/sessions\/([^/]+)$/);
  if (sessionDeleteMatch?.[1]) {
    return `/sessions/${decodeURIComponent(sessionDeleteMatch[1])}`;
  }

  if (pathname === "/system/runtime/status" || pathname === "/api/system/runtime/status") return "/system/runtime/status";
  if (pathname === "/health" || pathname === "/api/health") return "/health";
  if (pathname === "/api/sessions/status") return "/sessions/status";
  if (pathname === "/sessions/status") return "/sessions/status";
  if (pathname === "/system/status" || pathname === "/api/system/status") return "/system/status";
  if (pathname === "/system/activate" || pathname === "/api/system/activate") return "/system/activate";
  if (pathname === "/system/start" || pathname === "/api/system/start") return "/system/start";
  if (pathname === "/system/stop" || pathname === "/api/system/stop") return "/system/stop";
  if (pathname === "/system/error-log" || pathname === "/api/system/error-log") return "/system/error-log";
  if (pathname === "/system/ai-diagnostics" || pathname === "/api/system/ai-diagnostics") return "/system/ai-diagnostics";
  if (pathname === "/diagnostics" || pathname === "/api/diagnostics") return "/diagnostics";

  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Use POST with invoke payload" }), {
        status: 405,
        headers: jsonHeaders,
      });
    }

    const payload = (await req.json()) as ProxyPayload;
    const endpoint = payload.endpoint;
    const method = payload.method?.toUpperCase() ?? "GET";

    if (!endpoint || endpoint.includes("..")) {
      return new Response(JSON.stringify({ error: "Invalid endpoint" }), {
        status: 400,
        headers: jsonHeaders,
      });
    }

    const parsedEndpoint = parseEndpoint(endpoint);
    if (!parsedEndpoint) {
      return new Response(JSON.stringify({ error: "Invalid endpoint" }), {
        status: 400,
        headers: jsonHeaders,
      });
    }

    const { pathname, search } = parsedEndpoint;

    if (
      (!pathname.startsWith("/api/") &&
        !pathname.startsWith("/ai/") &&
        !pathname.startsWith("/config/") &&
        !pathname.startsWith("/queue") &&
        !pathname.startsWith("/messages") &&
        !pathname.startsWith("/sessions") &&
        !pathname.startsWith("/session/") &&
        pathname !== "/session-status" &&
        !pathname.startsWith("/system/") &&
        pathname !== "/health" &&
        pathname !== "/diagnostics" &&
        pathname !== "/public-url" &&
        pathname !== "/send-message" &&
        pathname !== "/send-media")
    ) {
      return new Response(JSON.stringify({ error: "Invalid endpoint" }), {
        status: 400,
        headers: jsonHeaders,
      });
    }

    if (method !== "GET" && method !== "POST" && method !== "DELETE") {
      return new Response(JSON.stringify({ error: "Invalid method" }), {
        status: 400,
        headers: jsonHeaders,
      });
    }

    const targetApiUrl = resolveTargetApiUrl();
    if (!targetApiUrl) {
      console.error("api-proxy misconfigured: TARGET_API_URL missing or not https", {
        target: Deno.env.get("TARGET_API_URL") ?? null,
      });
      return new Response(
        JSON.stringify({
          error: "Server configuration error",
          code: "TARGET_API_URL_INVALID",
        }),
        {
          status: 500,
          headers: jsonHeaders,
        },
      );
    }

    const targetPath = mapEndpoint(pathname, search);

    const forwardedHeaders = new Headers({
      Accept: "application/json",
    });

    if (payload.headers && typeof payload.headers === "object") {
      for (const [key, value] of Object.entries(payload.headers)) {
        if (typeof value === "string" && value.length > 0) {
          forwardedHeaders.set(key, value);
        }
      }
    }

    if (pathname === "/session-status" || pathname === "/api/session-status") {
      const upstreamStatusUrl = `${targetApiUrl}/api/sessions/status`;
      try {
        const response = await fetch(upstreamStatusUrl, {
          method: "GET",
          headers: forwardedHeaders,
        });

        const bodyText = await response.text();
        if (!response.ok) {
          return new Response(toJsonBody(response.status, bodyText), {
            status: response.status,
            headers: jsonHeaders,
          });
        }

        let parsed: unknown = [];
        try {
          parsed = bodyText ? JSON.parse(bodyText) : [];
        } catch {
          parsed = [];
        }

        const envelope: SessionStatusEnvelope = {
          connected: resolveConnectedFromSessionPayload(parsed),
          lastUpdate: Date.now(),
        };

        return new Response(JSON.stringify(envelope), {
          status: 200,
          headers: jsonHeaders,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Session status fetch failed";
        return new Response(JSON.stringify({ error: message, code: "SESSION_STATUS_FAILED" }), {
          status: 502,
          headers: jsonHeaders,
        });
      }
    }

    if (!targetPath) {
      return new Response(JSON.stringify({ error: "Route not found" }), {
        status: 404,
        headers: jsonHeaders,
      });
    }

    const isMediaEndpoint = (pathname === "/api/send-media" || pathname === "/send-media") && method === "POST";
    const candidatePaths = [targetPath];

    const shouldUseMultipart = isMediaEndpoint && isMediaBody(payload.body);

    if (!shouldUseMultipart && !forwardedHeaders.has("Content-Type")) {
      forwardedHeaders.set("Content-Type", "application/json");
    }

    let upstreamResponse: Response | null = null;
    let responseText = "";

    for (const candidatePath of candidatePaths) {
      const targetUrl = `${targetApiUrl}/api${candidatePath}`;
      console.log("api-proxy forwarding", { method, targetUrl, mode: shouldUseMultipart ? "multipart" : "json" });

      try {
        const requestBody = shouldUseMultipart
          ? buildMediaFormData(payload.body as MediaBody)
          : method === "POST"
            ? JSON.stringify(payload.body ?? {})
            : undefined;

        const requestHeaders = new Headers(forwardedHeaders);
        if (shouldUseMultipart) {
          requestHeaders.delete("Content-Type");
        }

        const response = await fetch(targetUrl, {
          method,
          headers: requestHeaders,
          body: requestBody,
        });

        const text = await response.text();
        const notFoundSignature = response.status === 404 && /cannot\s+post/i.test(text);
        upstreamResponse = response;
        responseText = text;

        if (!response.ok) {
          console.error("api-proxy upstream error", {
            method,
            targetUrl,
            status: response.status,
            bodyPreview: text.slice(0, 500),
          });
        } else {
          console.log("api-proxy upstream success", {
            method,
            targetUrl,
            status: response.status,
          });
        }

        if (!notFoundSignature) {
          break;
        }
      } catch (fetchError) {
        const message = fetchError instanceof Error ? fetchError.message : "Unknown fetch error";
        console.error("api-proxy fetch failed", {
          method,
          targetUrl,
          message,
        });

        return new Response(
          JSON.stringify({
            error: message,
            code: "UPSTREAM_FETCH_FAILED",
          }),
          {
            status: 502,
            headers: jsonHeaders,
          },
        );
      }
    }

    const status = upstreamResponse?.status ?? 502;
    const passthroughHeaders = new Headers(corsHeaders);
    const upstreamContentType = upstreamResponse?.headers.get("content-type");

    if (upstreamContentType) {
      passthroughHeaders.set("Content-Type", upstreamContentType);
    } else {
      passthroughHeaders.set("Content-Type", "application/json");
    }

    return new Response(responseText, {
      status,
      headers: passthroughHeaders,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown proxy error";
    console.error("api-proxy unhandled", { message });
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: jsonHeaders,
    });
  }
});
