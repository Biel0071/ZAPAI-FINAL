import { useEffect, useState } from "react";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { GitCommit, Calendar, User, Clock, ArrowClockwise, CheckCircle } from "@phosphor-icons/react";
import { loadGitVersions, type GitCommitRow } from "@/services/adminMasterService";

export default function MasterVersions() {
  const [commits, setCommits] = useState<GitCommitRow[]>([]);
  const [currentVersion, setCurrentVersion] = useState<string>("unknown");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchVersions = async () => {
    setLoading(true);
    try {
      const res = await loadGitVersions();
      setCommits(res.commits);
      setCurrentVersion(res.currentVersion);
      setError(null);
    } catch (err: any) {
      setError("Não foi possível carregar o histórico de versões.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchVersions();
  }, []);

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <Header 
        title="Histórico de Versões" 
        subtitle="Registro de atualizações e builds de produção integrados com o GitHub" 
        runtimeState="running" 
      />
      <div className="page-container section-stack pb-12">
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-lg font-bold text-foreground">Atualizações Recentes</h2>
              <p className="text-xs text-muted-foreground">Histórico dos últimos commits compilados na VPS Master</p>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              className="gap-2 rounded-xl"
              onClick={() => void fetchVersions()}
              disabled={loading}
            >
              <ArrowClockwise className={loading ? "animate-spin h-4 w-4" : "h-4 w-4"} />
              Sincronizar builds
            </Button>
          </div>

          {error ? (
            <Card className="border-destructive/30 bg-destructive/5 text-destructive p-4 rounded-2xl">
              <p className="text-sm">{error}</p>
            </Card>
          ) : loading ? (
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex gap-4 items-start">
                  <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-5 w-1/3" />
                    <Skeleton className="h-4 w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : commits.length === 0 ? (
            <Card className="glass-card text-center p-8 rounded-2xl">
              <p className="text-sm text-muted-foreground">Nenhum registro de build disponível no momento.</p>
            </Card>
          ) : (
            <div className="relative border-l border-border/80 pl-6 ml-3 space-y-6">
              {commits.map((commit, index) => {
                const isActive = commit.shortHash === currentVersion;
                return (
                  <div key={commit.hash} className="relative group">
                    {/* Timeline Node dot */}
                    <span className={`absolute -left-[31px] top-1.5 flex h-4 w-4 items-center justify-center rounded-full border bg-background transition-all group-hover:scale-110 ${
                      isActive 
                        ? "border-primary bg-primary/20 text-primary" 
                        : "border-border bg-muted text-muted-foreground"
                    }`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${isActive ? "bg-primary" : "bg-muted-foreground"}`} />
                    </span>

                    <Card className={`glass-card rounded-2xl border-border/70 overflow-hidden transition-all duration-200 hover:border-border/100 ${
                      isActive ? "bg-primary/[0.02] border-primary/30" : ""
                    }`}>
                      <CardHeader className="p-5 pb-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono text-sm font-semibold text-foreground/90">
                                #{commit.shortHash}
                              </span>
                              {isActive ? (
                                <Badge className="bg-primary/25 text-primary hover:bg-primary/30 border border-primary/20 px-2 py-0 rounded-full text-[10px] font-bold uppercase tracking-wider">
                                  Versão Ativa
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="border-border/80 text-muted-foreground px-2 py-0 rounded-full text-[10px] font-semibold uppercase tracking-wider">
                                  Estável
                                </Badge>
                              )}
                            </div>
                            <h3 className="font-display text-sm font-bold text-foreground/90 leading-snug mt-1 group-hover:text-primary transition-colors">
                              {commit.message}
                            </h3>
                          </div>
                          
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground select-none">
                            <Calendar className="h-3.5 w-3.5" />
                            {commit.date}
                          </div>
                        </div>
                      </CardHeader>
                      
                      <CardContent className="p-5 pt-0 border-t border-border/40 bg-muted/[0.15] flex flex-wrap items-center justify-between gap-4 text-xs">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <User className="h-3.5 w-3.5 text-muted-foreground/80" />
                          <span>Autor: <strong className="text-foreground/85 font-medium">{commit.author}</strong></span>
                        </div>
                        <div className="flex items-center gap-1 text-emerald-500 font-semibold select-none">
                          <CheckCircle weight="fill" className="h-4 w-4" />
                          <span>Build Funcional</span>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
