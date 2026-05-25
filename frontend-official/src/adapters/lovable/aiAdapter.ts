export type AILovableSection = {
  id:
    | "status"
    | "prompt"
    | "business-hours"
    | "absence"
    | "reactivation"
    | "training"
    | "learning"
    | "memory"
    | "advanced";
  label: string;
};

export type AILovableViewModel = {
  title: string;
  subtitle: string;
  sections: AILovableSection[];
};

export function createAILovableViewModel(): AILovableViewModel {
  return {
    title: "Configuração de IA",
    subtitle: "Central de Controle",
    sections: [
      { id: "status", label: "Status da IA" },
      { id: "prompt", label: "Editor de Prompt" },
      { id: "business-hours", label: "Horário Comercial" },
      { id: "absence", label: "Mensagem de Ausência" },
      { id: "reactivation", label: "Fila de Reativação" },
      { id: "training", label: "Central de Treinamento" },
      { id: "learning", label: "AI Learning" },
      { id: "memory", label: "Configuração de Memória" },
      { id: "advanced", label: "Ajustes Avançados" },
    ],
  };
}
