import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiService } from "@/services/apiService";
import { useAppStore } from "@/stores/appStore";
import { notify } from "@/services/notifyService";

/**
 * Hooks padronizados para entidades globais.
 *
 * - Single source of truth: React Query é o fetcher, Zustand é o cache cross-page.
 * - Evita múltiplos fetches simultâneos (mesma query key é deduplicada por React Query).
 * - Sincroniza automaticamente o resultado no store global.
 * - Toast em caso de erro (uma vez por mudança de status).
 */

export function useConversations(enabled = true) {
  const setConversations = useAppStore((s) => s.setConversations);

  const query = useQuery({
    queryKey: ["conversations"],
    queryFn: () => apiService.getConversations(false),
    enabled,
    staleTime: 60_000,
    retry: 2,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (query.data && Array.isArray(query.data)) setConversations(query.data);
  }, [query.data, setConversations]);

  useEffect(() => {
    if (query.isError) notify.error("Falha ao carregar conversas");
  }, [query.isError]);

  return query;
}

export function useMetrics(enabled = true) {
  const setMetrics = useAppStore((s) => s.setMetrics);

  const query = useQuery({
    queryKey: ["metrics"],
    queryFn: () => apiService.getMetrics(),
    enabled,
    refetchInterval: 30_000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (query.data && typeof query.data === "object") setMetrics(query.data);
  }, [query.data, setMetrics]);

  useEffect(() => {
    if (query.isError) notify.error("Falha ao carregar métricas");
  }, [query.isError]);

  return query;
}

export function useSessions(enabled = true) {
  const setSessions = useAppStore((s) => s.setSessions);

  const query = useQuery({
    queryKey: ["sessions"],
    queryFn: () => apiService.listSessions(),
    enabled,
    refetchInterval: 10_000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (query.data && Array.isArray(query.data)) setSessions(query.data);
  }, [query.data, setSessions]);

  useEffect(() => {
    if (query.isError) notify.error("Falha ao carregar sessões");
  }, [query.isError]);

  return query;
}
