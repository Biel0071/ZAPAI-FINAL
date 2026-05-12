/**
 * Backend config — resolves API origin for all frontend requests.
 *
 * In production (Docker + Nginx):
 *   - VITE_API_URL is typically empty or "/"
 *   - Nginx proxies /api/* → backend:4025
 *   - API calls use relative paths: fetch("/api/health")
 *
 * In development:
 *   - VITE_API_URL = "http://localhost:4025" (or similar)
 *   - API calls use full URLs: fetch("http://localhost:4025/api/health")
 */

function resolveOrigin(): string {
  const configured = (import.meta.env.VITE_API_URL ?? "").trim();
  if (!configured || configured === "/") {
    // Production mode — nginx proxies API calls at same origin
    if (typeof window !== "undefined") {
      return window.location.origin;
    }
    return "";
  }

  const sanitized = configured.replace(/\/+$/, "");

  if (typeof window !== "undefined") {
    const isPreviewHttps = window.location?.protocol === "https:";
    const isConfiguredHttp = /^http:\/\//i.test(sanitized);

    if (isPreviewHttps && isConfiguredHttp) {
      console.warn(
        "[backendConfig] Mixed-content detected: page is HTTPS but API is HTTP.",
        "Set VITE_API_URL to https:// for full production SSL.",
      );
    }
  }

  return sanitized;
}

const configuredApiUrl = (import.meta.env.VITE_API_URL ?? "").trim().replace(/\/+$/, "");
const isPreviewHttps = typeof window !== "undefined" && window.location?.protocol === "https:";
const isConfiguredHttp = /^http:\/\//i.test(configuredApiUrl);

export const IS_MIXED_CONTENT_BLOCKED = Boolean(configuredApiUrl) && configuredApiUrl !== "/" && isPreviewHttps && isConfiguredHttp;

export const API_ORIGIN = resolveOrigin();
export const API_BASE_URL = API_ORIGIN ? `${API_ORIGIN}/api` : "/api";

export const IS_API_URL_CONFIGURED = true; // Always true — nginx proxies if no explicit URL
export const IS_OFFICIAL_PRODUCTION_API = true;
export const API_RUNTIME_STATUS: "online" | "offline" = "online";
