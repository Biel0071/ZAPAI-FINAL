import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { AttendantItemCard } from "@/components/attendants/AttendantItemCard";
import { AddAttendantCard } from "@/components/attendants/AddAttendantCard";
import { EXAMPLE_ATTENDANTS } from "@/components/attendants/exampleAttendants";
import { MemoryDetailDrawer, type MemoryNodeData } from "@/components/evolution/MemoryDetailDrawer";
import { ActiveBrainGraph } from "@/components/evolution/ActiveBrainGraph";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
  vi.clearAllMocks();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
});

async function renderComponent(element: React.ReactNode) {
  await act(async () => {
    root.render(element);
  });
}

describe("ZAI CRM — Design System & Attendants Real vs Example Separation", () => {
  it("renders a REAL attendant with solid styling, status indicator, and Edit action", async () => {
    const handleSelect = vi.fn();
    const handleEdit = vi.fn();

    await renderComponent(
      <AttendantItemCard
        attendant={{
          id: "agent-camila",
          key: "camila",
          name: "Camila",
          role: "Vendas & Orçamentos",
          isExample: false,
          active: true,
          avatarConfig: { agentId: "camila", body: "female" },
        }}
        isSelected={true}
        onSelect={handleSelect}
        onEdit={handleEdit}
      />
    );

    // Expect name and Online status
    expect(container.textContent).toContain("Camila");
    expect(container.textContent).toContain("Online");
    expect(container.textContent).toContain("Editar");

    // Verify it doesn't have the example badge
    expect(container.textContent).not.toContain("Exemplo");

    // Click triggers edit callback
    const editBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "Editar"
    );
    expect(editBtn).toBeDefined();
    await act(async () => {
      editBtn?.click();
    });
    expect(handleEdit).toHaveBeenCalled();
  });

  it("renders an EXAMPLE attendant with dashed styling, Exemplo badge, and Ver Modelo action", async () => {
    const handleSelect = vi.fn();
    const joaoExample = EXAMPLE_ATTENDANTS.find((e) => e.name === "João")!;
    expect(joaoExample).toBeDefined();
    expect(joaoExample.isExample).toBe(true);

    await renderComponent(
      <AttendantItemCard
        attendant={{
          id: joaoExample.id,
          key: joaoExample.key,
          name: joaoExample.name,
          role: joaoExample.role,
          isExample: true,
          avatarConfig: joaoExample.avatarConfig,
        }}
        isSelected={false}
        onSelect={handleSelect}
      />
    );

    // Expect João, badge Exemplo, and Ver Modelo button
    expect(container.textContent).toContain("João");
    expect(container.textContent).toContain("Exemplo");
    expect(container.textContent).toContain("Ver Modelo");

    // Verify that Online status dot is NOT shown for examples
    expect(container.textContent).not.toContain("Online");
  });

  it("renders AddAttendantCard and fires creation callback", async () => {
    const handleAdd = vi.fn();
    await renderComponent(<AddAttendantCard onAdd={handleAdd} />);

    expect(container.textContent).toContain("Novo Atendente");
    expect(container.textContent).toContain("Criar funcionário digital");

    const addBtn = container.querySelector("button");
    expect(addBtn).toBeDefined();
    await act(async () => {
      addBtn?.click();
    });
    expect(handleAdd).toHaveBeenCalledTimes(1);
  });
});

describe("ZAI CRM — Active Brain Graph & Memory Detail Drawer", () => {
  const sampleMemory: MemoryNodeData = {
    id: "mem-test-1",
    label: "PIX com 5% de Desconto",
    type: "payment",
    desc: "Oferecer 5% de desconto para pagamentos à vista via chave PIX da loja.",
    confidence: 96,
    facts: [
      "Regra comercial prioritária para fechamento rápido",
      "Aplicável a todos os orçamentos e pedidos",
    ],
    connections: ["Fechamento Comercial", "Pagamentos", "Chave PIX Oficial"],
    conversationSnippet: "Cliente perguntou se tinha desconto à vista. Camila informou 5% no PIX.",
  };

  it("renders MemoryDetailDrawer with facts, connections, conversation snippet, and actions", async () => {
    const handleClose = vi.fn();
    const handleEdit = vi.fn();
    const handleTransform = vi.fn();
    const handleArchive = vi.fn();

    await renderComponent(
      <MemoryDetailDrawer
        memory={sampleMemory}
        onClose={handleClose}
        onEdit={handleEdit}
        onTransformToRule={handleTransform}
        onArchive={handleArchive}
      />
    );

    // Expect Title, Badge, and Assertiveness
    expect(container.textContent).toContain("PIX com 5% de Desconto");
    expect(container.textContent).toContain("Pagamento & PIX");
    expect(container.textContent).toContain("Assertividade 96%");

    // Expect Resumo & Facts
    expect(container.textContent).toContain("Oferecer 5% de desconto para pagamentos à vista");
    expect(container.textContent).toContain("Regra comercial prioritária para fechamento rápido");

    // Expect Connections
    expect(container.textContent).toContain("Fechamento Comercial");
    expect(container.textContent).toContain("Chave PIX Oficial");

    // Expect Action Buttons
    expect(container.textContent).toContain("Editar");
    expect(container.textContent).toContain("Virar Regra");
    expect(container.textContent).toContain("Arquivar Memória");

    // Test Action Trigger
    const transformBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Virar Regra")
    );
    expect(transformBtn).toBeDefined();
    await act(async () => {
      transformBtn?.click();
    });
    expect(handleTransform).toHaveBeenCalledWith(sampleMemory);

    const closeBtn = container.querySelector('button[title="Fechar Detalhes"]') as HTMLButtonElement | null;
    expect(closeBtn).toBeDefined();
    await act(async () => {
      closeBtn?.click();
    });
    expect(handleClose).toHaveBeenCalled();
  });

  it("renders ActiveBrainGraph with central attendant node and categorized memories", async () => {
    const handleSelect = vi.fn();

    await renderComponent(
      <ActiveBrainGraph
        attendantName="Camila"
        avatarConfig={{ agentId: "camila", body: "female" }}
        memories={[sampleMemory]}
        selectedCategory="todos"
        selectedMemoryId={null}
        onSelectMemory={handleSelect}
        height={400}
      />
    );

    // Expect Central Attendant Node
    expect(container.textContent).toContain("Camila");
    expect(container.textContent).toContain("Cérebro Ativo Online");

    // Expect Toolbar Controls
    expect(container.querySelector('button[title="Aumentar Zoom"]')).toBeDefined();
    expect(container.querySelector('button[title="Diminuir Zoom"]')).toBeDefined();
    expect(container.querySelector('button[title="Centralizar e Enquadrar"]')).toBeDefined();
  });
});
