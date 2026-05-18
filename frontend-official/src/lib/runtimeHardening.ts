/**
 * Runtime Hardening & Storage Protection — loaded BEFORE React renders.
 *
 * Guards against:
 *  1. JSON.parse crashes (corrupt Zustand/auth storage)
 *  2. replaceAll / replace / trim / map / filter on undefined/null
 *  3. localStorage/sessionStorage unavailability (incognito, storage full)
 *  4. Stale chunk recovery flags
 *  5. Corrupt storage auto-cleanup
 *  6. Stale runtime manifest / legacy preview residue
 */

import {
  OFFICIAL_RUNTIME_MARKER,
  RUNTIME_SCHEMA_VERSION,
  ZAPAI_RUNTIME_MANIFEST_STORAGE_KEY,
  ZAPAI_RUNTIME_MARKER_STORAGE_KEY,
} from "@/config/buildInfo";

const STORAGE_VERSION = "zapflow_storage_v4";
const LEGACY_STORAGE_KEYS = [
  "chunk_recovery",
  "zapflow_chunk_recovery",
  "zapai:runtime:diag",
  "lovable-preview-state",
  "lovable-runtime-state",
  "swift-wa-assist-runtime",
  "swift-wa-assist-auth",
  "zapai:build:active",
];
const LEGACY_STORAGE_PREFIXES = [
  "lovable",
  "swift-wa-assist",
  "supabase.auth.",
];
const LEGACY_INDEXED_DB_PREFIXES = [
  "lovable",
  "swift-wa-assist",
  "supabase",
];

type StoredRuntimeManifest = {
  runtime?: string;
  marker?: string;
  hash?: string;
  schemaVersion?: string;
};

const _originalParse = JSON.parse;
JSON.parse = function safeJsonParse(
  text: string,
  reviver?: (this: unknown, key: string, value: unknown) => unknown,
): unknown {
  try {
    return _originalParse(text, reviver);
  } catch {
    console.warn(
      "[RuntimeHardening] JSON.parse failed on:",
      typeof text === "string" ? text.substring(0, 80) : typeof text,
    );

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

function safeRemoveItem(key: string): void {
  try {
    if (isStorageAvailable(window.localStorage)) {
      window.localStorage.removeItem(key);
    }
  } catch {
    // ignore
  }

  try {
    if (isStorageAvailable(window.sessionStorage)) {
      window.sessionStorage.removeItem(key);
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

function parseStoredRuntimeManifest(raw: string | null): StoredRuntimeManifest | null {
  if (!raw) return null;
  try {
    const parsed = _originalParse(raw) as StoredRuntimeManifest | string;
    if (parsed && typeof parsed === "object") {
      return parsed;
    }
    if (typeof parsed === "string") {
      return { marker: parsed };
    }
  } catch {
    return null;
  }
  return null;
}

function shouldResetRuntimeManifest(currentHash: string | null): boolean {
  const stored = parseStoredRuntimeManifest(safeGetItem(ZAPAI_RUNTIME_MANIFEST_STORAGE_KEY));
  const storedMarker = safeGetItem(ZAPAI_RUNTIME_MARKER_STORAGE_KEY);

  const runtimeMismatch = stored?.runtime && stored.runtime !== "official";
  const markerMismatch =
    (stored?.marker && stored.marker !== OFFICIAL_RUNTIME_MARKER) ||
    (storedMarker && storedMarker !== OFFICIAL_RUNTIME_MARKER);
  const schemaMismatch = stored?.schemaVersion && stored.schemaVersion !== RUNTIME_SCHEMA_VERSION;
  const hashMismatch = Boolean(currentHash && stored?.hash && stored.hash !== currentHash);

  return Boolean(runtimeMismatch || markerMismatch || schemaMismatch || hashMismatch);
}

function migrateStorage(currentHash: string | null): void {
  try {
    const currentVersion = safeGetItem(STORAGE_VERSION);
    const runtimeManifestResetNeeded = shouldResetRuntimeManifest(currentHash);
    if (currentVersion === "4" && !runtimeManifestResetNeeded) return;

    if ((currentVersion && currentVersion !== "4") || runtimeManifestResetNeeded) {
      console.warn("[RuntimeHardening] Storage/runtime mismatch — resetting runtime fragments...");
      clearLegacyRuntimeFragments();
      safeRemoveItem(ZAPAI_RUNTIME_MANIFEST_STORAGE_KEY);
      safeRemoveItem(ZAPAI_RUNTIME_MARKER_STORAGE_KEY);
    }

    safeSetItem(STORAGE_VERSION, "4");
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

function clearLegacyIndexedDb(): void {
  if (typeof window === "undefined" || typeof indexedDB === "undefined" || typeof indexedDB.databases !== "function") {
    return;
  }

  void indexedDB.databases()
    .then((databases) => {
      for (const database of databases) {
        const name = String(database?.name || "").toLowerCase();
        if (!name) continue;
        if (LEGACY_INDEXED_DB_PREFIXES.some((prefix) => name.startsWith(prefix))) {
          try {
            indexedDB.deleteDatabase(database.name as string);
          } catch {
            // ignore
          }
        }
      }
    })
    .catch(() => {
      // ignore
    });
}

function enforceOfficialFrontendMarker(): void {
  try {
    safeSetItem(ZAPAI_RUNTIME_MARKER_STORAGE_KEY, OFFICIAL_RUNTIME_MARKER);
  } catch {
    // ignore
  }
}

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

function installSafeStringHelper(): void {
  if (typeof window === "undefined") return;

  (window as Record<string, unknown>).__safeString = (val: unknown): string =>
    val === null || val === undefined ? "" : String(val);

  (window as Record<string, unknown>).__safeArray = (val: unknown): unknown[] =>
    Array.isArray(val) ? val : [];
}

function installGlobalErrorInterceptors(): void {
  if (typeof window === "undefined") return;

  window.addEventListener("error", (event) => {
    const msg = event.message ?? "";
    const isRuntimeTypeError =
      msg.includes("is not a function") ||
      msg.includes("Cannot read properties of undefined") ||
      msg.includes("Cannot read properties of null") ||
      msg.includes("is not iterable");

    if (isRuntimeTypeError) {
      console.warn("[RuntimeHardening] Intercepted TypeError:", msg);
    }
  });

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

export function injectRuntimeHardening(currentHash: string | null = null): void {
  if (typeof window === "undefined") return;

  migrateStorage(currentHash);
  clearLegacyRuntimeFragments();
  clearLegacyIndexedDb();
  enforceOfficialFrontendMarker();
  cleanRecoveryFlags();
  installSafeStringHelper();
  installGlobalErrorInterceptors();

  console.info("[RuntimeHardening] Active — official frontend marker enforced.");
}
