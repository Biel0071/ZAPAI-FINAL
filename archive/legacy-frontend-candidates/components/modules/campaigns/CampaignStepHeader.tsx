type Step = 'contacts' | 'messages' | 'settings' | 'review';

interface CampaignStepHeaderProps {
  currentStep: Step;
}

const labels: Array<{ key: Step; label: string }> = [
  { key: 'contacts', label: 'Contatos' },
  { key: 'messages', label: 'Mensagens' },
  { key: 'settings', label: 'Configuracoes' },
  { key: 'review', label: 'Revisao' },
];

export function CampaignStepHeader({ currentStep }: CampaignStepHeaderProps) {
  const currentIndex = labels.findIndex((item) => item.key === currentStep);

  return (
    <div className="mb-4 rounded-lg border border-borderSoft bg-panelSoft p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-textSecondary">Etapas</p>
      <div className="grid grid-cols-4 gap-2 text-center text-xs">
        {labels.map((item, index) => (
          <div
            key={item.key}
            className={`rounded-md border px-2 py-1 ${index <= currentIndex ? 'border-accent/40 bg-accent/15 text-green-200' : 'border-borderSoft text-textMuted'}`}
          >
            {index + 1}. {item.label}
          </div>
        ))}
      </div>
    </div>
  );
}
