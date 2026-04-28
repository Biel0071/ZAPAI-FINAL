import { PropsWithChildren } from 'react';

interface InboxInfoCardProps extends PropsWithChildren {
  title: string;
}

export function InboxInfoCard({ title, children }: InboxInfoCardProps) {
  return (
    <article className="rounded-lg border border-borderSoft bg-panelSoft p-3">
      <h4 className="mb-2 text-sm font-semibold text-textPrimary">{title}</h4>
      {children}
    </article>
  );
}
