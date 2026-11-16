import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiService, type PixKeyType, type StorePixSettingsInput } from "@/core/services/apiService";
import { notify } from "@/core/services/notifyService";
import { useUserRole } from "@/state/hooks/useUserRole";

const KEY_TYPE_OPTIONS: { value: PixKeyType; label: string; placeholder: string }[] = [
  { value: "cnpj", label: "CNPJ", placeholder: "00.000.000/0000-00" },
  { value: "cpf", label: "CPF", placeholder: "000.000.000-00" },
  { value: "phone", label: "Celular", placeholder: "(31) 99999-0000" },
  { value: "email", label: "E-mail", placeholder: "financeiro@loja.com.br" },
  { value: "evp", label: "Chave aleatória", placeholder: "123e4567-e89b-12d3-a456-426614174000" },
];

const EMPTY_FORM: StorePixSettingsInput = { enabled: true, keyType: "cnpj", key: "", merchantName: "", merchantCity: "" };

export function StorePixPanel({ storeId, storeName }: { storeId: string; storeName?: string }) {
  const { role } = useUserRole();
  const canManage = role === "admin" || role === "master";
  const [form, setForm] = useState<StorePixSettingsInput>(EMPTY_FORM);
  const [configured, setConfigured] = useState(false);
  const [payload, setPayload] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const { pix } = await apiService.getStorePixSettings(storeId);
      setConfigured(Boolean(pix));
      setForm(pix
        ? { enabled: pix.enabled, keyType: pix.keyType, key: pix.key, merchantName: pix.merchantName, merchantCity: pix.merchantCity }
        : { ...EMPTY_FORM, merchantName: (storeName || "").slice(0, 25) });
      const preview = pix?.enabled ? await apiService.getSessionPix({ storeId }) : null;
      setPayload(preview?.configured ? preview.payload : "");
    } catch (error) {
      notify.error(error instanceof Error ? error.message : "Não foi possível carregar o PIX da loja.");
    } finally {
      setLoading(false);
    }
  }, [storeId, storeName]);

  useEffect(() => { void refresh(); }, [refresh]);

  const update = <K extends keyof StorePixSettingsInput>(field: K, value: StorePixSettingsInput[K]) =>
    setForm((current) => ({ ...current, [field]: value }));

  const save = async () => {
    setSaving(true);
    try {
      const result = await apiService.saveStorePixSettings(storeId, form);
      setConfigured(true);
      setPayload(result.pix.enabled ? result.payload : "");
      notify.success("PIX da loja salvo. O atalho PIX e as cobranças já usam esta chave.");
    } catch (error) {
      notify.error(error instanceof Error ? error.message : "Não foi possível salvar o PIX.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    setSaving(true);
    try {
      await apiService.removeStorePixSettings(storeId);
      await refresh();
      notify.success("PIX da loja removido.");
    } catch (error) {
      notify.error(error instanceof Error ? error.message : "Não foi possível remover o PIX.");
    } finally {
      setSaving(false);
    }
  };

  const copyPayload = async () => {
    try {
      await navigator.clipboard.writeText(payload);
      notify.success("PIX copia e cola copiado.");
    } catch {
      notify.error("Não foi possível copiar.");
    }
  };

  const keyOption = KEY_TYPE_OPTIONS.find((option) => option.value === form.keyType) || KEY_TYPE_OPTIONS[0];
  const disabled = !canManage || saving;
  const statusLabel = configured ? (form.enabled ? "Ativo" : "Desativado") : "Não cadastrado";
  const statusClass = configured && form.enabled ? "bg-emerald-500/15 text-emerald-400" : "bg-amber-500/15 text-amber-400";

  return (
    <section className="mt-4 space-y-3 rounded-xl border border-border/60 bg-background/40 p-4" aria-labelledby="store-pix-title">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 id="store-pix-title" className="text-sm font-semibold">PIX da loja</h3>
          <p className="mt-1 text-xs text-muted-foreground">Usado no atalho PIX do Inbox e nas cobranças. Gera o PIX copia e cola no padrão do Banco Central.</p>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusClass}`}>{statusLabel}</span>
      </div>

      {loading ? <p className="text-xs text-muted-foreground">Carregando PIX…</p> : (
        <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); void save(); }}>
          <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
            <label className="space-y-1 text-xs font-medium">
              <span>Tipo de chave</span>
              <select className="h-9 w-full rounded-xl border border-input bg-background px-3 text-xs" value={form.keyType} disabled={disabled} onChange={(event) => update("keyType", event.target.value as PixKeyType)}>
                {KEY_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-xs font-medium">
              <span>Chave PIX</span>
              <Input value={form.key} placeholder={keyOption.placeholder} disabled={disabled} onChange={(event) => update("key", event.target.value)} required />
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-xs font-medium">
              <span>Favorecido (até 25 caracteres)</span>
              <Input value={form.merchantName} maxLength={25} disabled={disabled} onChange={(event) => update("merchantName", event.target.value)} required />
            </label>
            <label className="space-y-1 text-xs font-medium">
              <span>Cidade (até 15 caracteres)</span>
              <Input value={form.merchantCity} maxLength={15} disabled={disabled} onChange={(event) => update("merchantCity", event.target.value)} required />
            </label>
          </div>
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={form.enabled} disabled={disabled} onChange={(event) => update("enabled", event.target.checked)} />
            <span>Permitir uso do PIX no atendimento</span>
          </label>

          {payload && (
            <div className="space-y-1.5 rounded-lg border border-border/60 bg-muted/20 p-2.5">
              <span className="text-[11px] font-medium text-muted-foreground">PIX copia e cola (sem valor definido)</span>
              <code className="block break-all text-[11px]">{payload}</code>
              <Button type="button" size="sm" variant="outline" onClick={() => void copyPayload()}>Copiar</Button>
            </div>
          )}

          {canManage ? (
            <div className="flex flex-wrap gap-2">
              <Button type="submit" size="sm" disabled={saving}>{saving ? "Salvando…" : configured ? "Atualizar PIX" : "Cadastrar PIX"}</Button>
              {configured && <Button type="button" size="sm" variant="outline" disabled={saving} onClick={() => void remove()}>Remover</Button>}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Somente administradores podem alterar o PIX da loja.</p>
          )}
        </form>
      )}
    </section>
  );
}