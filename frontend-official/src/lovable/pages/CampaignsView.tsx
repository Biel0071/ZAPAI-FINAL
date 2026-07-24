import type { ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PaperPlaneTilt, ListChecks, ChartLineUp } from "@phosphor-icons/react";

export type CampaignsTab = "compose" | "history" | "analysis";

export interface CampaignsViewProps {
  summaryCards: ReactNode;
  composer: ReactNode;
  listSection: ReactNode;
  analysisSection: ReactNode;
  activeTab: CampaignsTab;
  onTabChange: (tab: CampaignsTab) => void;
  historyCount?: number;
}

export function CampaignsView({
  summaryCards,
  composer,
  listSection,
  analysisSection,
  activeTab,
  onTabChange,
  historyCount = 0,
}: CampaignsViewProps) {
  return (
    <div className="page-container section-stack">
      {summaryCards}

      <Tabs value={activeTab} onValueChange={(value) => onTabChange(value as CampaignsTab)} className="w-full">
        <TabsList className="grid w-full max-w-xl grid-cols-3 rounded-2xl">
          <TabsTrigger value="compose" className="gap-2 rounded-xl">
            <PaperPlaneTilt className="h-4 w-4" />
            Novo Disparo
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2 rounded-xl">
            <ListChecks className="h-4 w-4" />
            Histórico
            {historyCount > 0 && (
              <span className="ml-1 rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                {historyCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="analysis" className="gap-2 rounded-xl">
            <ChartLineUp className="h-4 w-4" />
            Análise IA
          </TabsTrigger>
        </TabsList>

        <TabsContent value="compose" className="mt-5 focus-visible:outline-none">
          {composer}
        </TabsContent>
        <TabsContent value="history" className="mt-5 focus-visible:outline-none">
          {listSection}
        </TabsContent>
        <TabsContent value="analysis" className="mt-5 focus-visible:outline-none">
          {analysisSection}
        </TabsContent>
      </Tabs>
    </div>
  );
}
