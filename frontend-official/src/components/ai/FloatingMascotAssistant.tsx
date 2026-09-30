import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowRight, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/core/lib/utils";

const HELP = [
  { title: "Criar meu agente", words: "agente atendente criar personalidade prompt loja ia", text: "Abra Agente e use Criar agente. Informe a loja e revise as instruções antes de salvar. Teste uma conversa antes de ativar a automação.", path: "/ai?tab=evolution", action: "Abrir meu agente" },
  { title: "Conectar o WhatsApp", words: "conexao conexão whatsapp qr offline desconectado sessao sessão", text: "Em Conexões, selecione seu número e conecte pelo QR Code. Confira o estado Conectado antes de enviar mensagens.", path: "/connections", action: "Ver conexões" },
  { title: "Responder no Inbox", words: "inbox chat conversa responder enviar mensagem atendimento manual", text: "Selecione uma conversa, escreva e envie pelo compositor. Confira o estado de envio da mensagem. O painel Atendimento permite controlar a IA dessa conversa.", path: "/inbox", action: "Abrir Inbox" },
  { title: "Usar respostas rápidas", words: "resposta rapida rápida atalho fluxo midia mídia arquivo", text: "Abra Respostas rápidas no compositor. Uma resposta de texto entra no rascunho para revisão. Arquivos e fluxos têm prévia e precisam de confirmação para enviar.", path: "/inbox", action: "Ir ao Inbox" },
  { title: "Ativar ou pausar a IA", words: "ativar pausar desligar ligar automacao automação sugestao sugestão provedor", text: "Operação controla a automação geral. No Inbox, Atendimento controla cada conversa e seu agente. Uma sugestão para o atendente entra no rascunho; revise antes de enviar.", path: "/ai?tab=dashboard", action: "Ver operação" },
  { title: "Ensinar produtos e regras", words: "conhecimento produto preco preço frete horario horário politica política aprender dados", text: "Em Conhecimento, cadastre produtos, preços e políticas oficiais. Use Estratégias para orientar o atendimento. Revise as informações comerciais antes de publicá-las.", path: "/ai?tab=conhecimento", action: "Organizar conhecimento" },
];
const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export function FloatingMascotAssistant() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isInbox = location.pathname.startsWith("/inbox");
  useEffect(() => { setIsOpen(false); setQuery(""); }, [location.pathname]);
  useEffect(() => {
    if (!isOpen) return;
    inputRef.current?.focus();
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") { setIsOpen(false); triggerRef.current?.focus(); } };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [isOpen]);
  const items = useMemo(() => {
    const terms = normalize(query).split(/\s+/).filter(word => word.length > 2);
    if (!terms.length) return HELP.filter(item => isInbox ? item.path === "/inbox" || item.title.includes("IA") : location.pathname === "/ai" ? item.path.startsWith("/ai") : true);
    return HELP.map(item => ({ item, score: terms.filter(term => normalize(item.title + " " + item.words + " " + item.text).includes(term)).length })).filter(result => result.score > 0).sort((a, b) => b.score - a.score).map(result => result.item);
  }, [query, isInbox, location.pathname]);
  return <aside aria-label="Ajuda ZAI" className={cn("fixed right-3 z-40 sm:right-5", isInbox ? "top-16" : "bottom-20 sm:bottom-5")}>
    {isOpen && <section role="dialog" aria-label="Guia ZAI" className="mb-2 w-[min(340px,calc(100vw-24px))] overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <img src="/assets/evolution/habbo_avatar.png" alt="" className="h-10 w-10 rounded-xl bg-primary/10 object-contain [image-rendering:pixelated]" />
        <div className="flex-1"><h2 className="text-sm font-semibold">ZAI · Guia do sistema</h2><p className="text-xs text-muted-foreground">Passo a passo para o atendimento</p></div>
        <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Fechar ajuda ZAI" onClick={() => { setIsOpen(false); triggerRef.current?.focus(); }}><X className="h-4 w-4" /></Button>
      </header>
      <div className="p-3"><label htmlFor="zai-help-query" className="sr-only">Sua dúvida sobre o sistema</label><div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input ref={inputRef} id="zai-help-query" placeholder="Como criar agente? Como enviar?" value={query} onChange={event => setQuery(event.target.value)} className="pl-9" /></div></div>
      <div className="max-h-[min(60vh,460px)] space-y-2 overflow-y-auto px-3 pb-3" aria-live="polite">
        {items.length ? items.map(item => <details key={item.title} className="rounded-xl border border-border p-3" open={items.length === 1 || undefined}><summary className="cursor-pointer text-sm font-medium">{item.title}</summary><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.text}</p><button type="button" onClick={() => { navigate(item.path); setIsOpen(false); }} className="mt-3 flex items-center gap-1 text-xs font-semibold text-primary">{item.action}<ArrowRight className="h-3 w-3" /></button></details>) : <p className="p-3 text-sm text-muted-foreground">Ainda não tenho um guia para essa dúvida. Tente agente, WhatsApp, envio, respostas rápidas ou conhecimento.</p>}
      </div>
    </section>}
    <button ref={triggerRef} type="button" aria-label="Abrir ajuda ZAI" aria-expanded={isOpen} onClick={() => setIsOpen(open => !open)} className={cn("ml-auto flex items-center gap-2 rounded-full border border-border bg-card px-3 py-2 shadow-sm hover:border-primary/50", isInbox && "opacity-90")}><img src="/assets/evolution/habbo_avatar.png" alt="" className="h-6 w-6 object-contain [image-rendering:pixelated]" /><span className="text-xs font-semibold">Ajuda ZAI</span></button>
  </aside>;
}
