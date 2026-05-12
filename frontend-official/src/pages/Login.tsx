import { useState } from "react";
import { motion } from "framer-motion";
import { Eye, EyeOff, Loader2, Lock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useAdminAuth } from "@/hooks/useAdminAuth";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAdminAuth();

  const [username, setUsername] = useState("zapadmin");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setLoading(true);
    setAuthError(null);

    try {
      await login({ username, password, remember });
      navigate("/dashboard", { replace: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao autenticar";
      if (message.toLowerCase().includes("timeout_login") || message.toLowerCase().includes("timeout")) {
        setAuthError("Tempo limite de autenticação excedido. Tente novamente.");
      } else {
        setAuthError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-10">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="h-full w-full bg-[linear-gradient(to_bottom,hsl(var(--background))_0%,hsl(var(--background)/0.96)_100%)]" />
        <div className="absolute inset-0 opacity-30 bg-[linear-gradient(to_right,hsl(var(--border)/0.55)_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border)/0.55)_1px,transparent_1px)] bg-[size:28px_28px]" />
      </div>

      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="relative z-10 w-full max-w-md rounded-lg border border-border/80 bg-card/95 p-6 shadow-lg"
      >
        <header className="mb-6 space-y-2">
          <h1 className="text-2xl font-semibold text-foreground">ZAPFLOW AI</h1>
          <p className="text-sm text-muted-foreground">Plataforma inteligente de atendimento e automação.</p>
        </header>

        {authError && (
          <Alert variant="destructive" className="mb-4 border-destructive/40 bg-destructive/10 text-destructive">
            <AlertTitle>Falha de autenticação</AlertTitle>
            <AlertDescription>{authError}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="login-username">Usuário</Label>
            <Input
              id="login-username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              placeholder="Digite o usuário"
              disabled={loading}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="login-password">Senha</Label>
            <div className="relative">
              <Input
                id="login-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                placeholder="Digite a senha"
                className="pr-10"
                disabled={loading}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-2 top-1/2 inline-flex -translate-y-1/2 items-center justify-center rounded-sm p-1 text-muted-foreground hover:text-foreground"
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                disabled={loading}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <label htmlFor="remember-session" className="inline-flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
              <Checkbox
                id="remember-session"
                checked={remember}
                onCheckedChange={(checked) => setRemember(Boolean(checked))}
                disabled={loading}
              />
              Permanecer conectado
            </label>
          </div>

          <Button type="submit" className="w-full" disabled={loading || !username.trim() || !password.trim()}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Entrando...
              </>
            ) : (
              <>
                <Lock className="h-4 w-4" />
                Entrar no Dashboard
              </>
            )}
          </Button>
        </form>
      </motion.section>
    </div>
  );
}