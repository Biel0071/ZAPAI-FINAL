import { useEffect, useState } from "react";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Cpu,
  Memory,
  HardDrive,
  Clock,
  Activity,
  Database,
  WhatsappLogo,
  Users,
  Shield,
  Server,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
} from "@phosphor-icons/react";

interface VPSMetrics {
  cpu: number;
  ram: number;
  disk: number;
  uptime: string;
}

interface BackendMetrics {
  health: "healthy" | "degraded" | "down";
  latency: number;
  uptime: string;
  queueJobs: number;
}

interface DatabaseMetrics {
  online: boolean;
  size: string;
  lastBackup: string;
  connections: number;
}

interface WhatsAppMetrics {
  onlineSessions: number;
  pendingQR: number;
  activeNumbers: number;
  sessionErrors: number;
}

interface UserMetrics {
  totalUsers: number;
  admins: number;
  accessesToday: number;
  activePlans: number;
}

export default function AdminMaster() {
  const [vpsMetrics, setVpsMetrics] = useState<VPSMetrics | null>(null);
  const [backendMetrics, setBackendMetrics] = useState<BackendMetrics | null>(null);
  const [databaseMetrics, setDatabaseMetrics] = useState<DatabaseMetrics | null>(null);
  const [whatsappMetrics, setWhatsappMetrics] = useState<WhatsAppMetrics | null>(null);
  const [userMetrics, setUserMetrics] = useState<UserMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadMetrics = async () => {
    try {
      setLoading(true);
      // Mock data - would be replaced with real API calls
      setVpsMetrics({
        cpu: 35,
        ram: 62,
        disk: 45,
        uptime: "15d 4h 23m",
      });
      setBackendMetrics({
        health: "healthy",
        latency: 45,
        uptime: "15d 4h 23m",
        queueJobs: 3,
      });
      setDatabaseMetrics({
        online: true,
        size: "2.4 GB",
        lastBackup: "2h ago",
        connections: 12,
      });
      setWhatsappMetrics({
        onlineSessions: 5,
        pendingQR: 0,
        activeNumbers: 5,
        sessionErrors: 0,
      });
      setUserMetrics({
        totalUsers: 127,
        admins: 3,
        accessesToday: 89,
        activePlans: 45,
      });
    } catch (error) {
      console.error("Failed to load admin metrics:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadMetrics();
    const interval = window.setInterval(() => void loadMetrics(), 30_000);
    return () => window.clearInterval(interval);
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    void loadMetrics();
  };

  return (
    <div className="min-h-screen bg-background">
      <Header title="Admin Master" subtitle="Painel de controle administrativo" />
      
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold font-display">Admin Master</h1>
            <p className="text-sm text-muted-foreground">Monitoramento e controle do sistema</p>
          </div>
          <Button onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>

        <Tabs defaultValue="infra" className="space-y-6">
          <TabsList className="bg-card/50 border border-border">
            <TabsTrigger value="infra">Infra VPS</TabsTrigger>
            <TabsTrigger value="backend">Backend</TabsTrigger>
            <TabsTrigger value="database">Banco</TabsTrigger>
            <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
            <TabsTrigger value="users">Usuários</TabsTrigger>
          </TabsList>

          {/* Infra VPS Tab */}
          <TabsContent value="infra" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {loading ? (
                <>
                  <Skeleton className="h-32" />
                  <Skeleton className="h-32" />
                  <Skeleton className="h-32" />
                  <Skeleton className="h-32" />
                </>
              ) : (
                <>
                  <Card className="glass-card">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Cpu className="h-4 w-4 text-primary" />
                        CPU
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold font-display">{vpsMetrics?.cpu}%</div>
                      <p className="text-xs text-muted-foreground mt-1">Uso atual</p>
                    </CardContent>
                  </Card>
                  <Card className="glass-card">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Memory className="h-4 w-4 text-primary" />
                        RAM
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold font-display">{vpsMetrics?.ram}%</div>
                      <p className="text-xs text-muted-foreground mt-1">Uso atual</p>
                    </CardContent>
                  </Card>
                  <Card className="glass-card">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <HardDrive className="h-4 w-4 text-primary" />
                        Disco
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold font-display">{vpsMetrics?.disk}%</div>
                      <p className="text-xs text-muted-foreground mt-1">Uso atual</p>
                    </CardContent>
                  </Card>
                  <Card className="glass-card">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Clock className="h-4 w-4 text-primary" />
                        Uptime
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-xl font-bold font-display">{vpsMetrics?.uptime}</div>
                      <p className="text-xs text-muted-foreground mt-1">Tempo online</p>
                    </CardContent>
                  </Card>
                </>
              )}
            </div>

            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="font-display">Processos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-3">
                      <Server className="h-5 w-5 text-success" />
                      <div>
                        <p className="font-medium">PM2 Backend</p>
                        <p className="text-xs text-muted-foreground">Running (PID: 12345)</p>
                      </div>
                    </div>
                    <Badge variant="default">Online</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-3">
                      <Server className="h-5 w-5 text-success" />
                      <div>
                        <p className="font-medium">Nginx</p>
                        <p className="text-xs text-muted-foreground">Running (PID: 67890)</p>
                      </div>
                    </div>
                    <Badge variant="default">Online</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-3">
                      <Server className="h-5 w-5 text-success" />
                      <div>
                        <p className="font-medium">PostgreSQL</p>
                        <p className="text-xs text-muted-foreground">Running (PID: 54321)</p>
                      </div>
                    </div>
                    <Badge variant="default">Online</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Backend Tab */}
          <TabsContent value="backend" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {loading ? (
                <>
                  <Skeleton className="h-32" />
                  <Skeleton className="h-32" />
                  <Skeleton className="h-32" />
                </>
              ) : (
                <>
                  <Card className="glass-card">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Activity className="h-4 w-4 text-primary" />
                        Health
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-2">
                        {backendMetrics?.health === "healthy" ? (
                          <CheckCircle className="h-6 w-6 text-success" />
                        ) : (
                          <XCircle className="h-6 w-6 text-destructive" />
                        )}
                        <span className="text-xl font-bold capitalize">{backendMetrics?.health}</span>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="glass-card">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Clock className="h-4 w-4 text-primary" />
                        Latency
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold font-display">{backendMetrics?.latency}ms</div>
                      <p className="text-xs text-muted-foreground mt-1">Response time</p>
                    </CardContent>
                  </Card>
                  <Card className="glass-card">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Server className="h-4 w-4 text-primary" />
                        Queue Jobs
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold font-display">{backendMetrics?.queueJobs}</div>
                      <p className="text-xs text-muted-foreground mt-1">Pending jobs</p>
                    </CardContent>
                  </Card>
                </>
              )}
            </div>

            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="font-display">Backend Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline">View Logs</Button>
                  <Button variant="outline">Restart Backend</Button>
                  <Button variant="outline">Clear Cache</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Database Tab */}
          <TabsContent value="database" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {loading ? (
                <>
                  <Skeleton className="h-32" />
                  <Skeleton className="h-32" />
                  <Skeleton className="h-32" />
                </>
              ) : (
                <>
                  <Card className="glass-card">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Database className="h-4 w-4 text-primary" />
                        PostgreSQL
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-2">
                        {databaseMetrics?.online ? (
                          <CheckCircle className="h-6 w-6 text-success" />
                        ) : (
                          <XCircle className="h-6 w-6 text-destructive" />
                        )}
                        <span className="text-xl font-bold">{databaseMetrics?.online ? "Online" : "Offline"}</span>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="glass-card">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <HardDrive className="h-4 w-4 text-primary" />
                        Size
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold font-display">{databaseMetrics?.size}</div>
                      <p className="text-xs text-muted-foreground mt-1">Database size</p>
                    </CardContent>
                  </Card>
                  <Card className="glass-card">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Users className="h-4 w-4 text-primary" />
                        Conexões
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold font-display">{databaseMetrics?.connections}</div>
                      <p className="text-xs text-muted-foreground mt-1">Active connections</p>
                    </CardContent>
                  </Card>
                </>
              )}
            </div>

            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="font-display">Backup Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-success" />
                    <div>
                      <p className="font-medium">Last Backup</p>
                      <p className="text-xs text-muted-foreground">{databaseMetrics?.lastBackup}</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm">Create Backup</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* WhatsApp Tab */}
          <TabsContent value="whatsapp" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {loading ? (
                <>
                  <Skeleton className="h-32" />
                  <Skeleton className="h-32" />
                  <Skeleton className="h-32" />
                  <Skeleton className="h-32" />
                </>
              ) : (
                <>
                  <Card className="glass-card">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <WhatsappLogo className="h-4 w-4 text-primary" />
                        Online Sessions
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold font-display">{whatsappMetrics?.onlineSessions}</div>
                      <p className="text-xs text-muted-foreground mt-1">Active sessions</p>
                    </CardContent>
                  </Card>
                  <Card className="glass-card">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-warning" />
                        Pending QR
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold font-display">{whatsappMetrics?.pendingQR}</div>
                      <p className="text-xs text-muted-foreground mt-1">Awaiting scan</p>
                    </CardContent>
                  </Card>
                  <Card className="glass-card">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-success" />
                        Active Numbers
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold font-display">{whatsappMetrics?.activeNumbers}</div>
                      <p className="text-xs text-muted-foreground mt-1">Connected</p>
                    </CardContent>
                  </Card>
                  <Card className="glass-card">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <XCircle className="h-4 w-4 text-destructive" />
                        Session Errors
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold font-display">{whatsappMetrics?.sessionErrors}</div>
                      <p className="text-xs text-muted-foreground mt-1">Errors today</p>
                    </CardContent>
                  </Card>
                </>
              )}
            </div>
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {loading ? (
                <>
                  <Skeleton className="h-32" />
                  <Skeleton className="h-32" />
                  <Skeleton className="h-32" />
                  <Skeleton className="h-32" />
                </>
              ) : (
                <>
                  <Card className="glass-card">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Users className="h-4 w-4 text-primary" />
                        Total Users
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold font-display">{userMetrics?.totalUsers}</div>
                      <p className="text-xs text-muted-foreground mt-1">Registered users</p>
                    </CardContent>
                  </Card>
                  <Card className="glass-card">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Shield className="h-4 w-4 text-primary" />
                        Admins
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold font-display">{userMetrics?.admins}</div>
                      <p className="text-xs text-muted-foreground mt-1">Master admins</p>
                    </CardContent>
                  </Card>
                  <Card className="glass-card">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Activity className="h-4 w-4 text-primary" />
                        Accesses Today
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold font-display">{userMetrics?.accessesToday}</div>
                      <p className="text-xs text-muted-foreground mt-1">Active sessions</p>
                    </CardContent>
                  </Card>
                  <Card className="glass-card">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-success" />
                        Active Plans
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold font-display">{userMetrics?.activePlans}</div>
                      <p className="text-xs text-muted-foreground mt-1">Paid subscriptions</p>
                    </CardContent>
                  </Card>
                </>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
