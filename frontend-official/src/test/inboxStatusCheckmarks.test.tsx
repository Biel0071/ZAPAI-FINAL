import { act, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MessageRow } from "@/pages/Inbox/components/MessageRow";
import { getMessageStatusMeta } from "@/pages/Inbox/utils";

vi.mock("@/core/runtime/hooks/useProtectedMediaUrl", () => ({
  useProtectedMedia: () => ({ url: null, loading: false }),
}));
vi.mock("@/components/inbox/AIMessageFeedback", () => ({
  AIMessageFeedback: () => null,
}));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let root: Root | undefined;
afterEach(async () => {
  if (root) await act(async () => root?.unmount());
  root = undefined;
  document.body.innerHTML = "";
});

function createProps(status: any): ComponentProps<typeof MessageRow> {
  return {
    message: {
      id: "test-msg-1",
      conversationId: "conv-1",
      content: "Mensagem de teste",
      fromMe: true,
      isAI: false,
      createdAt: "2026-11-05T10:00:00Z",
      status,
    },
    onReact: vi.fn(),
    onOpenMediaPreview: vi.fn(),
    isMenuOpen: false,
    isReactionPickerOpen: false,
    onToggleMenu: vi.fn(),
    onToggleReactionPicker: vi.fn(),
    onCopyMessage: vi.fn(),
    onReplyMessage: vi.fn(),
    onForwardMessage: vi.fn(),
    onDeleteMessage: vi.fn(),
    onDownloadMedia: vi.fn(),
    onToggleAudio: vi.fn(),
    isAudioLoading: false,
    isAudioPlaying: false,
    audioProgress: 0,
    audioDuration: 0,
    backendOnline: true,
  };
}

async function renderMessageRow(props: ComponentProps<typeof MessageRow>) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root!.render(<MessageRow {...props} />));
}

describe("Padrão Visual de Status do WhatsApp (1V, 2V, 2V Verde, 1V Vermelho)", () => {
  describe("Função getMessageStatusMeta", () => {
    it("1V cinza para enviado ao servidor ('sent' ou 'server_ack')", () => {
      const sentMeta = getMessageStatusMeta("sent");
      expect(sentMeta.icon).toBe("sent");
      expect(sentMeta.symbol).toBe("1V");
      expect(sentMeta.className).toContain("text-muted-foreground");

      const serverAckMeta = getMessageStatusMeta("server_ack");
      expect(serverAckMeta.icon).toBe("sent");
      expect(serverAckMeta.symbol).toBe("1V");
    });

    it("2V cinza para entregue no aparelho ('delivered' ou 'device_ack')", () => {
      const deliveredMeta = getMessageStatusMeta("delivered");
      expect(deliveredMeta.icon).toBe("delivered");
      expect(deliveredMeta.symbol).toBe("2V");
      expect(deliveredMeta.className).toContain("text-muted-foreground/80");

      const deviceAckMeta = getMessageStatusMeta("device_ack");
      expect(deviceAckMeta.icon).toBe("delivered");
      expect(deviceAckMeta.symbol).toBe("2V");
    });

    it("2V verde para lido/visualizado pelo cliente ('read' ou 'played')", () => {
      const readMeta = getMessageStatusMeta("read");
      expect(readMeta.icon).toBe("read");
      expect(readMeta.symbol).toBe("2V");
      expect(readMeta.className).toContain("text-emerald-500 font-bold");

      const playedMeta = getMessageStatusMeta("played");
      expect(playedMeta.icon).toBe("read");
      expect(playedMeta.symbol).toBe("2V");
      expect(playedMeta.className).toContain("text-emerald-500 font-bold");
    });

    it("1V vermelho para erro de envio ou contato bloqueado ('failed', 'error', 'blocked')", () => {
      const failedMeta = getMessageStatusMeta("failed");
      expect(failedMeta.icon).toBe("failed");
      expect(failedMeta.symbol).toBe("1V");
      expect(failedMeta.className).toContain("text-red-500 font-bold");

      const blockedMeta = getMessageStatusMeta("blocked");
      expect(blockedMeta.icon).toBe("failed");
      expect(blockedMeta.label).toContain("bloqueado");

      const errorMeta = getMessageStatusMeta("error");
      expect(errorMeta.icon).toBe("failed");
    });

    it("Relógio para mensagens em envio / na fila ('sending' ou 'pending')", () => {
      const sendingMeta = getMessageStatusMeta("sending");
      expect(sendingMeta.icon).toBe("clock");
      expect(sendingMeta.className).toContain("animate-pulse");

      const pendingMeta = getMessageStatusMeta("pending");
      expect(pendingMeta.icon).toBe("clock");
    });
  });

  describe("Renderização visual no componente MessageRow", () => {
    it("renderiza 1V cinza quando status é 'sent'", async () => {
      await renderMessageRow(createProps("sent"));
      const statusIcon = document.querySelector('[aria-label="1V Cinza: Enviado ao servidor"]');
      expect(statusIcon).not.toBeNull();
    });

    it("renderiza 2V cinza quando status é 'delivered'", async () => {
      await renderMessageRow(createProps("delivered"));
      const statusIcon = document.querySelector('[aria-label="2V Cinza: Entregue ao cliente"]');
      expect(statusIcon).not.toBeNull();
      expect(statusIcon?.classList.contains("text-muted-foreground/80")).toBe(true);
    });

    it("renderiza 2V verde quando status é 'read'", async () => {
      await renderMessageRow(createProps("read"));
      const statusIcon = document.querySelector('[aria-label="2V Verde: Lido pelo cliente"]');
      expect(statusIcon).not.toBeNull();
      expect(statusIcon?.classList.contains("text-emerald-500")).toBe(true);
    });

    it("renderiza 1V vermelho quando status é 'failed'", async () => {
      await renderMessageRow(createProps("failed"));
      const statusIcon = document.querySelector('[aria-label="1V Vermelho: Não entregue / Bloqueado"]');
      expect(statusIcon).not.toBeNull();
      expect(statusIcon?.classList.contains("text-red-500")).toBe(true);
    });

    it("renderiza relógio quando status é 'sending'", async () => {
      await renderMessageRow(createProps("sending"));
      const clockIcon = document.querySelector('svg.animate-pulse');
      expect(clockIcon).not.toBeNull();
    });
  });
});
