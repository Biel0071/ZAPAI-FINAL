/// <reference types="vite/client" />

import type { ZapAIBuildInfo, ZapAIRuntimeManifest } from "@/config/buildInfo";

interface ImportMetaEnv {
  readonly VITE_APP_VERSION?: string;
  readonly VITE_APP_VERSION_LABEL?: string;
  readonly VITE_BUILD_TIME?: string;
  readonly VITE_BUILD_COMMIT?: string;
}

declare global {
  interface Window {
    ZAPAI_BUILD: ZapAIBuildInfo;
    __ZAPFLOW_RUNTIME__?: ZapAIRuntimeManifest;
    ZAPAI_RUNTIME_HEALTH?: {
      buildHashMatch: boolean;
      apiHealthy: boolean;
      websocketHealthy: boolean;
      chunkHealthy: boolean;
      cacheHealthy: boolean;
      checkedAt: string;
      runtimeSource?: string;
      frontendOrigin?: string | null;
      apiOrigin?: string | null;
      socketOrigin?: string | null;
      mismatchReason?: string | null;
    };
  }
}

export {};
