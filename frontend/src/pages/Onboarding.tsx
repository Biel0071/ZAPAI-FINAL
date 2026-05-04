import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { WhatsappLogo, CheckCircle, ArrowRight, ArrowLeft, Gear } from "@phosphor-icons/react";

const ONBOARDING_DONE_KEY = "zapai_onboarding_done";

function isOnboardingDone() {
  return localStorage.getItem(ONBOARDING_DONE_KEY) === "1";
}

export function markOnboardingDone() {
  localStorage.setItem(ONBOARDING_DONE_KEY, "1");
}

export default function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [companyName, setCompanyName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalSteps = 3;

  const handleNext = useCallback(() => {
    setError(null);
    if (step === 0 && !companyName.trim()) {
      setError("Digite o nome da sua empresa.");
      return;
    }
    if (step === 1 && (!adminEmail.trim() || !adminEmail.includes("@"))) {
      setError("Digite um e-mail válido.");
      return;
    }
    if (step < totalSteps - 1) {
      setStep((s) => s + 1);
    } else {
      handleFinish();
    }
  }, [step, companyName, adminEmail]);

  const handleFinish = useCallback(async () => {
    setLoading(true);
    // Simulate setup API call (future: POST /api/setup)
    await new Promise((r) => setTimeout(r, 800));
    markOnboardingDone();
    setLoading(false);
    navigate("/login", { replace: true });
  }, [navigate]);

  // If onboarding already done, redirect to login
  if (isOnboardingDone()) {
    navigate("/login", { replace: true });
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-2">
            <div className="rounded-xl bg-whatsapp p-2 text-white">
              <WhatsappLogo size={28} weight="fill" />
            </div>
            <h1 className="text-2xl font-display font-bold tracking-tight text-foreground">
              ZapAI <span className="text-whatsapp">CRM</span>
            </h1>
          </div>
          <p className="text-sm text-muted-foreground">Configuração inicial</p>
        </div>

        <Card>
          <CardHeader className="space-y-1">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">
                {step === 0 && "Bem-vindo!"}
                {step === 1 && "Contato do administrador"}
                {step === 2 && "Conectar WhatsApp"}
              </CardTitle>
              <span className="text-xs text-muted-foreground">
                {step + 1}/{totalSteps}
              </span>
            </div>
            <CardDescription>
              {step === 0 && "Configure os dados básicos da sua empresa."}
              {step === 1 && "Informe o e-mail do administrador principal."}
              {step === 2 && "Conecte seu WhatsApp para começar a atender."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <Alert variant="destructive" className="text-sm mb-4">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {step === 0 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="company">Nome da empresa</Label>
                  <Input
                    id="company"
                    type="text"
                    placeholder="Minha Empresa"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="h-10"
                    autoFocus
                  />
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail do administrador</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="admin@empresa.com"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    className="h-10"
                    autoFocus
                  />
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="whatsapp">Número do WhatsApp (opcional)</Label>
                  <Input
                    id="whatsapp"
                    type="tel"
                    placeholder="5511999999999"
                    value={whatsappNumber}
                    onChange={(e) => setWhatsappNumber(e.target.value)}
                    className="h-10"
                  />
                </div>
                <div className="rounded-lg bg-muted p-3 text-xs text-muted-foreground space-y-1">
                  <div className="flex items-center gap-1">
                    <Gear size={14} />
                    <span className="font-medium">Dica:</span>
                  </div>
                  <p>
                    A conexão do WhatsApp pode ser feita depois no menu
                    <strong> Conexões</strong> do dashboard.
                  </p>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 mt-6">
              {step > 0 && (
                <Button
                  variant="outline"
                  className="flex-1 h-10"
                  onClick={() => setStep((s) => s - 1)}
                  disabled={loading}
                >
                  <ArrowLeft size={16} className="mr-1" />
                  Voltar
                </Button>
              )}
              <Button
                className="flex-1 h-10 bg-whatsapp hover:bg-whatsapp-dark text-white font-medium"
                onClick={handleNext}
                disabled={loading}
              >
                {loading ? (
                  "Salvando..."
                ) : step === totalSteps - 1 ? (
                  <>
                    <CheckCircle size={16} className="mr-1" />
                    Finalizar
                  </>
                ) : (
                  <>
                    Avançar
                    <ArrowRight size={16} className="ml-1" />
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          ZapAI CRM &copy; {new Date().getFullYear()} — v1.0
        </p>
      </div>
    </div>
  );
}
