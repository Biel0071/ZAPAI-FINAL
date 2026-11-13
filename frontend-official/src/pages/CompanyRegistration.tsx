import { FormEvent, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { API_BASE_URL } from "@/core/lib/backendConfig";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function CompanyRegistration() {
  const [params] = useSearchParams();
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const token = params.get("token") || "";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setStatus("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/company-registration`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, companyName: form.get("companyName"), responsibleName: form.get("responsibleName"), username: form.get("username"), email: form.get("email"), password: form.get("password") }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível enviar a solicitação.");
      setStatus("Solicitação enviada. O acesso será liberado após a aprovação do administrador.");
      formElement.reset();
    } catch (error) { setStatus(error instanceof Error ? error.message : "Falha no cadastro."); }
    finally { setBusy(false); }
  }

  return <main className="min-h-screen bg-background p-4 flex items-center justify-center">
    <form onSubmit={(event) => void submit(event)} className="w-full max-w-lg space-y-4 rounded-2xl border border-border bg-card p-6 shadow-xl">
      <div><h1 className="text-xl font-bold">Solicitar cadastro da empresa</h1><p className="mt-1 text-sm text-muted-foreground">A conta fica pendente até a aprovação do administrador. Nenhum e-mail é enviado automaticamente.</p></div>
      {!token && <p role="alert" className="text-sm text-destructive">Este link está sem token de cadastro.</p>}
      {[ ["companyName", "Nome da empresa"], ["responsibleName", "Responsável"], ["username", "Login"], ["email", "E-mail"], ["password", "Senha"] ].map(([name, label]) => <div key={name} className="space-y-1.5"><Label htmlFor={name}>{label}</Label><Input id={name} name={name} required type={name === "email" ? "email" : name === "password" ? "password" : "text"} minLength={name === "password" ? 12 : undefined} maxLength={name === "password" ? 128 : undefined} autoComplete={name === "password" ? "new-password" : undefined} /></div>)}
      <Button type="submit" className="w-full" disabled={!token || busy}>{busy ? "Enviando…" : "Enviar para aprovação"}</Button>
      {status && <p role="status" className="text-sm text-muted-foreground">{status}</p>}
    </form>
  </main>;
}
