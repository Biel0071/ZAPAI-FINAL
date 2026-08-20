import { create } from "zustand";
import { apiService } from "@/services/apiService";

export type ServiceStatus = "ok" | "degraded" | "down" | "disabled" | "unknown";

export interface HealthState {
  status: "ok" | "degraded" | "down" | "unknown";
  services: {
    db: ServiceStatus;
    redis: ServiceStatus;
    whatsapp: ServiceStatus;
    memory: ServiceStatus;
    eventLoop: ServiceStatus;
  };
  diagnostics: any;
  lastUpdated: string | null;
}

interface SystemHealthStore {
  health: HealthState;
  isPolling: boolean;
  startPolling: (intervalMs?: number) => void;
  stopPolling: () => void;
  fetchHealth: () => Promise<void>;
}

const initialState: HealthState = {
  status: "unknown",
  services: {
    db: "unknown",
    redis: "unknown",
    whatsapp: "unknown",
    memory: "unknown",
    eventLoop: "unknown",
  },
  diagnostics: null,
  lastUpdated: null,
};

let pollingIntervalId: number | null = null;

export const useSystemHealthStore = create<SystemHealthStore>((set, get) => ({
  health: initialState,
  isPolling: false,

  fetchHealth: async () => {
    try {
      const response = await apiService.getHealth();
      if (response && response.services) {
        set({ health: { ...response, lastUpdated: new Date().toISOString() } });
      }
    } catch (error) {
      console.error("Failed to fetch system health:", error);
      set((state) => ({
        health: {
          ...state.health,
          status: "down",
          services: {
            ...state.health.services,
            db: "down",
            whatsapp: "down",
          },
          lastUpdated: new Date().toISOString(),
        },
      }));
    }
  },

  startPolling: (intervalMs = 30000) => {
    const state = get();
    if (state.isPolling) return;
    
    state.fetchHealth(); // Initial fetch
    pollingIntervalId = window.setInterval(() => {
      get().fetchHealth();
    }, intervalMs);
    
    set({ isPolling: true });
  },

  stopPolling: () => {
    if (pollingIntervalId) {
      window.clearInterval(pollingIntervalId);
      pollingIntervalId = null;
    }
    set({ isPolling: false });
  },
}));
