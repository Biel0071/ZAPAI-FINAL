import { useState, useEffect, useCallback } from "react";

const avatarMemoryCache = new Map<string, string | null>();
const avatarInFlight = new Map<string, Promise<string | null>>();

interface AvatarUpdatedDetail {
  conversationId: string;
  avatarUrl: string | null;
}

export function useResolvedAvatar(conversationId?: string | null, initialAvatar?: string | null) {
  const [avatar, setAvatar] = useState<string | null>(() => {
    if (initialAvatar) return initialAvatar;
    if (conversationId && avatarMemoryCache.has(conversationId)) {
      return avatarMemoryCache.get(conversationId) || null;
    }
    return null;
  });
  const [loading, setLoading] = useState<boolean>(false);

  // Sync with initialAvatar if it changes externally
  useEffect(() => {
    if (initialAvatar) {
      if (conversationId) {
        avatarMemoryCache.set(conversationId, initialAvatar);
      }
      setAvatar(initialAvatar);
    }
  }, [conversationId, initialAvatar]);

  // Fetch avatar function
  const fetchAvatar = useCallback(
    async (force = false): Promise<string | null> => {
      if (!conversationId) return null;

      if (!force && initialAvatar) {
        avatarMemoryCache.set(conversationId, initialAvatar);
        setAvatar(initialAvatar);
        return initialAvatar;
      }

      if (!force && avatarMemoryCache.has(conversationId)) {
        const cached = avatarMemoryCache.get(conversationId) || null;
        setAvatar(cached);
        return cached;
      }

      setLoading(true);

      const flightKey = `${conversationId}:${force ? "force" : "cached"}`;
      let promise = avatarInFlight.get(flightKey);

      if (!promise) {
        const url = `/api/conversations/${encodeURIComponent(conversationId)}/avatar${force ? "?force=true" : ""}`;
        promise = fetch(url, { credentials: "include" })
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            const resolvedUrl = (data?.avatarUrl as string) || null;
            avatarMemoryCache.set(conversationId, resolvedUrl);
            avatarInFlight.delete(flightKey);

            if (typeof window !== "undefined") {
              window.dispatchEvent(
                new CustomEvent<AvatarUpdatedDetail>("zapflow:avatar-updated", {
                  detail: { conversationId, avatarUrl: resolvedUrl },
                }),
              );
            }

            return resolvedUrl;
          })
          .catch(() => {
            avatarMemoryCache.set(conversationId, null);
            avatarInFlight.delete(flightKey);
            return null;
          });

        avatarInFlight.set(flightKey, promise);
      }

      try {
        const result = await promise;
        setAvatar(result);
        return result;
      } finally {
        setLoading(false);
      }
    },
    [conversationId, initialAvatar],
  );

  // Initial load
  useEffect(() => {
    let isMounted = true;
    if (!conversationId) {
      setAvatar(null);
      return;
    }

    if (initialAvatar) {
      avatarMemoryCache.set(conversationId, initialAvatar);
      setAvatar(initialAvatar);
      return;
    }

    if (avatarMemoryCache.has(conversationId)) {
      setAvatar(avatarMemoryCache.get(conversationId) || null);
      return;
    }

    void fetchAvatar(false).then((url) => {
      if (isMounted) {
        setAvatar(url);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [conversationId, initialAvatar, fetchAvatar]);

  // Listen for real-time updates across multiple components for the same contact
  useEffect(() => {
    if (!conversationId || typeof window === "undefined") return;

    const handleAvatarUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<AvatarUpdatedDetail>;
      if (customEvent.detail && customEvent.detail.conversationId === conversationId) {
        setAvatar(customEvent.detail.avatarUrl);
      }
    };

    window.addEventListener("zapflow:avatar-updated", handleAvatarUpdate);
    return () => {
      window.removeEventListener("zapflow:avatar-updated", handleAvatarUpdate);
    };
  }, [conversationId]);

  const refetch = useCallback(
    async (options?: { force?: boolean }) => {
      return fetchAvatar(options?.force ?? false);
    },
    [fetchAvatar],
  );

  return { avatar, loading, refetch };
}
