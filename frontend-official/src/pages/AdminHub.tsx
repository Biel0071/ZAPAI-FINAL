import React, { useState } from "react";
import { Header } from "@/components/layout/Header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Queue, 
  HardDrives, 
  ShieldCheck, 
  TrendUp, 
  GitCommit, 
  FileText, 
  Flask 
} from "@phosphor-icons/react";

// Lazy load the existing admin pages
const QueuePage = React.lazy(() => import("./Queue"));
const MasterNodesPage = React.lazy(() => import("./MasterNodes"));
const MasterAdminsPage = React.lazy(() => import("./MasterAdmins"));
const MasterDeploymentsPage = React.lazy(() => import("./MasterDeployments"));
const MasterVersionsPage = React.lazy(() => import("./MasterVersions"));
const MasterLogsPage = React.lazy(() => import("./MasterLogs"));
const TestsPage = React.lazy(() => import("./Tests"));

export default function AdminHub() {
  const [activeTab, setActiveTab] = useState("queue");

  return (
    <div className="flex h-screen flex-col bg-background">
      <Header />
      <div className="flex-1 overflow-auto p-4 md:p-6 lg:p-8 animate-fade-in">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <ShieldCheck className="h-6 w-6 text-primary" />
              Central de Administração
            </h1>
            <p className="text-sm text-muted-foreground">
              Visão consolidada de todas as ferramentas de infraestrutura, cluster e configurações sistêmicas do ZAPFLOW.
            </p>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="flex flex-wrap h-auto p-1 bg-card/50 border border-border/50 gap-1 justify-start mb-6">
              <TabsTrigger value="queue" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary flex items-center gap-2 text-xs py-2">
                <Queue size={16} /> Fila de Envios
              </TabsTrigger>
              <TabsTrigger value="nodes" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary flex items-center gap-2 text-xs py-2">
                <HardDrives size={16} /> Cluster
              </TabsTrigger>
              <TabsTrigger value="users" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary flex items-center gap-2 text-xs py-2">
                <ShieldCheck size={16} /> Usuários Master
              </TabsTrigger>
              <TabsTrigger value="deployments" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary flex items-center gap-2 text-xs py-2">
                <TrendUp size={16} /> Deployments
              </TabsTrigger>
              <TabsTrigger value="versions" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary flex items-center gap-2 text-xs py-2">
                <GitCommit size={16} /> Versões
              </TabsTrigger>
              <TabsTrigger value="logs" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary flex items-center gap-2 text-xs py-2">
                <FileText size={16} /> Logs
              </TabsTrigger>
              <TabsTrigger value="tests" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary flex items-center gap-2 text-xs py-2">
                <Flask size={16} /> Central de Testes
              </TabsTrigger>
            </TabsList>

            <React.Suspense fallback={<div className="flex h-32 items-center justify-center text-muted-foreground text-sm">Carregando painel...</div>}>
              {/* CSS hack para esconder cabecalhos originais dos componentes de pagina caso eles usem classes comuns como .flex.h-14, .border-b, ou a tag <header> */}
              <style>{`
                .admin-hub-content-wrapper header,
                .admin-hub-content-wrapper .sticky.top-0 {
                  display: none !important;
                }
                .admin-hub-content-wrapper > div {
                  height: auto !important;
                  min-height: 500px;
                }
              `}</style>
              <div className="admin-hub-content-wrapper relative bg-card/30 border border-border/40 rounded-xl overflow-hidden">
                <TabsContent value="queue" className="m-0 border-0 p-0"><QueuePage /></TabsContent>
                <TabsContent value="nodes" className="m-0 border-0 p-0"><MasterNodesPage /></TabsContent>
                <TabsContent value="users" className="m-0 border-0 p-0"><MasterAdminsPage /></TabsContent>
                <TabsContent value="deployments" className="m-0 border-0 p-0"><MasterDeploymentsPage /></TabsContent>
                <TabsContent value="versions" className="m-0 border-0 p-0"><MasterVersionsPage /></TabsContent>
                <TabsContent value="logs" className="m-0 border-0 p-0"><MasterLogsPage /></TabsContent>
                <TabsContent value="tests" className="m-0 border-0 p-0"><TestsPage /></TabsContent>
              </div>
            </React.Suspense>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
