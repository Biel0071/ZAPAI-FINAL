import { QueryClient } from "@tanstack/react-query";
import { notify } from "@/services/notifyService";

/**
 * Configuração padronizada do React Query para todo o app.
 *
 * Política de estabilidade:
 * - retry: 1   → evita loops em endpoints que estão fora do ar
 * - staleTime: 15s → impede refetch agressivo enquanto navega
 * - refetchOnWindowFocus: false → evita múltiplos fetch ao trocar de aba
 * - onError global → toast amigável quando uma query falha
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 15_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 0,
      onError: (error: unknown) => {
        const message =
          error instanceof Error ? error.message : "Falha ao executar ação";
        notify.error(message);
      },
    },
  },
});
