import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { requestApiEndpoint } from "@/core/services/apiService";
import { notify } from "@/core/services/notifyService";
import { useUserRole } from "@/state/hooks/useUserRole";

type PromptTemplate = {
  id: string;
  scope: "platform" | "company";
  title: string;
  niche: string;
  version_id: string;
  version: number;
  status: "draft" | "published" | "archived";
  prompt_text: string;
  required_fields?: unknown[];
  unresolved_facts?: unknown[];
  guardrails?: unknown[];
};

function hasAdminCompanyContext() {
  try { return Boolean(window.localStorage.getItem("zai_admin_company_context")); } catch { return false; }
}

export function StorePromptTemplatePanel({ storeId }: { storeId: string }) {
  const { role } = useUserRole();
  const canManage = role === "admin" || (role === "master" && hasAdminCompanyContext());
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [linkedTemplateId, setLinkedTemplateId] = useState("");
  const [selectedPlatformId, setSelectedPlatformId] = useState("");
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [draftPrompt, setDraftPrompt] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [available, linked] = await Promise.all([
        requestApiEndpoint<PromptTemplate[] | { data?: PromptTemplate[] }>(`/api/ai/prompt-templates${canManage ? "?includeDrafts=true" : ""}`),
        requestApiEndpoint<any>(`/api/ai/stores/${encodeURIComponent(storeId)}/prompt-template`),
      ]);
      const rows = Array.isArray(available) ? available : available?.data || [];
      setTemplates(rows);
      setLinkedTemplateId(linked?.template_id || "");
      const draft = rows.find((row) => row.scope === "company" && row.status === "draft");
      setDraftPrompt(draft?.prompt_text || "");
      setSelectedCompanyId(draft?.id || "");
    } catch (error) {
      setTemplates([]);
      notify.error(error instanceof Error ? error.message : "Não foi possível carregar os templates.");
    } finally { setLoading(false); }
  }, [storeId, canManage]);

  useEffect(() => { void refresh(); }, [refresh]);

  const clonePlatform = async () => {
    if (!selectedPlatformId) return;
    setSaving(true);
    try {
      await requestApiEndpoint(`/api/ai/prompt-templates/${encodeURIComponent(selectedPlatformId)}/clone-platform`, "POST");
      await refresh();
      notify.success("Cópia da empresa criada como rascunho para revisão.");
    } catch (error) {
      notify.error(error instanceof Error ? error.message : "Não foi possível copiar o template.");
    } finally { setSaving(false); }
  };

  const createCompanyVersion = async () => {
    if (!selectedCompanyId) return;
    setSaving(true);
    try {
      await requestApiEndpoint(`/api/ai/prompt-templates/${encodeURIComponent(selectedCompanyId)}/versions`, "POST");
      await refresh();
      notify.success("Nova versão criada como rascunho.");
    } catch (error) {
      notify.error(error instanceof Error ? error.message : "Não foi possível criar a versão.");
    } finally { setSaving(false); }
  };

  const publishAndLink = async (template: PromptTemplate) => {
    setSaving(true);
    try {
      await requestApiEndpoint(`/api/ai/prompt-templates/${encodeURIComponent(template.id)}/versions/${encodeURIComponent(template.version_id)}`, "PUT", {
        promptText: draftPrompt || template.prompt_text,
        requiredFields: template.required_fields || [],
        unresolvedFacts: template.unresolved_facts || [],
        guardrails: template.guardrails || [],
      });
      await requestApiEndpoint(`/api/ai/prompt-templates/${encodeURIComponent(template.id)}/versions/${encodeURIComponent(template.version_id)}/publish`, "POST");
      await requestApiEndpoint(`/api/ai/stores/${encodeURIComponent(storeId)}/prompt-template`, "PUT", { templateId: template.id });
      setLinkedTemplateId(template.id);
      await refresh();
      notify.success("Cópia publicada e vinculada a esta loja.");
    } catch (error) {
      notify.error(error instanceof Error ? error.message : "Não foi possível publicar a cópia.");
    } finally { setSaving(false); }
  };

  const linkCompanyTemplate = async () => {
    if (!selectedCompanyId) return;
    setSaving(true);
    try {
      await requestApiEndpoint(`/api/ai/stores/${encodeURIComponent(storeId)}/prompt-template`, "PUT", { templateId: selectedCompanyId });
      setLinkedTemplateId(selectedCompanyId);
      notify.success("Modelo da empresa vinculado a esta loja.");
    } catch (error) {
      notify.error(error instanceof Error ? error.message : "Não foi possível vincular o modelo.");
    } finally { setSaving(false); }
  };

  const platformTemplates = templates.filter((row) => row.scope === "platform" && row.status === "published");
  const companyTemplates = templates.filter((row) => row.scope === "company");
  const selectedDraft = companyTemplates.find((row) => row.id === selectedCompanyId && row.status === "draft");

  return (
    <section className="mt-4 space-y-3 rounded-xl border border-border/60 bg-background/40 p-4" aria-labelledby="store-prompt-template-title">
      <div>
        <h3 id="store-prompt-template-title" className="text-sm font-semibold">Padrão de prompt da loja</h3>
        <p className="mt-1 text-xs text-muted-foreground">A loja usa uma cópia da empresa. Atualizações no modelo global não mudam esta configuração.</p>
      </div>
      {loading ? <p className="text-xs text-muted-foreground">Carregando modelos…</p> : <>
        {canManage && <div className="flex flex-col gap-2 sm:flex-row">
          <select aria-label="Modelo global para copiar" className="h-9 min-w-0 flex-1 rounded-xl border border-input bg-background px-3 text-xs" value={selectedPlatformId} onChange={(event) => setSelectedPlatformId(event.target.value)}>
            <option value="">Escolha um modelo global publicado</option>
            {platformTemplates.map((template) => <option key={template.id} value={template.id}>{template.title} · {template.niche} · v{template.version}</option>)}
          </select>
          <Button type="button" variant="outline" size="sm" disabled={saving || !selectedPlatformId} onClick={() => void clonePlatform()}>Copiar para empresa</Button>
        </div>}
        {canManage && companyTemplates.length > 0 && <div className="flex flex-col gap-2 sm:flex-row">
          <select aria-label="Modelo da empresa" className="h-9 min-w-0 flex-1 rounded-xl border border-input bg-background px-3 text-xs" value={selectedCompanyId} onChange={(event) => {
            const id = event.target.value;
            setSelectedCompanyId(id);
            const row = companyTemplates.find((template) => template.id === id && template.status === "draft");
            if (row) setDraftPrompt(row.prompt_text);
          }}>
            <option value="">Selecione uma cópia da empresa</option>
            {companyTemplates.map((template) => <option key={`${template.id}:${template.version_id}`} value={template.id}>{template.title} · v{template.version} · {template.status === "draft" ? "rascunho" : "publicado"}</option>)}
          </select>
          {selectedCompanyId && !selectedDraft && <Button type="button" variant="outline" size="sm" disabled={saving} onClick={() => void linkCompanyTemplate()}>Vincular publicada</Button>}
          {selectedCompanyId && !selectedDraft && <Button type="button" variant="outline" size="sm" disabled={saving} onClick={() => void createCompanyVersion()}>Nova versão</Button>}
        </div>}
        {canManage && selectedDraft && <div className="space-y-2">
          <label htmlFor="store-prompt-draft" className="text-xs font-medium">Revisar rascunho da empresa · v{selectedDraft.version}</label>
          <Textarea id="store-prompt-draft" value={draftPrompt} onChange={(event) => setDraftPrompt(event.target.value)} className="min-h-28 text-xs" />
          <Button type="button" size="sm" disabled={saving || !draftPrompt.trim()} onClick={() => void publishAndLink(selectedDraft)}>Publicar cópia e usar nesta loja</Button>
        </div>}
        {linkedTemplateId && <p className="text-xs text-emerald-600">Esta loja está vinculada a um modelo publicado da empresa.</p>}
        {platformTemplates.length === 0 && <p className="text-xs text-muted-foreground">Ainda não há modelos globais publicados disponíveis.</p>}
      </>}
    </section>
  );
}
