import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MessageRow } from "@/pages/Inbox/components/MessageRow";
import type { ChatMessage } from "@/core/services/apiService";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let root: Root | undefined;

afterEach(async () => {
  if (root) await act(async () => root?.unmount());
  root = undefined;
  document.body.innerHTML = "";
});

async function renderComponent(node: React.ReactNode) {
  if (!root) {
    const container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  }
  await act(async () => root!.render(node));
}

describe("MessageRow Order Card Component", () => {
  const defaultProps = {
    reaction: undefined,
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

  it("renders native WhatsApp order card when mediaType is order", async () => {
    const onOpenOrdersDrawer = vi.fn();
    const message: ChatMessage = {
      id: "msg_order_1",
      conversationId: "conv_123",
      phone: "553193672075",
      text: "🛒 *PEDIDO GERADO — #ORD_998877*\n━━━━━━━━━━━━━━━━━━━━━━\n• *Tijolo 8 Furos* (100x) — R$ 250.00\n• *Cimento CP II 50kg* (5x) — R$ 175.00\n\n💰 *Subtotal:* R$ 425.00\n🚚 *Frete:* R$ 50.00\n💵 *TOTAL DO PEDIDO:* R$ 475.00\n📝 *Observações:* Entregar no período da manhã",
      content: "🛒 *PEDIDO GERADO — #ORD_998877*\n━━━━━━━━━━━━━━━━━━━━━━\n• *Tijolo 8 Furos* (100x) — R$ 250.00\n• *Cimento CP II 50kg* (5x) — R$ 175.00\n\n💰 *Subtotal:* R$ 425.00\n🚚 *Frete:* R$ 50.00\n💵 *TOTAL DO PEDIDO:* R$ 475.00\n📝 *Observações:* Entregar no período da manhã",
      fromMe: true,
      direction: "outgoing",
      status: "sent",
      sender: "human",
      mediaType: "order",
      sessionId: "main",
      timestamp: "10:30",
    };

    await renderComponent(
      <MessageRow
        {...defaultProps}
        message={message}
        onOpenOrdersDrawer={onOpenOrdersDrawer}
      />
    );

    const card = document.querySelector('[data-testid="whatsapp-order-card"]');
    expect(card).not.toBeNull();
    expect(card?.textContent).toContain("Pedido WhatsApp");
    expect(card?.textContent).toContain("#ORD_998877");
    expect(card?.textContent).toContain("100x Tijolo 8 Furos");
    expect(card?.textContent).toContain("R$ 475.00");
    expect(card?.textContent).toContain("Ver Detalhes do Pedido");

    // Verify unavailable fallback is NOT rendered
    expect(document.body.textContent).not.toContain("Indisponível");

    // Verify click opens orders drawer
    const viewButton = card?.querySelector("button");
    expect(viewButton).not.toBeNull();
    await act(async () => {
      viewButton?.click();
    });
    expect(onOpenOrdersDrawer).toHaveBeenCalledTimes(1);
  });

  it("renders native WhatsApp order card for incoming cart order", async () => {
    const onOpenOrdersDrawer = vi.fn();
    const message: ChatMessage = {
      id: "msg_order_inbound_2",
      conversationId: "conv_456",
      phone: "5531988887777",
      text: "🛒 *NOVO PEDIDO RECEBIDO (#order_12345)*\nTítulo: Pedido do Catálogo\nItens (1):\n• Caixa d’Água 1000L (1x) - R$ 380.00\nTotal: BRL 380.00\nObservação: Gostaria de pagar no PIX",
      content: "🛒 *NOVO PEDIDO RECEBIDO (#order_12345)*\nTítulo: Pedido do Catálogo\nItens (1):\n• Caixa d’Água 1000L (1x) - R$ 380.00\nTotal: BRL 380.00\nObservação: Gostaria de pagar no PIX",
      fromMe: false,
      direction: "incoming",
      status: "received",
      sender: "5531988887777",
      mediaType: "order",
      sessionId: "main",
      timestamp: "11:15",
    };

    await renderComponent(
      <MessageRow
        {...defaultProps}
        message={message}
        onOpenOrdersDrawer={onOpenOrdersDrawer}
      />
    );

    const card = document.querySelector('[data-testid="whatsapp-order-card"]');
    expect(card).not.toBeNull();
    expect(card?.textContent).toContain("Pedido WhatsApp");
    expect(card?.textContent).toContain("#order_12345");
    expect(card?.textContent).toContain("Recebido do Cliente");
    expect(card?.textContent).toContain("1x Caixa d’Água 1000L");
    expect(card?.textContent).toContain("R$ 380.00");
  });
});
