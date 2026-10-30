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

describe("MessageRow Disparo Card Component", () => {
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

  it("renders disparo card when message type is disparo", async () => {
    const message: ChatMessage = {
      id: "msg_disparo_1",
      conversationId: "conv_123",
      phone: "553193672075",
      text: "[DISPARO REALIZADO]\n📢 Fluxo: Betoneira CSM - 400L\n🛡️ Modo: Anti-Ban Humanizado (8s delay)\n📱 Destinatário: Carlos Vidal Da Silva\n⏱️ Etapas: 1 etapa(s)\n━━━━━━━━━━━━━━━━━━━━\nOlá Carlos, segue a oferta especial da Betoneira CSM 400L para sua obra!",
      content: "[DISPARO REALIZADO]\n📢 Fluxo: Betoneira CSM - 400L\n🛡️ Modo: Anti-Ban Humanizado (8s delay)\n📱 Destinatário: Carlos Vidal Da Silva\n⏱️ Etapas: 1 etapa(s)\n━━━━━━━━━━━━━━━━━━━━\nOlá Carlos, segue a oferta especial da Betoneira CSM 400L para sua obra!",
      fromMe: true,
      direction: "outgoing",
      status: "sent",
      sender: "campaign",
      type: "disparo",
      sessionId: "main",
      createdAt: new Date().toISOString(),
      timestamp: new Date().toISOString(),
      analysis_json: {
        isDisparo: true,
        flowName: "Betoneira CSM - 400L",
        cadence: "Anti-Ban Humanizado (8s delay)",
        contactName: "Carlos Vidal Da Silva",
        phone: "553193672075",
        sessionId: "main",
        totalSteps: 1,
        currentStep: 1,
      },
    } as any;

    await renderComponent(<MessageRow message={message} {...defaultProps} />);

    const card = document.querySelector('[data-testid="disparo-data-card"]');
    expect(card).not.toBeNull();
    expect(document.body.textContent).toContain("Disparo Realizado");
    expect(document.body.textContent).toContain("Betoneira CSM - 400L");
    expect(document.body.textContent).toContain("Carlos Vidal Da Silva");
    expect(document.body.textContent).toContain("Anti-Ban Humanizado (8s delay)");
    expect(document.body.textContent).toContain("Olá Carlos, segue a oferta especial");
  });

  it("renders disparo card when message has sender campaign and text contains [DISPARO", async () => {
    const message: ChatMessage = {
      id: "msg_disparo_2",
      conversationId: "conv_456",
      phone: "553198346078",
      text: "[DISPARO REALIZADO]\n📢 Fluxo: Campanha Churrasqueira Pré-Moldada\n🛡️ Modo: Disparo Turbo (4s delay)\n📱 Destinatário: JOSEBALBINO\n⏱️ Etapas: 2 etapa(s)\n━━━━━━━━━━━━━━━━━━━━\nCondições exclusivas para entrega amanhã!",
      content: "[DISPARO REALIZADO]\n📢 Fluxo: Campanha Churrasqueira Pré-Moldada\n🛡️ Modo: Disparo Turbo (4s delay)\n📱 Destinatário: JOSEBALBINO\n⏱️ Etapas: 2 etapa(s)\n━━━━━━━━━━━━━━━━━━━━\nCondições exclusivas para entrega amanhã!",
      fromMe: true,
      direction: "outgoing",
      status: "sent",
      sender: "campaign",
      type: "text",
      sessionId: "main",
      createdAt: new Date().toISOString(),
      timestamp: new Date().toISOString(),
    } as any;

    await renderComponent(<MessageRow message={message} {...defaultProps} />);

    const card = document.querySelector('[data-testid="disparo-data-card"]');
    expect(card).not.toBeNull();
    expect(document.body.textContent).toContain("Campanha Churrasqueira Pré-Moldada");
    expect(document.body.textContent).toContain("JOSEBALBINO");
    expect(document.body.textContent).toContain("Disparo Turbo (4s delay)");
  });
});
