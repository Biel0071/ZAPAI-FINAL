import { notify } from "@/services/notifyService";
import { sendErrorLog } from "@/runtime/logs/errorLogService";

export type FrontendHealthLevel = "healthy" | "warning" | "error";
export type FrontendIssueType = "socket_disconnection" | "api_timeout" | "unexpected_error";

export type FrontendHealthSnapshot = {
  level: FrontendHealthLevel;
  lastIssue?: {
    type: FrontendIssueType;
    message: string;
    service: string;
    timestamp: string;
  };
  updatedAt: string;
};

const FRONTEND_HEALTH_EVENT = "frontend:health";
const ISSUE_THROTTLE_MS = 10_000;

let snapshot: FrontendHealthSnapshot = {
  level: "healthy",
  updatedAt: new Date().toISOString(),
};

const lastIssueByKey = new Map<string, number>();

function emitSnapshot() {
  window.dispatchEvent(new CustomEvent<FrontendHealthSnapshot>(FRONTEND_HEALTH_EVENT, { detail: snapshot }));
}

function shouldThrottle(key: string): boolean {
  const now = Date.now();
  const lastRun = lastIssueByKey.get(key) ?? 0;
  if (now - lastRun < ISSUE_THROTTLE_MS) return true;
  lastIssueByKey.set(key, now);
  return false;
}

export function getFrontendHealthSnapshot(): FrontendHealthSnapshot {
  return snapshot;
}

export function subscribeFrontendHealth(listener: (state: FrontendHealthSnapshot) => void): () => void {
  const handler = (event: Event) => {
    const customEvent = event as CustomEvent<FrontendHealthSnapshot>;
    if (customEvent.detail) listener(customEvent.detail);
  };

  window.addEventListener(FRONTEND_HEALTH_EVENT, handler as EventListener);
  return () => window.removeEventListener(FRONTEND_HEALTH_EVENT, handler as EventListener);
}

export function markFrontendHealthy() {
  snapshot = {
    level: "healthy",
    lastIssue: snapshot.lastIssue,
    updatedAt: new Date().toISOString(),
  };
  emitSnapshot();
}

export function reportFrontendIssue(input: {
  type: FrontendIssueType;
  message: string;
  service?: string;
  level?: FrontendHealthLevel;
}) {
  const service = input.service ?? "frontend";
  const timestamp = new Date().toISOString();
  const key = `${input.type}:${service}:${input.message}`;
  if (shouldThrottle(key)) return;

  const level = input.level ?? (input.type === "unexpected_error" ? "error" : "warning");
  const shouldNotifyUser = input.type !== "socket_disconnection";

  snapshot = {
    level,
    lastIssue: {
      type: input.type,
      message: input.message,
      service,
      timestamp,
    },
    updatedAt: timestamp,
  };

  if (shouldNotifyUser) {
    notify.warning(input.message);
  }
  void sendErrorLog({
    message: `[${input.type}] ${input.message}`,
    componentStack: service,
    timestamp,
  }).catch(() => undefined);

  emitSnapshot();
}
