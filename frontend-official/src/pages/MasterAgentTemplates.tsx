import { useCallback, useEffect, useState } from "react";
import { BookOpen, Check, Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { requestApiEndpoint } from "@/core/services/apiService";

type TemplateVersion = {
  id: string;
  template_id: string;
  template_key: string;
  title: string;
  niche: string;
  version_id: string;
  version: number;
  status: "draft" | "published" | "archived";
  prompt_text: string;
  unresolved_facts: string[];
};

export default function MasterAgentTemplates() {
  const [templates, setTemplates] = useState<TemplateVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [templateKey, setTemplateKey] = useState("");
  const [niche, setNiche] = useState("");
  const [title, setTitle] = useState("");
  const [promptText, setPromptText] = useState("");
  const [draftTexts, setDraftTexts] = useState<Record<string, string>>({});

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await requestApiEndpoint<TemplateVersion[] | { data?: TemplateVersion[] }>("/api/admin/master/agent-templates?limit=100");
      setTemplates(Array.isArray(result) ? result : result?.data || []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível carregar os templates.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const createDraft = async () => {
    setSaving(true);
    setError("");
    try {
      await requestApiEndpoint("/api/admin/master/agent-templates", "POST", { templateKey, niche, title, promptText });
      setTemplateKey(""); setNiche(""); setTitle(""); setPromptText("");
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível criar o rascunho.");
    } finally {
      setSaving(false);
    }
  };

  const publish = async (template: TemplateVersion) => {
    setSaving(true);
    setError("");
    try {
      await requestApiEndpoint(`/api/admin/master/agent-templates/${encodeURIComponent(template.template_id || template.id)}/versions/${encodeURIComponent(template.version_id)}/publish`, "POST");
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível publicar a versão.");
    } finally {
      setSaving(false);
    }
  };

  const updateDraft = async (template: TemplateVersion) => {
    setSaving(true); setError("");
    try {
      await requestApiEndpoint(`/api/admin/master/agent-templates/${encodeURIComponent(template.template_id || template.id)}/versions/${encodeURIComponent(template.version_id)}`, "PUT", { promptText: draftTexts[template.version_id] ?? template.prompt_text, requiredFields: [], unresolvedFacts: template.unresolved_facts || [], guardrails: [] });
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar o rascunho.");
    } finally { setSaving(false); }
  };

  const createVersion = async (template: TemplateVersion) => {
    setSaving(true); setError("");
    try {
      await requestApiEndpoint(`/api/admin/master/agent-templates/${encodeURIComponent(template.template_id || template.id)}/versions`, "POST");
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível criar a versão.");
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-5 p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold"><BookOpen className="h-5 w-5 text-primary" /> Biblioteca de prompts</h2>
          <p className="mt-1 text-sm text-muted-foreground">Rascunhos exigem revisão e publicação. Modelos publicados ficam disponíveis no assistente de criação.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}><RefreshCw className="mr-2 h-4 w-4" /> Atualizar</Button>
      </div>

      {error && <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}

      <Card>
        <CardHeader><CardTitle className="text-base">Novo rascunho global</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <Input aria-label="Chave do template" placeholder="chave-exemplo" value={templateKey} onChange={(event) => setTemplateKey(event.target.value)} />
          <Input aria-label="Nicho" placeholder="Nicho" value={niche} onChange={(event) => setNiche(event.target.value)} />
          <Input aria-label="Título" placeholder="Título do modelo" value={title} onChange={(event) => setTitle(event.target.value)} />
          <div className="md:col-span-2"><Textarea aria-label="Texto do prompt" placeholder="Prompt; campos disponíveis: {{agent.name}}, {{agent.role}}, {{store.name}}, {{store.verifiedFacts}}, {{contact.name}}, {{contact.phone}}" value={promptText} onChange={(event) => setPromptText(event.target.value)} /></div>
          <div className="md:col-span-2"><Button onClick={() => void createDraft()} disabled={saving || !templateKey.trim() || !niche.trim() || !title.trim() || !promptText.trim()}><Plus className="mr-2 h-4 w-4" /> Criar rascunho</Button></div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Modelos globais</h3>
        {loading ? <p className="text-sm text-muted-foreground">Carregando...</p> : templates.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum modelo cadastrado.</p> : templates.map((template) => (
          <Card key={`${template.template_id || template.id}:${template.version_id}`}>
            <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <p className="font-medium">{template.title} <span className="text-xs text-muted-foreground">· {template.niche} · v{template.version}</span></p>
                {template.status === "draft" ? <Textarea aria-label={`Prompt versão ${template.version}`} value={draftTexts[template.version_id] ?? template.prompt_text} onChange={(event) => setDraftTexts((previous) => ({ ...previous, [template.version_id]: event.target.value }))} className="mt-2 min-h-24 text-xs" /> : <p className="mt-1 truncate text-xs text-muted-foreground">{template.prompt_text}</p>}
                {template.unresolved_facts?.length > 0 && <p className="mt-1 text-xs text-amber-600">Fatos pendentes: {template.unresolved_facts.join(", ")}</p>}
              </div>
              {template.status === "draft" ? <div className="flex gap-2"><Button size="sm" variant="outline" disabled={saving} onClick={() => void updateDraft(template)}>Salvar</Button><Button size="sm" disabled={saving} onClick={() => void publish(template)}><Check className="mr-2 h-4 w-4" /> Publicar v{template.version}</Button></div> : template.status === "published" ? <Button size="sm" variant="outline" disabled={saving} onClick={() => void createVersion(template)}>Criar próxima versão</Button> : <span className="text-xs text-muted-foreground">Arquivado</span>}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
