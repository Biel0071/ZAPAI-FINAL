import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { forgotPassword } from "@/services/authService";
import { WhatsappLogo, ArrowLeft, Spinner, EnvelopeSimple } from "@phosphor-icons/react";

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);

      if (!email.trim() || !email.includes("@")) {
        setError("Digite um e-mail válido.");
        return;
      }

      setLoading(true);
      try {
        await forgotPassword(email);
        setSent(true);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erro ao enviar solicitação.";
        setError(msg);
      } finally {
        setLoading(false);
      }
    },
    [email]
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-2">
            <div className="rounded-xl bg-whatsapp p-2 text-white">
              <WhatsappLogo size={28} weight="fill" />
            </div>
            <h1 className="text-2xl font-display font-bold tracking-tight text-foreground">
              ZapAI <span className="text-whatsapp">CRM</span>
            </h1>
          </div>
        </div>

        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-lg">Recuperar senha</CardTitle>
            <CardDescription>
              {sent
                ? "Verifique seu e-mail para instruções."
                : "Enviaremos um link de recuperação para o seu e-mail."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {sent ? (
              <div className="space-y-4 text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-success/10 text-success">
                  <EnvelopeSimple size={24} weight="fill" />
                </div>
                <p className="text-sm text-muted-foreground">
                  Se o e-mail estiver cadastrado, você receberá um link de recuperação em breve.
                </p>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => navigate("/login")}
                >
                  <ArrowLeft size={16} className="mr-2" />
                  Voltar ao login
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <Alert variant="destructive" className="text-sm">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="admin@admin.com"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                    className="h-10"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full h-10 bg-whatsapp hover:bg-whatsapp-dark text-white font-medium"
                  disabled={loading}
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <Spinner size={18} className="animate-spin" />
                      Enviando...
                    </span>
                  ) : (
                    "Enviar link de recuperação"
                  )}
                </Button>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => navigate("/login")}
                    className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-2"
                  >
                    <ArrowLeft size={14} className="inline mr-1" />
                    Voltar ao login
                  </button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          ZapAI CRM &copy; {new Date().getFullYear()} — v1.0
        </p>
      </div>
    </div>
  );
}
