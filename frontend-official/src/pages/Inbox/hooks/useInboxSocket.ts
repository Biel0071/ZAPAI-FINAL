import { useCallback } from "react";
import { emitInboxSocketEvent, forceReconnectInboxSocket } from "@/runtime/socket/socketManager";

export function useInboxSocket() {
  const emitArchiveChat = useCallback((chatId: string) => {
    emitInboxSocketEvent("archive_chat", chatId);
  }, []);

  const emitUnarchiveChat = useCallback((chatId: string) => {
    emitInboxSocketEvent("unarchive_chat", chatId);
  }, []);

  const emitAddTag = useCallback((chatId: string, tag: string | string[]) => {
    // Original code used:
    // emitInboxSocketEvent("add_tag", { chatId: id, tags: nextTags });
    // or emitInboxSocketEvent("add_tag", { chatId: selectedConversation.id, tag: normalizedTag });
    if (typeof tag === "string") {
      emitInboxSocketEvent("add_tag", { chatId, tag });
    } else {
      emitInboxSocketEvent("add_tag", { chatId, tags: tag });
    }
  }, []);

  const emitRemoveTag = useCallback((chatId: string, tag: string) => {
    emitInboxSocketEvent("remove_tag", { chatId, tag });
  }, []);

  const forceReconnect = useCallback(() => {
    forceReconnectInboxSocket();
  }, []);

  return {
    emitArchiveChat,
    emitUnarchiveChat,
    emitAddTag,
    emitRemoveTag,
    forceReconnect,
  };
}
