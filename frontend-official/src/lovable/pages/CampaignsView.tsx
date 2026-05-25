import type { ReactNode } from "react";

export interface CampaignsViewProps {
  summaryCards: ReactNode;
  composer: ReactNode;
  listSection: ReactNode;
}

export function CampaignsView({ summaryCards, composer, listSection }: CampaignsViewProps) {
  return (
    <div className="page-container section-stack">
      {summaryCards}
      {composer}
      {listSection}
    </div>
  );
}
