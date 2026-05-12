export type ZapAIBuildInfo = {
  version: string;
  hash: string;
  buildAt: string;
  environment: string;
};

const version = (import.meta.env.VITE_APP_VERSION as string | undefined)?.trim() || "stable";
const hash = (import.meta.env.VITE_APP_VERSION_LABEL as string | undefined)?.trim() || version;
const buildAt = new Date().toISOString();
const environment = import.meta.env.DEV ? "development" : "production";

export const zapaiBuildInfo: ZapAIBuildInfo = {
  version,
  hash,
  buildAt,
  environment,
};

export const ZAPAI_BUILD_STORAGE_KEY = "zapai:build:active";
export const ZAPAI_RUNTIME_DIAG_STORAGE_KEY = "zapai:runtime:diag";
