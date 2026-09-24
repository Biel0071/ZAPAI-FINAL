import "@testing-library/jest-dom";

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

const storageMap = new Map<string, string>();
const localStorageMock = {
  getItem: (key: string) => storageMap.get(key) ?? null,
  setItem: (key: string, value: string) => storageMap.set(key, String(value)),
  removeItem: (key: string) => storageMap.delete(key),
  clear: () => storageMap.clear(),
  key: (i: number) => Array.from(storageMap.keys())[i] ?? null,
  get length() {
    return storageMap.size;
  },
};

try {
  Object.defineProperty(window, "localStorage", {
    value: localStorageMock,
    writable: true,
    configurable: true,
  });
} catch {}

try {
  Object.defineProperty(globalThis, "localStorage", {
    value: localStorageMock,
    writable: true,
    configurable: true,
  });
} catch {}

