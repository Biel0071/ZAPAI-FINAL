function resolveOrigin(): string {
  const configured = (import.meta.env.VITE_API_URL ?? "").trim();
  if (configured) {
    const sanitized = configured.replace(/\/+$/, "");

    if (typeof window !== "undefined") {
      const isPreviewHttps = window.location?.protocol === "https:";
      const isConfiguredHttp = /^http:\/\//i.test(sanitized);

      if (isPreviewHttps && isConfiguredHttp) {
        return "";
      }
    }

    return sanitized;
  }
  return "";
}

const configuredApiUrl = (import.meta.env.VITE_API_URL ?? "").trim().replace(/\/+$/, "");
const isPreviewHttps = typeof window !== "undefined" && window.location?.protocol === "https:";
const isConfiguredHttp = /^http:\/\//i.test(configuredApiUrl);

export const IS_MIXED_CONTENT_BLOCKED = Boolean(configuredApiUrl) && isPreviewHttps && isConfiguredHttp;

export const API_ORIGIN = resolveOrigin();
export const API_BASE_URL = API_ORIGIN ? `${API_ORIGIN}/api` : "";

export const IS_API_URL_CONFIGURED = Boolean(API_ORIGIN);
export const IS_OFFICIAL_PRODUCTION_API = true;
export const API_RUNTIME_STATUS: "online" | "offline" = IS_API_URL_CONFIGURED ? "online" : "offline";
