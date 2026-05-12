/// <reference types="vite/client" />

import type { ZapAIBuildInfo } from "@/config/buildInfo";

interface ImportMetaEnv {
  readonly VITE_APP_VERSION?: string;
  readonly VITE_APP_VERSION_LABEL?: string;
}

declare global {
  interface Window {
    ZAPAI_BUILD: ZapAIBuildInfo;
    ZAPAI_RUNTIME_HEALTH?: {
      buildHashMatch: boolean;
      apiHealthy: boolean;
      websocketHealthy: boolean;
      chunkHealthy: boolean;
      cacheHealthy: boolean;
      checkedAt: string;
    };
  }
}

export {};
