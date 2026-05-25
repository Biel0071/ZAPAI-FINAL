export type ZapAIBuildInfo = {
  version: string;
  hash: string;
  buildAt: string;
  environment: string;
  commit: string;
};

export type ZapAIRuntimeManifest = {
  version: string;
  hash: string;
  buildTime: string;
  buildAt: string;
  commit: string;
  runtime: "official";
  visualSource: "frontend-official" | "lovable-sync";
  marker: string;
  frontend: "8080";
  backend: "4025";
  environment: string;
  schemaVersion: string;
  frontendOrigin: string | null;
  apiOrigin: string | null;
  socketOrigin: string | null;
};

export const OFFICIAL_RUNTIME_MARKER = "official-frontend-8080";
export const OFFICIAL_FRONTEND_PORT = "8080";
export const OFFICIAL_BACKEND_PORT = "4025";
export const RUNTIME_SCHEMA_VERSION = "4";
export const ZAPAI_RUNTIME_MANIFEST_STORAGE_KEY = "zapai:runtime:manifest";
export const ZAPAI_RUNTIME_MARKER_STORAGE_KEY = "zapai:runtime:marker";
export const ZAPAI_RUNTIME_DIAG_STORAGE_KEY = "zapai:runtime:diag";
export const ZAPAI_BUILD_STORAGE_KEY = ZAPAI_RUNTIME_MANIFEST_STORAGE_KEY;

const version = (import.meta.env.VITE_APP_VERSION as string | undefined)?.trim() || "stable";
const hash = (import.meta.env.VITE_APP_VERSION_LABEL as string | undefined)?.trim() || version;
const buildAt = (import.meta.env.VITE_BUILD_TIME as string | undefined)?.trim() || new Date().toISOString();
const commit = (import.meta.env.VITE_BUILD_COMMIT as string | undefined)?.trim() || "dev";
const environment = import.meta.env.DEV ? "development" : "production";

export const zapaiBuildInfo: ZapAIBuildInfo = {
  version,
  hash,
  buildAt,
  environment,
  commit,
};

export const zapaiRuntimeManifest: ZapAIRuntimeManifest = {
  version,
  hash,
  buildTime: buildAt,
  buildAt,
  commit,
  runtime: "official",
  visualSource: "lovable-sync",
  marker: OFFICIAL_RUNTIME_MARKER,
  frontend: OFFICIAL_FRONTEND_PORT,
  backend: OFFICIAL_BACKEND_PORT,
  environment,
  schemaVersion: RUNTIME_SCHEMA_VERSION,
  frontendOrigin: null,
  apiOrigin: null,
  socketOrigin: null,
};

export function createRuntimeManifest(overrides: Partial<ZapAIRuntimeManifest> = {}): ZapAIRuntimeManifest {
  return {
    ...zapaiRuntimeManifest,
    ...overrides,
  };
}
