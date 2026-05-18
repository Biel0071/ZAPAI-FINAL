/**
 * Runtime Hardening & Storage Protection — loaded BEFORE React renders.
 *
 * Guards against:
 *  1. JSON.parse crashes (corrupt Zustand/auth storage)
 *  2. replaceAll / replace / trim / map / filter on undefined/null
 *  3. localStorage/sessionStorage unavailability (incognito, storage full)
 *  4. Stale chunk recovery flags
 *  5. Corrupt storage auto-cleanup
 */

const STORAGE_VERSION = "zapflow_storage_v3";
const OFFICIAL_BUILD_KEY = "zapai:build:active";
const OFFICIAL_BUILD_MARKER = "official-frontend-8080";
const LEGACY_STORAGE_KEYS = [
  "chunk_recovery",
  "zapflow_chunk_recovery",
  "zapai:runtime:diag",
  "lovable-preview-state",
  "lovable-runtime-state",
  "swift-wa-assist-runtime",
  "swift-wa-assist-auth",
];
const LEGACY_STORAGE_PREFIXES = [
  "lovable",
  "swift-wa-assist",
  "supabase.auth.",
];

// ── 1. Safe JSON.parse ──────────────────────────────────────────────
const _originalParse = JSON.parse;
JSON.parse = function safeJsonParse(
  text: string,
  reviver?: (this: unknown, key: string, value: unknown) => unknown,
): unknown {
  try {
    return _originalParse(text, reviver);
  } catch (err) {
    console.warn(
      "[RuntimeHardening] JSON.parse failed on:",
      typeof text === "string" ? text.substring(0, 80) : typeof text,
    );

    // If the corrupt payload looks like it's from our storage, clear it
    if (typeof text === "string" && /state|token|role|session|zapai/i.test(text)) {
      try {
        console.warn("[RuntimeHardening] Clearing corrupt storage...");
        safeStorageClear();
      } catch {
        // ignore
      }
    }
    return null;
  }
};

// ── 2. Safe Storage Accessors ───────────────────────────────────────
function isStorageAvailable(storage: Storage | undefined): boolean {
  if (!storage) return false;
  try {
    const testKey = "__zapflow_test__";
    storage.setItem(testKey, "1");
    storage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

function safeGetItem(key: string): string | null {
  try {
    if (isStorageAvailable(window.localStorage)) {
      return window.localStorage.getItem(key);
    }
  } catch {
    // ignore
  }
  try {
    if (isStorageAvailable(window.sessionStorage)) {
      return window.sessionStorage.getItem(key);
    }
  } catch {
    // ignore
  }
  return null;
}

function safeSetItem(key: string, value: string): void {
  try {
    if (isStorageAvailable(window.localStorage)) {
      window.localStorage.setItem(key, value);
    }
  } catch {
    // ignore
  }
}

function safeStorageClear(): void {
  try {
    window.localStorage.clear();
  } catch {
    // ignore
  }
  try {
    window.sessionStorage.clear();
  } catch {
    // ignore
  }
}

// ── 3. Storage Version Migration ────────────────────────────────────
function migrateStorage(): void {
  try {
    const currentVersion = safeGetItem(STORAGE_VERSION);
    if (currentVersion === "3") return;

    if (currentVersion && currentVersion !== "3") {
      console.warn("[RuntimeHardening] Storage version mismatch — resetting runtime fragments...");
      clearLegacyRuntimeFragments();
    }

    safeSetItem(STORAGE_VERSION, "3");
  } catch {
    // ignore
  }
}

function clearLegacyRuntimeFragments(): void {
  if (typeof window === "undefined") return;

  const storages = [window.localStorage, window.sessionStorage].filter(Boolean) as Storage[];
  for (const storage of storages) {
    try {
      const keysToRemove: string[] = [];
      for (let index = 0; index < storage.length; index += 1) {
        const key = storage.key(index);
        if (!key) continue;
        if (LEGACY_STORAGE_KEYS.includes(key) || LEGACY_STORAGE_PREFIXES.some((prefix) => key.startsWith(prefix))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((key) => storage.removeItem(key));
    } catch {
      // ignore
    }
  }
}

function enforceOfficialFrontendMarker(): void {
  try {
    safeSetItem(OFFICIAL_BUILD_KEY, OFFICIAL_BUILD_MARKER);
  } catch {
    // ignore
  }
}

// ── 4. Clean up stale recovery flags ────────────────────────────────
function cleanRecoveryFlags(): void {
  try {
    window.addEventListener(
      "load",
      () => {
        setTimeout(() => {
          try {
            sessionStorage.removeItem("zapflow_chunk_recovery");
            sessionStorage.removeItem("chunk_recovery");
          } catch {
            // ignore
          }
        }, 5000);
      },
      { once: true },
    );
  } catch {
    // ignore
  }
}

// ── 5. Global Safe String Helper ────────────────────────────────────
function installSafeStringHelper(): void {
  if (typeof window === "undefined") return;

  (window as Record<string, unknown>).__safeString = (val: unknown): string =>
    val === null || val === undefined ? "" : String(val);

  (window as Record<string, unknown>).__safeArray = (val: unknown): unknown[] =>
    Array.isArray(val) ? val : [];
}

// ── 6. Global unhandled error interceptors ──────────────────────────
function installGlobalErrorInterceptors(): void {
  if (typeof window === "undefined") return;

  // Intercept TypeError crashes that don't make it to ErrorBoundary
  window.addEventListener("error", (event) => {
    const msg = event.message ?? "";
    const isRuntimeTypeError =
      msg.includes("is not a function") ||
      msg.includes("Cannot read properties of undefined") ||
      msg.includes("Cannot read properties of null") ||
      msg.includes("is not iterable");

    if (isRuntimeTypeError) {
      console.warn("[RuntimeHardening] Intercepted TypeError:", msg);
      // Don't prevent default — let ErrorBoundary handle it
      // But log it for diagnostics
    }
  });

  // Chunk load error from dynamic imports
  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    const msg = reason instanceof Error ? reason.message : String(reason ?? "");

    if (
      msg.includes("dynamically imported module") ||
      msg.includes("ChunkLoadError") ||
      msg.includes("Importing a module script failed")
    ) {
      console.warn("[RuntimeHardening] Chunk load rejection:", msg);
      const recoveryCount = Number(sessionStorage.getItem("zapflow_chunk_recovery") || "0");
      if (recoveryCount < 2) {
        sessionStorage.setItem("zapflow_chunk_recovery", String(recoveryCount + 1));
        event.preventDefault();
        window.location.reload();
      }
    }
  });
}

// ── Execute all hardening on module load ─────────────────────────────
export function injectRuntimeHardening(): void {
  if (typeof window === "undefined") return;

  migrateStorage();
  clearLegacyRuntimeFragments();
  enforceOfficialFrontendMarker();
  cleanRecoveryFlags();
  installSafeStringHelper();
  installGlobalErrorInterceptors();

  console.info("[RuntimeHardening] Active — official frontend marker enforced.");
}

// Auto-execute on import
injectRuntimeHardening();