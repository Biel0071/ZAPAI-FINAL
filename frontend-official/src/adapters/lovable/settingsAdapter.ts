export type SettingsLovableViewModel = {
  sections: Array<{ id: string; label: string }>;
};

export function createSettingsLovableViewModel(): SettingsLovableViewModel {
  return {
    sections: [
      { id: "perfil", label: "Perfil" },
      { id: "empresa", label: "Empresa" },
      { id: "equipe", label: "Equipe" },
      { id: "notificacoes", label: "Notificações" },
      { id: "seguranca", label: "Segurança" },
      { id: "faturamento", label: "Faturamento" },
      { id: "aparencia", label: "Aparência" },
      { id: "idioma", label: "Idioma" },
      { id: "api-keys", label: "API Keys" },
      { id: "webhooks", label: "Webhooks" },
      { id: "dados", label: "Dados" },
    ],
  };
}
