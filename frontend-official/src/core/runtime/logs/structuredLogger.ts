type LogLevel = "info" | "warn" | "error" | "debug";
type LogScope = "session" | "api" | "whatsapp" | "db" | "ui" | "queue" | "system" | "socket";

export interface StructuredLogEntry {
  timestamp: string;
  level: LogLevel;
  scope: LogScope;
  route?: string;
  requestId?: string;
  sessionId?: string;
  statusCode?: number;
  message: string;
  error?: string | null;
  stack?: string | null;
  input?: unknown;
  suggestion?: string | null;
}

const LOG_STORAGE_KEY = "zapai_structured_logs";
const MAX_STORED_LOGS = 200;
const LOG_EVENT = "zapai:log";

let logBuffer: StructuredLogEntry[] = [];

function generateRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function persist() {
  try {
    const serialized = JSON.stringify(logBuffer.slice(-MAX_STORED_LOGS));
    localStorage.setItem(LOG_STORAGE_KEY, serialized);
  } catch {
    // storage full — trim
    logBuffer = logBuffer.slice(-50);
  }
}

function restore() {
  try {
    const raw = localStorage.getItem(LOG_STORAGE_KEY);
    if (raw) logBuffer = JSON.parse(raw) as StructuredLogEntry[];
  } catch {
    logBuffer = [];
  }
}

restore();

function emit(entry: StructuredLogEntry) {
  logBuffer.push(entry);
  if (logBuffer.length > MAX_STORED_LOGS) logBuffer = logBuffer.slice(-MAX_STORED_LOGS);
  persist();
  window.dispatchEvent(new CustomEvent<StructuredLogEntry>(LOG_EVENT, { detail: entry }));

  const style = entry.level === "error" ? "color:#f87171" : entry.level === "warn" ? "color:#fbbf24" : "color:#60a5fa";
  const prefix = `%c[${entry.scope.toUpperCase()}]`;
  const meta = [entry.route, entry.statusCode ? `HTTP ${entry.statusCode}` : null, entry.requestId].filter(Boolean).join(" | ");
  const suffix = meta ? ` (${meta})` : "";

  if (entry.level === "error") {
    console.error(prefix, style, entry.message + suffix, entry.error ?? "");
  } else if (entry.level === "warn") {
    console.warn(prefix, style, entry.message + suffix);
  } else {
    console.info(prefix, style, entry.message + suffix);
  }
}

export const slog = {
  info(scope: LogScope, message: string, meta?: Partial<Omit<StructuredLogEntry, "timestamp" | "level" | "scope" | "message">>) {
    emit({ timestamp: new Date().toISOString(), level: "info", scope, message, ...meta });
  },
  warn(scope: LogScope, message: string, meta?: Partial<Omit<StructuredLogEntry, "timestamp" | "level" | "scope" | "message">>) {
    emit({ timestamp: new Date().toISOString(), level: "warn", scope, message, ...meta });
  },
  error(scope: LogScope, message: string, meta?: Partial<Omit<StructuredLogEntry, "timestamp" | "level" | "scope" | "message">>) {
    emit({ timestamp: new Date().toISOString(), level: "error", scope, message, ...meta });
  },
  apiRequest(route: string, statusCode: number, extra?: { error?: string; input?: unknown; suggestion?: string; sessionId?: string }) {
    const level: LogLevel = statusCode >= 500 ? "error" : statusCode >= 400 ? "warn" : "info";
    emit({
      timestamp: new Date().toISOString(),
      level,
      scope: "api",
      route,
      requestId: generateRequestId(),
      statusCode,
      message: statusCode >= 400 ? `API error on ${route}` : `API success on ${route}`,
      error: extra?.error ?? null,
      input: extra?.input,
      suggestion: extra?.suggestion ?? null,
      sessionId: extra?.sessionId,
    });
  },
  getLogs(): StructuredLogEntry[] {
    return [...logBuffer];
  },
  getErrorsByRoute(): Record<string, number> {
    const counts: Record<string, number> = {};
    logBuffer.forEach((entry) => {
      if (entry.level === "error" && entry.route) {
        counts[entry.route] = (counts[entry.route] ?? 0) + 1;
      }
    });
    return counts;
  },
  getLastError(): StructuredLogEntry | null {
    for (let i = logBuffer.length - 1; i >= 0; i--) {
      if (logBuffer[i].level === "error") return logBuffer[i];
    }
    return null;
  },
  clear() {
    logBuffer = [];
    persist();
  },
  subscribe(listener: (entry: StructuredLogEntry) => void): () => void {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<StructuredLogEntry>).detail;
      if (detail) listener(detail);
    };
    window.addEventListener(LOG_EVENT, handler);
    return () => window.removeEventListener(LOG_EVENT, handler);
  },
};
