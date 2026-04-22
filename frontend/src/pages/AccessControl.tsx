import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const users = [
  { name: "Alice Master", role: "MASTER" },
  { name: "Bruno Admin", role: "ADMIN" },
  { name: "Carla Agente", role: "AGENTE" },
  { name: "Diego Viewer", role: "VISUALIZADOR" },
];

export default function AccessControl() {
  return (
    <div className="min-h-screen">
      <Header title="Usuários e Acessos" subtitle="Controle de permissões por perfil" />
      <div className="p-6">
        <Card className="glass-card">
          <CardHeader><CardTitle className="font-display">Perfis de acesso</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {users.map((user) => (
              <div key={user.name} className="flex items-center justify-between rounded-lg border border-border bg-card p-3">
                <span className="font-medium">{user.name}</span>
                <Badge variant="secondary">{user.role}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
