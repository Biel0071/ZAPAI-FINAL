import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import StoresPage from "@/pages/Stores/StoresPage";
import { apiService } from "@/core/services/apiService";

vi.mock("@/components/layout/Header", () => ({ Header: () => null }));
vi.mock("@/components/avatar-engine/ZaiAvatarRenderer", () => ({ ZaiAvatarRenderer: () => null }));
vi.mock("@/components/evolution/HistoryBootstrapPanel", () => ({
  HistoryBootstrapPanel: ({ initialSessionId, requestedMode }: { initialSessionId?: string; requestedMode?: string }) => (
    <div data-testid="store-link-panel">{requestedMode}:{initialSessionId || "selecionar"}</div>
  ),
}));
vi.mock("@/core/services/notifyService", () => ({
  notify: { error: vi.fn(), success: vi.fn() },
}));
vi.mock("@/core/services/apiService", () => ({
  apiService: {
    getStores: vi.fn(),
    createStore: vi.fn().mockResolvedValue({ success: true, id: "store-new" }),
    updateStore: vi.fn().mockResolvedValue({ success: true }),
    deleteStore: vi.fn().mockResolvedValue({ success: true }),
  },
}));

const store = {
  id: "store-1",
  name: "Loja Centro",
  address: "Rua das Flores, 42",
  knowledge: "Entregamos somente no bairro Centro.",
  attendant_name: "Ana",
  attendant_role: "Suporte",
  attendant_config: { voice: "clara", instructions: "Peça o número do pedido." },
  settings: { storeVisualDNA: { primaryColor: "#229944", defaultBadge: true } },
  numbers: [{
    id: 1,
    sessionId: "whatsapp-centro",
    sessionName: "WhatsApp Centro",
    phone: "5511999991111",
    status: "qr_ready",
    attendant: { key: "ana", name: "Ana", role: "Suporte", active: false },
  }],
};

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(apiService.getStores).mockResolvedValue({ success: true, stores: [store] });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

async function openPage() {
  await act(async () => root.render(<MemoryRouter><StoresPage /></MemoryRouter>));
}

async function clickButton(name: string | RegExp) {
  const button = [...document.querySelectorAll("button")].find(item => typeof name === "string"
    ? item.textContent?.trim() === name || item.getAttribute("aria-label") === name
    : name.test(item.getAttribute("aria-label") || item.textContent || ""));
  expect(button, `Botão ${name}`).toBeDefined();
  await act(async () => button?.click());
}

function getField(id: string) {
  const field = document.getElementById(id);
  expect(field).not.toBeNull();
  return field as HTMLInputElement;
}

describe("Lojas por WhatsApp", () => {
  it("cria uma loja sem inventar horários, descontos ou regras comerciais", async () => {
    await openPage();
    await clickButton("Nova Loja");
    expect(getField("store-hours")).toHaveValue("");
    expect(getField("store-policies")).toHaveValue("");
    expect(getField("store-segment")).toHaveValue("");
  });

  it("preserva a configuração comercial e visual ao editar dados da loja", async () => {
    await openPage();
    await clickButton(/Editar/);
    await clickButton("Salvar Alterações");
    expect(apiService.updateStore).toHaveBeenCalledWith("store-1", expect.objectContaining({
      name: store.name,
      attendant_name: store.attendant_name,
      attendant_role: store.attendant_role,
      attendant_config: store.attendant_config,
      settings: store.settings,
    }));
  });

  it("mostra o estado da conexão e do atendente sem marcar um agente pausado como ativo", async () => {
    await openPage();
    expect(document.body.textContent).toContain("Aguardando QR");
    expect(document.body.textContent).toContain("Pausado");
    expect(document.body.textContent).not.toContain("Offline");
  });

  it("exibe conhecimento e endereço cadastrados sem personagens de exemplo", async () => {
    await openPage();
    expect(document.body.textContent).toContain(store.address);
    expect(document.body.textContent).toContain(store.knowledge);
    expect(document.body.textContent).not.toContain("DNA Visual dos Atendentes");
    expect(document.body.textContent).not.toContain("Uniforme Padrão");
  });

  it("abre o vínculo canônico no contexto do WhatsApp escolhido", async () => {
    await openPage();
    await clickButton(/Editar vínculo.*WhatsApp Centro/);
    expect(document.querySelector('[data-testid="store-link-panel"]')).toHaveTextContent("store:whatsapp-centro");
  });

  it("distingue falha ao carregar de uma conta sem lojas e permite tentar novamente", async () => {
    vi.mocked(apiService.getStores).mockRejectedValueOnce(new Error("Servidor indisponível"));
    await openPage();
    expect(document.querySelector('[role="alert"]')).toHaveTextContent("Servidor indisponível");
    expect(document.body.textContent).not.toContain("Nenhuma loja cadastrada");
    await clickButton("Tentar novamente");
    expect(document.body.textContent).toContain("WhatsApp Centro");
  });
});
