interface KpiTileProps {
  label: string;
  value: string;
}

export function KpiTile({ label, value }: KpiTileProps) {
  return (
    <article className="crm-card crm-hover-lift p-4">
      <p className="text-xs text-textSecondary">{label}</p>
      <p className="mt-2 text-3xl font-bold text-textPrimary">{value}</p>
    </article>
  );
}
