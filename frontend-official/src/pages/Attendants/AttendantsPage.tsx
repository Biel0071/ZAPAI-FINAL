import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Headset,
  Plus,
  Play,
  Pause,
  Copy,
  Trash,
  Sliders,
  WhatsappLogo,
  Storefront,
  CheckCircle,
  Clock,
  Sparkle,
  ChatCircleText,
  ArrowsLeftRight,
  ShieldCheck,
  Robot,
  TrendUp,
  TShirt,
  ArrowsClockwise,
  Brain,
  Scissors,
  Smiley,
  Eyeglasses,
  FloppyDisk,
} from "@phosphor-icons/react";
import { apiService, API_ORIGIN, type AIMetricsResponse, type AIStatusResponse } from "@/core/services/apiService";
import { useAppStore } from "@/state/stores/appStore";
import { notify } from "@/core/services/notifyService";
import { cn, generateUuid } from "@/core/lib/utils";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ZaiPlatformAssistantView } from "@/components/ai/ZaiPlatformAssistantView";
import { AgentCustomizerModal } from "@/components/ai/AgentCustomizerModal";
import { AgentProfileModal } from "@/components/ai/AgentProfileModal";
import { NewAgentWizardModal } from "@/components/ai/NewAgentWizardModal";
import { AvatarEditorModal } from "@/components/avatar-engine/AvatarEditorModal";
import { ZaiAvatarRenderer } from "@/components/avatar-engine/ZaiAvatarRenderer";
import { EXAMPLE_ATTENDANTS } from "@/components/attendants/exampleAttendants";
import { Pagination } from "@/components/ui/pagination";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  Eye,
  EyeOff,
  Wand2,
  Key,
  Cpu,
  Layers,
  Sparkles,
  Target,
  Heart,
  Zap,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Smile,
  RefreshCw,
  Crown,
  Coins,
  Timer,
  FileText,
  Volume2,
} from "lucide-react";
import {
  OBJECTIVES,
  TONE_OPTIONS,
  PROVIDER_OPTIONS,
  PROMPT_TEMPLATES,
  QUICK_TEST_PROMPTS,
  getProviderDef,
} from "@/pages/AI/AgentTab";
import { ProviderLogo } from "@/components/ai/ProviderLogo";
import { useUserRole } from "@/state/hooks/useUserRole";
import { createAgentAvatar, buildStoreVisualDNA, resolveSpriteForAvatar, applyStylePreset } from "@/components/avatar-engine/CharacterFactory";
import {
  AVATAR_HAIRS,
  AVATAR_FACES,
  AVATAR_OUTFITS,
  AVATAR_ACCESSORIES,
  AVATAR_STYLES,
  HAIRSTYLES_FEMALE,
  HAIRSTYLES_MALE,
  CLOTHING_STYLES,
  resolveItemSpriteForGender,
  resolveHairColorForHair,
  resolveItemDisplayForGender,
  type AgentAvatarConfig,
} from "@/components/avatar-engine/AvatarDefinition";
import { AvatarItemPreview } from "@/components/avatar-engine/AvatarItemPreview";
const CommercialPanel = React.lazy(() => import("@/components/evolution/HistoryBootstrapPanel").then(module => ({ default: module.HistoryBootstrapPanel })));
const AgentTab = React.lazy(() => import("@/pages/AI/AgentTab").then(module => ({ default: module.AgentTab })));
const EvolutionTab = React.lazy(() => import("@/pages/AI/EvolutionTab").then(module => ({ default: module.EvolutionTab })));
const MemoryView = React.lazy(() => import("@/pages/Memory").then(module => ({ default: module.default })));

export interface SandboxChatMessage {
  id: string;
  sender: "user" | "agent";
  text: string;
  cleanText: string;
  timestamp: string;
  media?: {
    type: string;
    url: string;
    caption?: string;
  } | null;
  quickReplyTitle?: string | null;
  metrics?: {
    responseTimeMs: number;
    tokens?: number;
    provider?: string;
    model?: string;
    isFastPath?: boolean;
  };
}

function SandboxAudioPlayer({ src, caption }: { src: string; caption?: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const fullUrl = useMemo(() => {
    if (!src) return "";
    if (/^https?:\/\//i.test(src)) return src;
    const clean = src.startsWith("/") ? src : `/${src}`;
    return `${API_ORIGIN}${clean}`;
  }, [src]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    }
  };

  const formatTime = (seconds: number) => {
    if (!Number.isFinite(seconds) || seconds <= 0) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="mt-2 rounded-xl border border-emerald-500/30 bg-emerald-950/25 p-2.5 flex flex-col gap-1.5 shadow-xs">
      <audio
        ref={audioRef}
        src={fullUrl}
        onTimeUpdate={() => audioRef.current && setCurrentTime(audioRef.current.currentTime)}
        onLoadedMetadata={() => audioRef.current && setDuration(audioRef.current.duration || 0)}
        onEnded={() => {
          setIsPlaying(false);
          setCurrentTime(0);
        }}
        preload="metadata"
      />
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={togglePlay}
          className="h-8 w-8 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black flex items-center justify-center transition-transform active:scale-95 shadow-xs cursor-pointer shrink-0"
          title={isPlaying ? "Pausar áudio" : "Ouvir áudio oficial"}
        >
          {isPlaying ? <Pause weight="fill" className="h-4 w-4" /> : <Play weight="fill" className="h-4 w-4 ml-0.5" />}
        </button>

        <div className="flex-1 space-y-1">
          <div className="flex items-center justify-between text-[10px] text-emerald-300 font-mono">
            <span className="flex items-center gap-1 font-medium">
              <span className={cn("w-1.5 h-1.5 rounded-full bg-emerald-400", isPlaying ? "animate-pulse" : "")} />
              <span>{isPlaying ? "Reproduzindo áudio gravado" : "Áudio Oficial da Resposta Rápida"}</span>
            </span>
            <span>{formatTime(currentTime)} / {formatTime(duration)}</span>
          </div>

          <div
            className="w-full bg-emerald-950/70 rounded-full h-1.5 cursor-pointer relative overflow-hidden"
            onClick={(e) => {
              if (!audioRef.current || !duration) return;
              const rect = e.currentTarget.getBoundingClientRect();
              const clickPos = (e.clientX - rect.left) / rect.width;
              audioRef.current.currentTime = clickPos * duration;
              setCurrentTime(clickPos * duration);
            }}
          >
            <div
              className="bg-emerald-400 h-full rounded-full transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>
      {caption && (
        <p className="text-[10px] text-muted-foreground italic px-1">{caption}</p>
      )}
    </div>
  );
}

function SandboxMediaPreview({ media }: { media: { type: string; url: string; caption?: string } }) {
  const fullUrl = useMemo(() => {
    if (!media.url) return "";
    if (/^https?:\/\//i.test(media.url)) return media.url;
    const clean = media.url.startsWith("/") ? media.url : `/${media.url}`;
    return `${API_ORIGIN}${clean}`;
  }, [media.url]);

  const type = String(media.type || "").toLowerCase();

  if (type === "audio") {
    return <SandboxAudioPlayer src={media.url} caption={media.caption} />;
  }

  if (type === "image") {
    return (
      <div className="mt-2 rounded-xl overflow-hidden border border-emerald-500/30 bg-black/40 shadow-xs max-w-xs">
        <a href={fullUrl} target="_blank" rel="noopener noreferrer" className="block group relative">
          <img
            src={fullUrl}
            alt={media.caption || "Imagem da Loja"}
            className="w-full max-h-48 object-cover rounded-t-xl group-hover:opacity-90 transition-opacity"
            onError={(e) => {
              (e.target as HTMLElement).style.display = "none";
            }}
          />
          <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[11px] font-medium transition-opacity">
            Clique para ampliar
          </div>
        </a>
        {media.caption && (
          <p className="p-2 text-[10px] text-muted-foreground italic border-t border-border/40 bg-card/60">
            {media.caption}
          </p>
        )}
      </div>
    );
  }

  if (type === "video") {
    return (
      <div className="mt-2 rounded-xl overflow-hidden border border-emerald-500/30 bg-black/40 shadow-xs max-w-xs">
        <video controls src={fullUrl} className="w-full max-h-48 rounded-xl" />
        {media.caption && (
          <p className="p-2 text-[10px] text-muted-foreground italic border-t border-border/40 bg-card/60">
            {media.caption}
          </p>
        )}
      </div>
    );
  }

  return (
    <a
      href={fullUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-2 flex items-center gap-2 p-2 rounded-xl border border-border/60 bg-muted/30 hover:bg-muted/50 text-xs transition-colors"
    >
      <FileText className="h-4 w-4 text-emerald-400 shrink-0" />
      <span className="truncate flex-1 font-medium">{media.url.split("/").pop() || "Documento anexado"}</span>
      <span className="text-[10px] text-emerald-400 font-semibold shrink-0">Baixar</span>
    </a>
  );
}

function parseMediaFromResponse(replyText: string, resultObj?: any): {
  cleanText: string;
  media: { type: string; url: string; caption?: string } | null;
  quickReplyTitle?: string | null;
} {
  let cleanText = replyText || "";
  let media: { type: string; url: string; caption?: string } | null = null;
  let quickReplyTitle: string | null = null;

  // 1. Extração direta de send_media ou sendMedia do resultado
  const rawSm = resultObj?.send_media || resultObj?.sendMedia;
  if (rawSm?.value) {
    media = {
      type: String(rawSm.type || "audio").toLowerCase(),
      url: String(rawSm.value),
      caption: rawSm.caption,
    };
  }

  // 2. Extração de tags no texto: [Mídia Anexada Oficial da Loja: AUDIO -> /uploads/...]
  const mediaNoticeRegex = /\[Mídia Anexada Oficial da Loja:\s*([A-Za-z]+)\s*->\s*([^\]]+)\]/i;
  const matchNotice = cleanText.match(mediaNoticeRegex);
  if (matchNotice) {
    if (!media) {
      media = {
        type: matchNotice[1].toLowerCase(),
        url: matchNotice[2].trim(),
      };
    }
    cleanText = cleanText.replace(mediaNoticeRegex, "").trim();
  }

  // 3. Extração de tags de memória acoplada: [🎵 Áudio Anexado(a) da Memória: /uploads/... | "legenda"]
  const memoryMediaRegex = /\[(?:🎵 Áudio|📷 Imagem|🎬 Vídeo)\s+Anexado\(a\)\s+da\s+Memória:\s*([^\]|]+)(?:\s*\|\s*"([^"]*)")?\]/i;
  const matchMemory = cleanText.match(memoryMediaRegex);
  if (matchMemory) {
    if (!media) {
      const type = cleanText.includes("🎵 Áudio") ? "audio" : cleanText.includes("🎬 Vídeo") ? "video" : "image";
      media = {
        type,
        url: matchMemory[1].trim(),
        caption: matchMemory[2]?.trim(),
      };
    }
    cleanText = cleanText.replace(memoryMediaRegex, "").trim();
  }

  // 4. Extração de resposta rápida acoplada: [⚡ Resposta Rápida Acionada: "SCRIPT CIMENTO" (...)]
  const qrRegex = /\[⚡ Resposta Rápida Acionada:\s*"([^"]+)"[^\]]*\]/i;
  const matchQr = cleanText.match(qrRegex);
  if (matchQr) {
    quickReplyTitle = matchQr[1].trim();
    cleanText = cleanText.replace(qrRegex, "").trim();
  }

  cleanText = cleanText.replace(/\[Resposta Rápida Oficial Acoplada:\s*ID\s*[^\]]+\]/gi, "").trim();

  return { cleanText, media, quickReplyTitle };
}

export default function AttendantsPage() {
  const { role } = useUserRole();
  const isAdmin = role === "admin" || role === "master";
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get("tab");
  const activeTab: "attendants" | "copilot" | "memory" | "evolution" =
    rawTab === "copilot"
      ? "copilot"
      : rawTab === "memory"
      ? "memory"
      : rawTab === "evolution"
      ? "evolution"
      : "attendants";

  const handleTabChange = (tab: "attendants" | "copilot" | "memory" | "evolution") => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (tab === "attendants") {
        next.delete("tab");
      } else {
        next.set("tab", tab);
      }
      return next;
    });
  };

  const [agents, setAgents] = useState<any[]>([]);
  const [stores, setStores] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pendingAgent, setPendingAgent] = useState<string | null>(null);
  const [aiStatus, setAIStatus] = useState<AIStatusResponse | null>(null);
  const liveSessions = useAppStore((state) => state.sessions);
  const activeSessionId = useAppStore((state) => state.activeSessionId);
  const progress = useAppStore((state) => state.aiProgressByConversationId);
  const requestVersion = useRef(0);
  const [selectedStoreFilter, setSelectedStoreFilter] = useState<string>("all");
  const selectedWhatsApp = searchParams.get("sessionId") || "";
  const [switchingAttendant, setSwitchingAttendant] = useState(false);
  const [commercialOpen, setCommercialOpen] = useState(searchParams.get("section") === "business");
  useEffect(() => { if (searchParams.get("section") === "business") setCommercialOpen(true); }, [searchParams]);
  const selectWhatsApp = (sessionId: string) => setSearchParams(current => {
    const next = new URLSearchParams(current);
    if (sessionId) next.set("sessionId", sessionId); else next.delete("sessionId");
    return next;
  });
  useEffect(() => {
    const storeId = searchParams.get("storeId");
    if (selectedWhatsApp || !storeId) return;
    const sessionId = stores.find(store => store.id === storeId)?.numbers?.[0]?.sessionId;
    if (sessionId) setSearchParams(current => { const next = new URLSearchParams(current); next.set("sessionId", sessionId); return next; }, { replace: true });
  }, [stores, searchParams, selectedWhatsApp, setSearchParams]);

  // Workspace Preview Drawer / Modal & Avatar Studio
  const [previewAgent, setPreviewAgent] = useState<any | null>(null);
  const [avatarEditorAgent, setAvatarEditorAgent] = useState<any | null>(null);

  // Modals
  const [customizerAgent, setCustomizerAgent] = useState<any | null>(null);
  const [profileAgent, setProfileAgent] = useState<any | null>(null);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  useEffect(() => {
    if (searchParams.get("new") !== "1") return;
    setIsWizardOpen(true);
    setSearchParams(current => { const next = new URLSearchParams(current); next.delete("new"); return next; }, { replace: true });
  }, [searchParams, setSearchParams]);

  // Reassign Number Modal
  const [reassignModalOpen, setReassignModalOpen] = useState(false);
  const [reassignAgent, setReassignAgent] = useState<any | null>(null);
  const [selectedSessionForReassign, setSelectedSessionForReassign] = useState<string>("");
  const [isReassigning, setIsReassigning] = useState(false);

  // Test sandbox & interactive console (Chat / Evolution / Real Sync)
  const [sandboxInput, setSandboxInput] = useState("");
  const [sandboxMessages, setSandboxMessages] = useState<SandboxChatMessage[]>([]);
  const [isTestingAgent, setIsTestingAgent] = useState(false);
  const [testingElapsedMs, setTestingElapsedMs] = useState(0);
  const [zaiUsage, setZaiUsage] = useState<{
    isAdmin: boolean;
    isUnlimited: boolean;
    countToday: number;
    limitToday: number | string;
    remainingToday: number | string;
    balanceCredits: number;
    canUse: boolean;
    message?: string;
  } | null>(null);
  const [isRechargingZai, setIsRechargingZai] = useState(false);
  const [rechargeModalOpen, setRechargeModalOpen] = useState(false);

  // Treinamento interativo & absorção contínua de conhecimento (Studio Meia Tela)
  const [newInstruction, setNewInstruction] = useState("");
  const [isAbsorbing, setIsAbsorbing] = useState(false);
  const [absorbedHistory, setAbsorbedHistory] = useState<string[]>([]);

  const handleAbsorbInstruction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInstruction.trim() || isAbsorbing || !previewAgent) return;

    const instructionText = newInstruction.trim();
    setIsAbsorbing(true);
    try {
      const timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      const dateStr = new Date().toLocaleDateString("pt-BR");
      const additionBlock = `\n\n[CONHECIMENTO ABSORVIDO EM ${dateStr} ${timestamp}]:\n- ${instructionText}`;
      const updatedPrompt = (agentPrompt || "").trim() + additionBlock;

      setAgentPrompt(updatedPrompt);
      setAbsorbedHistory((prev) => [instructionText, ...prev.slice(0, 9)]);
      setNewInstruction("");

      if (!previewAgent.isExample) {
        await apiService.updateAIAgent(previewAgent.key, {
          personality: updatedPrompt,
          prompt: updatedPrompt,
        });
      }

      notify.success(`✨ ${previewAgent.name} absorveu a informação! Pergunte no chat ao lado para testar.`);
    } catch (err: any) {
      notify.error(err?.message || "Não foi possível salvar o conhecimento absorvido.");
    } finally {
      setIsAbsorbing(false);
    }
  };

  const fetchZaiUsage = useCallback(async () => {
    try {
      const res = await apiService.getZaiUsage();
      if (res?.data) {
        setZaiUsage(res.data);
      }
    } catch (_) {}
  }, []);

  useEffect(() => {
    fetchZaiUsage();
  }, [fetchZaiUsage]);

  const [sessionMetrics, setSessionMetrics] = useState<AIMetricsResponse | null>(null);
  const [sandboxTab, setSandboxTab] = useState<"chat" | "evolution" | "sync">("chat");
  const [evolutionData, setEvolutionData] = useState<any>(null);
  const [realConversations, setRealConversations] = useState<any[]>([]);
  const [isSyncingAttendance, setIsSyncingAttendance] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const selectedAgentKey = useRef(previewAgent?.key);
  const testVersion = useRef(0);
  selectedAgentKey.current = previewAgent?.key;
  const sandboxScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (sandboxScrollRef.current) {
      sandboxScrollRef.current.scrollTop = sandboxScrollRef.current.scrollHeight;
    }
  }, [sandboxMessages, isTestingAgent]);

  const fetchData = useCallback(async () => {
    const version = ++requestVersion.current;
    setLoadError(null);
    try {
      const [agentsRes, storesRes, sessionsRes, statusRes] = await Promise.all([
        apiService.getAIAgents(),
        apiService.getStores(),
        apiService.getConnections({ throwOnError: true }),
        apiService.getAIStatus(true),
      ]);
      if (version !== requestVersion.current) return;
      if (agentsRes.success === false || storesRes.success === false) throw new Error("Não foi possível carregar os dados da operação.");
      const loadedAgents = agentsRes.agents || [];
      const cleanAgents = loadedAgents.filter((a: any) => !a.isPlatformAssistant && a.key !== "zaibot");
      setAgents(cleanAgents);

      if (storesRes.stores) {
        setStores(storesRes.stores);
      }

      const safeSessions = Array.isArray(sessionsRes) ? sessionsRes : [];
      setSessions(safeSessions);
      setAIStatus(statusRes.data || statusRes);
      setPreviewAgent((current: any) =>
        cleanAgents.find((agent: any) => agent.key === current?.key) ||
        cleanAgents[0] ||
        (current?.isExample ? current : EXAMPLE_ATTENDANTS[0])
      );
    } catch (err: any) {
      if (
        err?.code === "AUTH_SESSION_CHANGED" ||
        err?.name === "AuthSessionChangedError" ||
        err?.message?.includes?.("sessão de acesso mudou")
      ) {
        if (version === requestVersion.current) {
          setTimeout(() => { void fetchData(); }, 150);
          return;
        }
      }
      if (version === requestVersion.current) setLoadError(err?.message || "Erro ao carregar atendentes.");
    } finally {
      if (version === requestVersion.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
    return () => { requestVersion.current += 1; };
  }, [fetchData]);

  const getAssignedSession = (agent: any) => {
    if (selectedWhatsApp) {
      const saved = sessions.find(s => (s.sessionId || s.id) === selectedWhatsApp);
      const live = liveSessions.find(s => s.id === selectedWhatsApp);
      return saved ? { ...saved, sessionId: selectedWhatsApp, sessionName: saved.sessionName || selectedWhatsApp, status: live?.status || saved.status || "unknown" } : null;
    }
    const filteredStore = stores.find(store => store.id === selectedStoreFilter);
    const sessionId = agent?.sessionIds?.find((id: string) => filteredStore?.numbers?.some((number: any) => number.sessionId === id)) || agent?.sessionIds?.[0];
    if (!sessionId) return null;
    const saved = sessions.find((s) => s.sessionId === sessionId || s.id === sessionId);
    const live = liveSessions.find((s) => s.id === sessionId);
    return { ...saved, sessionId, sessionName: saved?.sessionName || sessionId, status: live?.status || saved?.status || "unknown" };
  };

  const getAssignedStore = (agent: any) => {
    const session = getAssignedSession(agent);
    if (session) return stores.find((store) => store.numbers?.some((number: any) => number.sessionId === session.sessionId)) || null;
    return stores.find((store) => store.id === agent?.storeId) || null;
  };

  const getPresence = (agent: any) => {
    const session = getAssignedSession(agent);
    if (agent.active === false) return { label: "Pausado", state: "WAITING" as const };
    if (!session) return { label: "Sem WhatsApp", state: "WAITING" as const };
    if (session.status !== "connected" && session.status !== "open") return { label: "WhatsApp desconectado", state: "OFFLINE" as const };
    if (aiStatus?.active === false || (aiStatus?.enabled ?? aiStatus?.ai) === false) return { label: "IA em espera", state: "WAITING" as const };
    const operation = Object.values(progress).find((item) => item.sessionId === session.sessionId && (!item.agentName || item.agentName === agent.name) && ["analyzing", "generating", "typing", "sending", "queued", "waiting"].includes(item.status));
    if (operation?.status === "typing" || operation?.status === "sending") return { label: "Conversando", state: "TYPING" as const };
    if (operation?.status === "analyzing" || operation?.status === "generating") return { label: "Preparando resposta", state: "WORKING" as const };
    return { label: "Aguardando conversa", state: "WAITING" as const };
  };

  const previewSession = getAssignedSession(previewAgent);
  const previewStore = getAssignedStore(previewAgent);
  const previewPresence = previewAgent ? getPresence(previewAgent) : null;

  useEffect(() => {
    let cancelled = false;
    setSessionMetrics(null);
    setSandboxMessages([]);
    setSandboxInput("");
    testVersion.current += 1;
    setIsTestingAgent(false);
    apiService.getAIMetrics(previewSession?.sessionId || undefined).then((metrics) => {
      if (!cancelled) setSessionMetrics(metrics.data || metrics);
    }).catch(() => { /* unavailable metrics stay empty */ });
    return () => { cancelled = true; };
  }, [previewAgent?.key, previewSession?.sessionId]);

  function formatTokens(tokens: number | null | undefined): string {
    if (tokens == null || !Number.isFinite(tokens)) return "—";
    if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
    if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
    return String(tokens);
  }

  // Inline 5-category Avatar Studio state (Cabelo, Rosto, Roupa, Acessórios, Estilo)
  const [studioCategory, setStudioCategory] = useState<"hair" | "face" | "outfit" | "accessories" | "style">("hair");
  const [studioRotationY, setStudioRotationY] = useState<number>(0);
  const [studioMovement3D, setStudioMovement3D] = useState<"idle" | "walk" | "wave" | "pose" | "spin360">("idle");
  const [isSavingAvatar, setIsSavingAvatar] = useState(false);
  const [isStudioDragging, setIsStudioDragging] = useState(false);
  const studioDragStartXRef = useRef<number>(0);
  const studioDragStartAngleRef = useRef<number>(0);
  const studioRotationYRef = useRef<number>(0);
  const studioMovement3DRef = useRef<string>("idle");
  studioRotationYRef.current = studioRotationY;
  studioMovement3DRef.current = studioMovement3D;

  useEffect(() => {
    setStudioRotationY(typeof previewAgent?.avatarConfig?.rotationY === "number" ? previewAgent.avatarConfig.rotationY : 0);
    setStudioMovement3D(previewAgent?.avatarConfig?.movement3D || "idle");
  }, [previewAgent?.key]);

  // Smooth continuous turntable auto-spin loop when studioMovement3D === "spin360"
  useEffect(() => {
    if (studioMovement3D !== "spin360") return;
    let animFrame: number;
    let lastTime = performance.now();
    const spinLoop = (now: number) => {
      const dt = now - lastTime;
      if (!isStudioDragging && dt >= 40) {
        setStudioRotationY((prev) => (prev + 2) % 360);
        lastTime = now;
      }
      animFrame = requestAnimationFrame(spinLoop);
    };
    animFrame = requestAnimationFrame(spinLoop);
    return () => cancelAnimationFrame(animFrame);
  }, [studioMovement3D, isStudioDragging]);

  const handleInlineStageMouseDown = (e: React.MouseEvent) => {
    setIsStudioDragging(true);
    studioDragStartXRef.current = e.clientX;
    studioDragStartAngleRef.current = studioRotationY;
  };

  const handleInlineStageTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsStudioDragging(true);
      studioDragStartXRef.current = e.touches[0].clientX;
      studioDragStartAngleRef.current = studioRotationY;
    }
  };

  useEffect(() => {
    if (!isStudioDragging) return;

    let rafId: number | null = null;
    const handleMouseMove = (e: MouseEvent) => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        const deltaX = e.clientX - studioDragStartXRef.current;
        const sensitivity = 0.85;
        const newAngle = Math.round((((studioDragStartAngleRef.current + deltaX * sensitivity) % 360) + 360) % 360);
        setStudioRotationY(newAngle);
      });
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        if (rafId !== null) return;
        rafId = requestAnimationFrame(() => {
          rafId = null;
          const deltaX = e.touches[0].clientX - studioDragStartXRef.current;
          const sensitivity = 0.85;
          const newAngle = Math.round((((studioDragStartAngleRef.current + deltaX * sensitivity) % 360) + 360) % 360);
          setStudioRotationY(newAngle);
        });
      }
    };

    const handleDragEnd = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      setIsStudioDragging(false);
      setStudioRotationY((curr) => {
        handleUpdateAvatar({ rotationY: curr });
        return curr;
      });
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleDragEnd);
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    window.addEventListener("touchend", handleDragEnd);
    window.addEventListener("touchcancel", handleDragEnd);

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleDragEnd);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleDragEnd);
      window.removeEventListener("touchcancel", handleDragEnd);
    };
  }, [isStudioDragging]);

  const handleUpdateAvatar = useCallback((overrides: Partial<AgentAvatarConfig>) => {
    setPreviewAgent((prev: any) => {
      if (!prev) return prev;
      const baseConfig: AgentAvatarConfig = prev.avatarConfig || createAgentAvatar({
        agentId: prev.key || prev.name,
        name: prev.name,
        role: prev.role,
        storeId: previewStore?.id,
        storeDNA: previewStore ? buildStoreVisualDNA(previewStore) : undefined,
        gender: prev.character?.gender || (prev.name?.toLowerCase().includes("carlos") ? "male" : "female"),
      });

      const updatedConfig: AgentAvatarConfig = { ...baseConfig, ...overrides };
      if (overrides.outfit) updatedConfig.clothing = overrides.outfit;
      if (overrides.clothing) updatedConfig.outfit = overrides.clothing;
      if (overrides.body) updatedConfig.base = overrides.body === "male" ? "male" : "female";
      if (overrides.base) updatedConfig.body = overrides.base === "male" ? "male" : "female";

      const updatedSprite = overrides.catalogSpriteId || resolveSpriteForAvatar({ ...updatedConfig, catalogSpriteId: undefined }, true);
      updatedConfig.catalogSpriteId = updatedSprite;
      const avatarUrl = `/assets/avatar_factory/catalog/${updatedSprite}_clean.png`;

      return {
        ...prev,
        avatarConfig: updatedConfig,
        avatar: avatarUrl,
      };
    });

    setAgents((prev) => {
      if (!previewAgent || previewAgent.isExample) return prev;
      return prev.map((a) => {
        if (a.key !== previewAgent.key) return a;
        const baseConfig: AgentAvatarConfig = a.avatarConfig || createAgentAvatar({
          agentId: a.key || a.name,
          name: a.name,
          role: a.role,
          storeId: previewStore?.id,
          storeDNA: previewStore ? buildStoreVisualDNA(previewStore) : undefined,
          gender: a.character?.gender || (a.name?.toLowerCase().includes("carlos") ? "male" : "female"),
        });
        const updatedConfig: AgentAvatarConfig = { ...baseConfig, ...overrides };
        if (overrides.outfit) updatedConfig.clothing = overrides.outfit;
        if (overrides.clothing) updatedConfig.outfit = overrides.clothing;
        if (overrides.body) updatedConfig.base = overrides.body === "male" ? "male" : "female";
        if (overrides.base) updatedConfig.body = overrides.base === "male" ? "male" : "female";
        const updatedSprite = overrides.catalogSpriteId || resolveSpriteForAvatar({ ...updatedConfig, catalogSpriteId: undefined }, true);
        updatedConfig.catalogSpriteId = updatedSprite;
        const avatarUrl = `/assets/avatar_factory/catalog/${updatedSprite}_clean.png`;
        return { ...a, avatarConfig: updatedConfig, avatar: avatarUrl };
      });
    });
  }, [previewAgent?.key, previewAgent?.isExample, previewStore]);

  const handleSaveAvatar = useCallback(async () => {
    if (!previewAgent) return;
    if (previewAgent.isExample) {
      notify.info(`Este perfil é o modelo demonstrativo de ${previewAgent.name}. Clique em 'Criar Atendente' para criar um funcionário digital real para sua loja.`);
      setIsWizardOpen(true);
      return;
    }
    setIsSavingAvatar(true);
    try {
      const configToSave = previewAgent.avatarConfig || createAgentAvatar({
        agentId: previewAgent.key || previewAgent.name,
        name: previewAgent.name,
        role: previewAgent.role,
        storeId: previewStore?.id,
        storeDNA: previewStore ? buildStoreVisualDNA(previewStore) : undefined,
        gender: previewAgent.character?.gender || (previewAgent.name?.toLowerCase().includes("carlos") ? "male" : "female"),
      });
      const spriteId = configToSave.catalogSpriteId || resolveSpriteForAvatar(configToSave, true);
      const fullConfig: AgentAvatarConfig = {
        ...configToSave,
        hair: previewAgent.avatarConfig?.hair || configToSave.hair,
        face: previewAgent.avatarConfig?.face || configToSave.face || "face_01",
        outfit: previewAgent.avatarConfig?.outfit || previewAgent.avatarConfig?.clothing || configToSave.outfit,
        clothing: previewAgent.avatarConfig?.outfit || previewAgent.avatarConfig?.clothing || configToSave.clothing,
        accessories: previewAgent.avatarConfig?.accessories || configToSave.accessories,
        style: previewAgent.avatarConfig?.style || configToSave.style || "style_vendas",
        rotationY: previewAgent.avatarConfig?.rotationY ?? studioRotationYRef.current,
        movement3D: previewAgent.avatarConfig?.movement3D ?? studioMovement3DRef.current,
        catalogSpriteId: spriteId,
      };
      const avatarUrl = `/assets/avatar_factory/catalog/${spriteId}_clean.png`;

      const res = await apiService.updateAgentAvatar(previewAgent.key, {
        avatarConfig: fullConfig,
        avatar: avatarUrl,
      });
      if (res?.success === false) throw new Error(res.message || "Falha ao salvar avatar");

      notify.success(`Avatar de ${previewAgent.name} salvo com sucesso!`);
      await fetchData();
    } catch (err: any) {
      notify.error(err?.message || "Não foi possível salvar o avatar.");
    } finally {
      setIsSavingAvatar(false);
    }
  }, [previewAgent, previewStore, fetchData]);

  const activeHairItem = useMemo(() => {
    const hair = previewAgent?.avatarConfig?.hair;
    const gender = previewAgent?.avatarConfig?.body === "male" ? "male" : "female";
    const foundModular = AVATAR_HAIRS.find((h) => h.id === hair);
    if (foundModular) return resolveItemDisplayForGender(foundModular, gender);
    const foundLegacy = [...HAIRSTYLES_FEMALE, ...HAIRSTYLES_MALE].find((h) => h.id === hair);
    if (foundLegacy) return { title: foundLegacy.label };
    return { title: gender === "male" ? "Executivo Clássico" : "Rabo de Cavalo Executivo" };
  }, [previewAgent?.avatarConfig?.hair, previewAgent?.avatarConfig?.body]);

  const activeFaceItem = useMemo(() => {
    const face = previewAgent?.avatarConfig?.face;
    return AVATAR_FACES.find((f) => f.id === face) || { title: "Cordial & Empático" };
  }, [previewAgent?.avatarConfig?.face]);

  const activeOutfitItem = useMemo(() => {
    const outfit = previewAgent?.avatarConfig?.outfit || previewAgent?.avatarConfig?.clothing;
    const foundModular = AVATAR_OUTFITS.find((o) => o.id === outfit);
    if (foundModular) return foundModular;
    const foundLegacy = CLOTHING_STYLES.find((c) => c.id === outfit);
    if (foundLegacy) return { title: foundLegacy.label };
    return { title: "Polo ZAI" };
  }, [previewAgent?.avatarConfig?.outfit, previewAgent?.avatarConfig?.clothing]);

  const activeAccessoryItem = useMemo(() => {
    const cfg = previewAgent?.avatarConfig;
    if (cfg?.headset && cfg.headset !== "none") return "Headset Pro";
    if (cfg?.accessories?.badge && cfg.accessories.badge !== "none") return "Crachá ZAI";
    if (cfg?.glasses && cfg.glasses !== "none") return "Óculos";
    if (cfg?.workObject === "tablet_zai") return "Tablet";
    if (cfg?.accessories?.watch && cfg.accessories.watch !== "none") return "Smartwatch";
    return null;
  }, [previewAgent?.avatarConfig]);

  const activeStyleItem = useMemo(() => {
    const style = previewAgent?.avatarConfig?.style;
    return AVATAR_STYLES.find((s) => s.id === style) || { title: style || "Vendas" };
  }, [previewAgent?.avatarConfig?.style]);

  useEffect(() => {
    let cancelled = false;
    if (previewAgent?.key && typeof apiService.getAgentEvolution === "function") {
      apiService.getAgentEvolution(previewAgent.key)
        .then((res: any) => {
          if (!cancelled && res?.success) setEvolutionData(res.evolution);
        })
        .catch(() => {});
    }
    if (typeof apiService.getConversations === "function") {
      apiService.getConversations(false, { limit: 6 })
        .then((convs: any) => {
          if (!cancelled && Array.isArray(convs)) setRealConversations(convs);
        })
        .catch(() => {});
    }
    return () => { cancelled = true; };
  }, [previewAgent?.key]);

  const handleSyncRealAttendance = async () => {
    setIsSyncingAttendance(true);
    setSyncStatus(null);
    try {
      if (typeof apiService.syncManualAttendance === "function") {
        const res = await apiService.syncManualAttendance(300);
        const mined = res?.minedCount ?? 0;
        const xp = res?.xpGained ?? 0;
        setSyncStatus(`${mined} conversas sincronizadas • +${xp} XP`);
        notify.success(`${mined} atendimentos reais foram sincronizados!`);
      }
      if (previewAgent?.key && typeof apiService.getAgentEvolution === "function") {
        const evo = await apiService.getAgentEvolution(previewAgent.key);
        if (evo?.success) setEvolutionData(evo.evolution);
      }
      if (typeof apiService.getConversations === "function") {
        const latestConvs = await apiService.getConversations(true, { limit: 6 });
        if (Array.isArray(latestConvs)) setRealConversations(latestConvs);
      }
    } catch (err: any) {
      notify.error(err?.message || "Não foi possível sincronizar os atendimentos reais.");
    } finally {
      setIsSyncingAttendance(false);
    }
  };

  // Mode switcher: "complete" (Abas Expansíveis) vs "steps" (Passo a passo guiado)
  const [viewMode, setViewMode] = useState<"complete" | "steps">(
    searchParams.get("mode") === "steps" ? "steps" : "complete"
  );
  const [activeStep, setActiveStep] = useState<number>(1);
  const [collapsedCards, setCollapsedCards] = useState<Record<string, boolean>>({
    avatarStudio: false,
    objectiveTone: true,
    prompt: false,
    providers: false,
    chatSandbox: false,
  });

  const toggleCard = (cardKey: string) => {
    setCollapsedCards((prev) => ({
      ...prev,
      [cardKey]: !prev[cardKey],
    }));
  };

  const handleCardHeaderKeyDown = (event: React.KeyboardEvent<HTMLElement>, cardKey: string) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggleCard(cardKey);
    }
  };

  const toggleAllCards = () => {
    const allCollapsed = Object.values(collapsedCards).every(Boolean);
    const nextVal = !allCollapsed;
    setCollapsedCards({
      avatarStudio: nextVal,
      objectiveTone: nextVal,
      prompt: nextVal,
      providers: nextVal,
      chatSandbox: nextVal,
    });
  };

  // Agent Configuration State
  const [selectedObjective, setSelectedObjective] = useState<string>("fechamento");
  const [selectedTone, setSelectedTone] = useState<string>("friendly");
  const [responseStyle, setResponseStyle] = useState<string>("short_natural");
  const [temperature, setTemperature] = useState<number>(0.3);
  const [agentPrompt, setAgentPrompt] = useState<string>(PROMPT_TEMPLATES[0].prompt);
  const [selectedProvider, setSelectedProvider] = useState<string>("vps_engine");
  const [selectedModel, setSelectedModel] = useState<string>("laya-system1");
  const [apiKey, setApiKey] = useState<string>("");
  const [showApiKey, setShowApiKey] = useState<boolean>(false);
  const [isSavingAgent, setIsSavingAgent] = useState<boolean>(false);
  const [isTestingConnection, setIsTestingConnection] = useState<boolean>(false);
  const [connectionTestResult, setConnectionTestResult] = useState<any>(null);

  // Sync state when previewAgent changes
  useEffect(() => {
    if (previewAgent) {
      if (previewAgent.objective) setSelectedObjective(previewAgent.objective);
      if (previewAgent.tone) setSelectedTone(previewAgent.tone);
      if (previewAgent.responseStyle) setResponseStyle(previewAgent.responseStyle);
      if (typeof previewAgent.temperature === "number") setTemperature(previewAgent.temperature);
      if (previewAgent.personality || previewAgent.prompt) {
        setAgentPrompt(previewAgent.personality || previewAgent.prompt);
      }
      setSelectedProvider(previewAgent.provider || "vps_engine");
      setSelectedModel(previewAgent.model || "laya-system1");
    }
  }, [previewAgent?.key]);

  const handleSaveAgentConfig = async () => {
    if (!previewAgent) return;
    if (previewAgent.isExample) {
      notify.info(`Este perfil é o modelo demonstrativo de ${previewAgent.name}. Clique em 'Criar Atendente' para criar um funcionário digital real.`);
      setIsWizardOpen(true);
      return;
    }
    setIsSavingAgent(true);
    try {
      const payload: any = {
        objective: selectedObjective,
        tone: selectedTone,
        responseStyle,
        temperature,
        personality: agentPrompt,
        prompt: agentPrompt,
        provider: selectedProvider,
        model: selectedModel,
      };
      const result = await apiService.updateAIAgent(previewAgent.key, payload);
      if (result.success === false) throw new Error("Não foi possível salvar as configurações do atendente.");

      if (apiKey.trim()) {
        const provRes = await apiService.saveUserProvider({
          provider: selectedProvider,
          api_key: apiKey.trim(),
          model: selectedModel,
          enabled: true,
        });
        if (provRes.success === false) throw new Error("A chave do provedor não pôde ser salva.");
        setApiKey("");
      }

      notify.success(`Configurações de ${previewAgent.name} salvas com sucesso!`);
      await fetchData();
    } catch (err: any) {
      notify.error(err?.message || "Erro ao salvar configurações do atendente.");
    } finally {
      setIsSavingAgent(false);
    }
  };

  const handleTestConnection = async () => {
    if (apiKey.trim()) {
      notify.info("Salve a chave de API antes de testar a conexão.");
      return;
    }
    setIsTestingConnection(true);
    setConnectionTestResult(null);
    const testQuery = "Olá! Gostaria de saber quais produtos, serviços e promoções você tem disponíveis e como pode me ajudar.";
    try {
      const userMsg: SandboxChatMessage = {
        id: generateUuid(),
        sender: "user",
        text: testQuery,
        cleanText: testQuery,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setSandboxMessages((prev) => [...prev, userMsg]);

      const response = await apiService.testAIMessage({
        message: testQuery,
        prompt: agentPrompt || previewAgent?.personality || undefined,
        agentKey: previewAgent?.key,
        agentName: previewAgent?.name,
        agent: previewAgent ? {
          ...previewAgent,
          personality: agentPrompt || previewAgent.personality,
          prompt: agentPrompt || previewAgent.prompt,
          responseStyle,
          temperature,
        } : undefined,
        responseStyle,
        temperature,
        model: selectedModel,
        providerId: selectedProvider,
      });
      const res = response.result;
      if (!res) throw new Error(response.error || "O teste não retornou dados.");
      setConnectionTestResult(res);
      if (res.ok) {
        if (res.quotaInfo) {
          setZaiUsage(res.quotaInfo as any);
        }
        if (res.response) {
          const { cleanText, media, quickReplyTitle } = parseMediaFromResponse(res.response, res);
          const agentMsg: SandboxChatMessage = {
            id: generateUuid(),
            sender: "agent",
            text: res.response,
            cleanText: cleanText || res.response,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            media,
            quickReplyTitle,
            metrics: {
              responseTimeMs: res.responseTimeMs || 0,
              tokens: res.totalTokens || 0,
              provider: currentProviderDef.name || selectedProvider,
              model: res.model || selectedModel,
            },
          };
          setSandboxMessages((prev) => [...prev, agentMsg]);
        }
        notify.success(`${currentProviderDef.name} validado com sucesso! ${previewAgent?.name || "Atendente"} respondeu em ${res.responseTimeMs || 0}ms.`);
      } else {
        notify.error(res.error || "Falha na conexão com o provedor.");
      }
    } catch (err: any) {
      notify.error(err?.message || "Não foi possível testar a conexão com o provedor.");
    } finally {
      setIsTestingConnection(false);
    }
  };

  const currentObjectiveDef = OBJECTIVES.find((o) => o.id === selectedObjective) || OBJECTIVES[0];
  const currentToneDef = TONE_OPTIONS.find((t) => t.id === selectedTone) || TONE_OPTIONS[0];
  const currentProviderDef = getProviderDef(selectedProvider);

  const availableModels = useMemo(() => {
    if (!isAdmin) {
      return ["auto"];
    }
    return currentProviderDef.models;
  }, [isAdmin, currentProviderDef]);

  const handleSaveAll = async () => {
    await handleSaveAgentConfig();
    if (previewAgent && !previewAgent.isExample) {
      await handleSaveAvatar();
    }
  };

  // Filter attendants by store
  const belongsToStore = useCallback((agent: any, storeId: string) => {
    if (!agent.sessionIds?.length) return agent.storeId === storeId;
    return stores.find(store => store.id === storeId)?.numbers?.some((number: any) => agent.sessionIds.includes(number.sessionId)) === true;
  }, [stores]);
  const filteredAttendants = useMemo(() => {
    let list = agents;
    if (selectedWhatsApp) list = agents.filter(a => a.sessionIds?.includes(selectedWhatsApp));
    else if (selectedStoreFilter !== "all") list = agents.filter((a) => belongsToStore(a, selectedStoreFilter));

    if (list.length === 0 && !selectedWhatsApp && selectedStoreFilter === "all") {
      return EXAMPLE_ATTENDANTS;
    }
    return list;
  }, [agents, selectedStoreFilter, belongsToStore, selectedWhatsApp]);

  // Operational Cards Pagination (Max 4 cards per page to prevent infinite page growth)
  const [opCardPage, setOpCardPage] = useState(1);
  const OP_CARDS_PER_PAGE = 4;
  const totalOpCardPages = Math.max(1, Math.ceil(filteredAttendants.length / OP_CARDS_PER_PAGE));
  const paginatedOpCards = useMemo(() => {
    const start = (opCardPage - 1) * OP_CARDS_PER_PAGE;
    return filteredAttendants.slice(start, start + OP_CARDS_PER_PAGE);
  }, [filteredAttendants, opCardPage]);

  const assignmentConflicts = useMemo(() => sessions.flatMap(session => {
    const sessionId = session.sessionId || session.id;
    const responsible = agents.filter(agent => agent.sessionIds?.includes(sessionId));
    return responsible.length > 1 ? [{ sessionId, session, responsible }] : [];
  }), [sessions, agents]);
  useEffect(() => {
    if (selectedWhatsApp) {
      const responsible = agents.filter(agent => agent.sessionIds?.includes(selectedWhatsApp));
      setPreviewAgent(responsible.length === 1 ? responsible[0] : null);
    }
  }, [selectedWhatsApp, agents]);
  const switchAttendant = async (agentKey: string) => {
    if (!selectedWhatsApp || !agentKey || switchingAttendant) return;
    setSwitchingAttendant(true);
    try {
      const result = await apiService.assignAttendantToConnection(selectedWhatsApp, agentKey);
      if (result.success === false) throw new Error("Não foi possível trocar o atendente.");
      await fetchData();
      notify.success("Atendente responsável atualizado. Os dados do WhatsApp foram preservados.");
    } catch (error) { notify.error(error instanceof Error ? error.message : "Falha ao trocar atendente."); }
    finally { setSwitchingAttendant(false); }
  };
  useEffect(() => {
    if (!selectedWhatsApp && selectedStoreFilter !== "all" && previewAgent && !filteredAttendants.some(agent => agent.key === previewAgent.key)) setPreviewAgent(filteredAttendants[0] || null);
  }, [selectedStoreFilter, filteredAttendants, previewAgent, selectedWhatsApp]);

  const handleToggleActive = async (agent: any) => {
    const nextState = agent.active === false;
    if (pendingAgent) return;
    setPendingAgent(agent.key);
    try {
      const result = await apiService.toggleAIAgent(agent.key, nextState);
      if (result.success === false) throw new Error("A alteração não foi salva.");
      setAgents((prev) => prev.map((a) => (a.key === agent.key ? { ...a, active: nextState, status: nextState ? "active" : "paused" } : a)));
      setPreviewAgent((current: any) => current?.key === agent.key ? { ...current, active: nextState, status: nextState ? "active" : "paused" } : current);
      notify.success(nextState ? `${agent.name} ativado(a)` : `${agent.name} pausado(a)`);
      await fetchData();
    } catch (err: any) {
      notify.error(err?.message || "Erro ao alternar status do atendente.");
    } finally {
      setPendingAgent(null);
    }
  };

  const handleDuplicate = async (agent: any) => {
    try {
      await apiService.cloneAIAgent(agent.key);
      notify.success(`Atendente duplicado(a) a partir de ${agent.name}!`);
      await fetchData();
    } catch (err: any) {
      notify.error(err?.message || "Erro ao duplicar atendente.");
    }
  };

  const handleDelete = async (agent: any) => {
    if (agents.length <= 1) {
      notify.error("A empresa deve possuir pelo menos 1 atendente digital.");
      return;
    }
    if (!window.confirm(`Tem certeza que deseja remover o atendente ${agent.name}?`)) return;
    try {
      await apiService.deleteAIAgent(agent.key);
      notify.success(`Atendente ${agent.name} removido(a).`);
      if (previewAgent?.key === agent.key) {
        setPreviewAgent(null);
      }
      await fetchData();
    } catch (err: any) {
      notify.error(err?.message || "Erro ao excluir atendente.");
    }
  };

  const handleOpenReassign = (agent: any) => {
    setReassignAgent(agent);
    setSelectedSessionForReassign(agent.sessionIds?.[0] || "");
    setReassignModalOpen(true);
  };

  const handleSaveReassign = async () => {
    if (!reassignAgent) return;
    setIsReassigning(true);
    try {
      if (selectedSessionForReassign) {
        const result = await apiService.assignAttendantToConnection(selectedSessionForReassign, reassignAgent.key);
        if (result.success === false) throw new Error("Não foi possível salvar o vínculo.");
        notify.success(`${reassignAgent.name} vinculado(a) à conexão com sucesso!`);
      } else {
        // Desvincular de todas
        if (reassignAgent.sessionIds?.length) {
          for (const sessionId of reassignAgent.sessionIds) {
            const result = await apiService.assignAttendantToConnection(sessionId, null);
            if (result.success === false) throw new Error("Não foi possível remover o vínculo.");
          }
          notify.success(`Atendente desvinculado(a) do número.`);
        }
      }
      setReassignModalOpen(false);
      await fetchData();
    } catch (err: any) {
      notify.error(err?.message || "Erro ao vincular número.");
    } finally {
      setIsReassigning(false);
    }
  };

  const handleSendTestMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sandboxInput.trim() || isTestingAgent) return;

    const userText = sandboxInput.trim();
    const testedAgentKey = previewAgent?.key;
    const version = ++testVersion.current;
    const startTime = Date.now();
    setSandboxInput("");

    const userMsg: SandboxChatMessage = {
      id: generateUuid(),
      sender: "user",
      text: userText,
      cleanText: userText,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setSandboxMessages((prev) => [...prev, userMsg]);
    setIsTestingAgent(true);
    setTestingElapsedMs(0);

    const timerInterval = setInterval(() => {
      setTestingElapsedMs(Date.now() - startTime);
    }, 100);

    try {
      // Passar histórico acumulado para contexto comercial contínuo
      const historyPayload = sandboxMessages.map((m) => ({
        role: m.sender === "user" ? "user" : "assistant",
        content: m.text,
      }));

      const response = await apiService.testAIMessage({
        prompt: agentPrompt || previewAgent?.personality || undefined,
        message: userText,
        agentKey: previewAgent?.key,
        agentName: previewAgent?.name,
        agent: previewAgent ? {
          ...previewAgent,
          personality: agentPrompt || previewAgent.personality,
          prompt: agentPrompt || previewAgent.prompt,
          responseStyle,
          temperature,
        } : undefined,
        responseStyle,
        temperature,
        sessionId: previewAgent?.sessionIds?.[0],
        providerId: selectedProvider,
        model: selectedModel,
        history: historyPayload,
      });

      clearInterval(timerInterval);
      const totalElapsedMs = Date.now() - startTime;
      setTestingElapsedMs(totalElapsedMs);

      if (response.result?.quotaInfo) {
        setZaiUsage(response.result.quotaInfo as any);
      }

      const reply = response.result?.response;
      if (response.success === false || !response.result?.ok || !reply) {
        const errorMsg = response.error || response.result?.error || "O teste não retornou uma resposta.";
        throw new Error(errorMsg);
      }

      if (selectedAgentKey.current !== testedAgentKey || version !== testVersion.current) return;

      const { cleanText, media, quickReplyTitle } = parseMediaFromResponse(reply, response.result);
      const isFast = response.result?.provider === "vps_fast_path";

      const agentMsg: SandboxChatMessage = {
        id: generateUuid(),
        sender: "agent",
        text: reply,
        cleanText: cleanText || reply,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        media,
        quickReplyTitle,
        metrics: {
          responseTimeMs: response.result?.responseTimeMs ?? totalElapsedMs,
          tokens: response.result?.totalTokens ?? 0,
          provider: isFast ? "Rota Rápida VPS" : (getProviderDef(selectedProvider)?.name || selectedProvider),
          model: response.result?.model || selectedModel,
          isFastPath: isFast,
        },
      };

      setSandboxMessages((prev) => [...prev, agentMsg]);
      await fetchZaiUsage();
    } catch (err: any) {
      clearInterval(timerInterval);
      if (selectedAgentKey.current !== testedAgentKey || version !== testVersion.current) return;

      const isQuotaExceeded = err?.response?.status === 402 || String(err?.message || "").includes("Limite diário gratuito");
      const errorText = isQuotaExceeded
        ? "⚠️ Limite diário gratuito do Provedor ZAI atingido (50/50). Adicione saldo à sua conta para continuar hoje."
        : `Serviço de IA indisponível: ${err?.message || "conexão recusada"}`;

      if (isQuotaExceeded) {
        fetchZaiUsage();
      }

      setSandboxMessages((prev) => [
        ...prev,
        {
          id: generateUuid(),
          sender: "agent",
          text: errorText,
          cleanText: errorText,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      clearInterval(timerInterval);
      if (version === testVersion.current) setIsTestingAgent(false);
    }
  };

  const STEPS = [
    { step: 1, title: "Avatar Studio", desc: "Aparência do atendente", icon: TShirt },
    { step: 2, title: "Objetivo & Tom", desc: "Conversão e linguagem", icon: Target },
    { step: 3, title: "Prompt & Instruções", desc: "Personalidade da IA", icon: Sparkle },
    { step: 4, title: "Provedores & Modelos", desc: "Motor e chaves de API", icon: Cpu },
    { step: 5, title: "Chat & Sandbox", desc: "Teste ao vivo interativo", icon: ChatCircleText },
  ];

  /* -------------------------------------------------------------
     RENDER SUB-SECTIONS (REUSABLE IN BOTH MODES)
  ------------------------------------------------------------- */
  const renderAvatarStudioSection = () => {
    if (!previewAgent) return null;
    const isExplicitMale = previewAgent.avatarConfig?.body === "male" || previewAgent.avatarConfig?.base === "male";
    const isExplicitFemale = previewAgent.avatarConfig?.body === "female" || previewAgent.avatarConfig?.base === "female";
    const nameLower = String(previewAgent.name || previewAgent.key || "").toLowerCase();
    const defaultGender: "male" | "female" = isExplicitMale
      ? "male"
      : isExplicitFemale
      ? "female"
      : nameLower.includes("carlos") || nameLower.includes("joao") || nameLower.includes("rafael") || nameLower.includes("pedro")
      ? "male"
      : "female";

    let resolvedInlineAvatar = previewAgent.avatarConfig || createAgentAvatar({
      agentId: previewAgent.key || previewAgent.name,
      name: previewAgent.name,
      role: previewAgent.role,
      storeId: previewStore?.id,
      storeDNA: previewStore ? buildStoreVisualDNA(previewStore) : undefined,
      gender: defaultGender,
    });
    const inlineGender: "male" | "female" =
      resolvedInlineAvatar.body === "male" || resolvedInlineAvatar.base === "male" ? "male" : "female";
    const inlineSpriteId = resolveSpriteForAvatar(resolvedInlineAvatar, false);
    const isAgentActive =
      previewAgent.active !== false &&
      (aiStatus?.active !== false && (aiStatus?.enabled ?? aiStatus?.ai) !== false);

    return (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left: 3D/2.5D Living Avatar Box (Col 5) */}
        <div className="lg:col-span-5 space-y-2.5">
          <div className="w-full h-[300px] sm:h-[330px] rounded-2xl overflow-hidden border border-border/60 shadow-inner relative flex flex-col items-center justify-center bg-gradient-to-b from-[#091120] to-[#040812] select-none">
            {/* Isometric Grid Floor Accent */}
            <div
              className="absolute inset-0 opacity-15 pointer-events-none"
              style={{
                backgroundImage: "radial-gradient(circle at 2px 2px, #10b981 1px, transparent 0)",
                backgroundSize: "20px 20px",
              }}
            />

            {/* Top Stage Header Bar: Info Chip on left, Controls on right */}
            <div className="absolute top-2.5 inset-x-2.5 z-20 flex items-center justify-between gap-2 pointer-events-none">
              {/* Top-left Info Chip */}
              <div className="pointer-events-auto flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/80 border border-border/70 text-[10px] backdrop-blur-xs shadow-xs shrink-0">
                <span
                  className={cn(
                    "w-1.5 h-1.5 rounded-full",
                    isAgentActive ? "bg-emerald-400 animate-pulse" : "bg-amber-400"
                  )}
                />
                <span className="font-semibold text-foreground">{previewAgent.name}</span>
                <span className="text-muted-foreground text-[10px] font-mono">
                  ({inlineGender === "male" ? "Masculino" : "Feminino"})
                </span>
                <span className="text-muted-foreground">•</span>
                <span className="font-mono text-emerald-400 text-[9px]">
                  {isAgentActive ? "No PC · Trabalhando" : "Em pé · Parado"}
                </span>
              </div>

              {/* Top-right Dual Controls: Render Mode & Gender */}
              <div className="pointer-events-auto flex items-center gap-1.5 flex-wrap justify-end">
                <div className="flex items-center gap-1 p-0.5 rounded-full bg-black/80 border border-border/70 backdrop-blur-xs">
                  <button
                    type="button"
                    data-studio-gender="female"
                    onClick={() => {
                      const updated = {
                        ...resolvedInlineAvatar,
                        body: "female" as const,
                        base: "female" as const,
                        hair: "hair_01",
                        face: "face_01",
                        catalogSpriteId: undefined,
                      };
                      handleUpdateAvatar({
                        body: "female",
                        base: "female",
                        hair: "hair_01",
                        face: "face_01",
                        hairColor: resolveHairColorForHair("hair_01", resolvedInlineAvatar.hairColor, true),
                        catalogSpriteId: resolveSpriteForAvatar(updated, true),
                      });
                    }}
                    className={cn(
                      "px-2 py-0.5 rounded-full text-[10px] font-mono font-bold transition-all cursor-pointer",
                      inlineGender === "female"
                        ? "bg-emerald-500/25 text-emerald-300 border border-emerald-500/50"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                    title="Personagem Feminina"
                  >
                    ♀ Fem
                  </button>
                  <button
                    type="button"
                    data-studio-gender="male"
                    onClick={() => {
                      const updated = {
                        ...resolvedInlineAvatar,
                        body: "male" as const,
                        base: "male" as const,
                        hair: "hair_05",
                        face: "face_02",
                        catalogSpriteId: undefined,
                      };
                      handleUpdateAvatar({
                        body: "male",
                        base: "male",
                        hair: "hair_05",
                        face: "face_02",
                        hairColor: resolveHairColorForHair("hair_05", resolvedInlineAvatar.hairColor, false),
                        catalogSpriteId: resolveSpriteForAvatar(updated, true),
                      });
                    }}
                    className={cn(
                      "px-2 py-0.5 rounded-full text-[10px] font-mono font-bold transition-all cursor-pointer",
                      inlineGender === "male"
                        ? "bg-emerald-500/25 text-emerald-300 border border-emerald-500/50"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                    title="Personagem Masculino"
                  >
                    ♂ Masc
                  </button>
                </div>
              </div>
            </div>

            {/* Centered Live Modular 3D/2.5D Character on Turntable / Workstation Scenario */}
            <div
              className={cn(
                "relative w-full h-[270px] sm:h-[300px] flex items-center justify-center my-auto select-none transition-colors",
                isStudioDragging ? "cursor-grabbing" : "cursor-grab"
              )}
              onMouseDown={handleInlineStageMouseDown}
              onTouchStart={handleInlineStageTouchStart}
              title="Clique e arraste para girar em 360°"
            >
              {/* Tripo3D Orbit Degree Indicator kept for tests/accessibility */}
              <div className="sr-only">
                <span>360° Orbit · {studioRotationY}°</span>
              </div>

              {/* Interactive Speech bubble when typing or test chat is in flight */}
              {isAgentActive && (previewPresence?.state === "TYPING" || isTestingAgent) && (
                <div className="absolute top-6 left-1/2 -translate-x-1/2 z-30 animate-bounce bg-emerald-500 text-black px-3 py-0.5 rounded-full text-[10px] font-black shadow-lg flex items-center gap-1.5 pointer-events-none">
                  <span className="w-1.5 h-1.5 rounded-full bg-black animate-ping" />
                  <span>💬 {previewAgent.name} respondendo ao cliente...</span>
                </div>
              )}

              {/* Semantic sprite img kept in DOM for legacy test selectors */}
              <img
                src={`/assets/avatar_factory/catalog/${inlineSpriteId}_clean.png`}
                alt={previewAgent.name || "Avatar do atendente"}
                data-studio-rotation={studioRotationY}
                data-studio-movement={studioMovement3D}
                className="sr-only"
                aria-hidden="true"
              />
              <ZaiAvatarRenderer
                avatar={{
                  ...resolvedInlineAvatar,
                  body: inlineGender,
                  base: inlineGender,
                  rotationY: studioRotationY,
                  movement3D: studioMovement3D,
                }}
                renderStyle={resolvedInlineAvatar.renderStyle || "chibi_25d"}
                state={
                  isAgentActive && studioMovement3D === "idle" && !isStudioDragging
                    ? previewPresence?.state === "TYPING" || previewPresence?.state === "TALKING"
                      ? previewPresence.state
                      : "WORKING"
                    : "WAITING"
                }
                size="workspace"
                rotationY={studioRotationY}
                movement3D={studioMovement3D}
                showStatusBadge={false}
              />
            </div>
          </div>

          {/* 3D Movement Controls */}
          <div className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-muted/15 border border-border/50">
            {([
              { id: "walk", label: "Andar 3D" },
              { id: "wave", label: "Acenar 3D" },
              { id: "pose", label: "Posar 3D" },
              { id: "spin360", label: "⤾ Giro Contínuo" },
            ] as const).map((mv) => (
              <button
                key={mv.id}
                type="button"
                data-studio-movement={mv.id}
                data-avatar-3d-movement={mv.id}
                onClick={() => {
                  const nextMovement = studioMovement3D === mv.id ? "idle" : mv.id;
                  const nextRot = mv.id !== "spin360" && nextMovement !== "idle" && studioRotationY === 0 ? 45 : studioRotationY;
                  setStudioMovement3D(nextMovement);
                  setStudioRotationY(nextRot);
                  handleUpdateAvatar({ rotationY: nextRot, movement3D: nextMovement });
                }}
                className={cn(
                  "py-1 px-1 rounded-lg border text-[10px] font-mono transition-all cursor-pointer text-center",
                  studioMovement3D === mv.id
                    ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300 font-bold"
                    : "bg-card/70 border-border/60 text-muted-foreground hover:text-foreground"
                )}
              >
                {mv.label}
              </button>
            ))}
          </div>

          {/* Action Row */}
          <div className="flex items-center justify-between gap-2 pt-1">
            <span className="text-[11px] text-muted-foreground">
              Personalização em camadas • Salve para aplicar
            </span>
            <div className="flex items-center gap-2">
              {!previewAgent.isExample && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAvatarEditorAgent(previewAgent)}
                  className="h-8 text-xs rounded-xl px-2.5 border-border/70 text-muted-foreground hover:text-foreground cursor-pointer"
                  title="Abrir Studio Completo em Janela Expandida"
                >
                  <TShirt className="h-3.5 w-3.5 mr-1" />
                  <span>Estúdio Avançado</span>
                </Button>
              )}
              <Button
                variant="default"
                size="sm"
                onClick={handleSaveAvatar}
                disabled={isSavingAvatar}
                className={cn(
                  "h-8 text-xs rounded-xl px-3 gap-1.5 font-semibold shadow-xs cursor-pointer",
                  previewAgent.isExample
                    ? "bg-sky-600 hover:bg-sky-500 text-white"
                    : "bg-emerald-600 hover:bg-emerald-500 text-white"
                )}
              >
                <FloppyDisk className="h-3.5 w-3.5" />
                <span>{isSavingAvatar ? "Salvando..." : "Salvar Avatar"}</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Right: 5 Categories Selector + Items Grid (Col 7) */}
        <div className="lg:col-span-7 space-y-3">
          {/* 5 Category Selector Buttons (Cabelo, Rosto, Roupa, Acessórios, Estilo) */}
          <div className="grid grid-cols-5 gap-1.5 p-1 rounded-xl bg-muted/20 border border-border/60">
            {[
              { id: "hair" as const, label: "Cabelo", icon: Scissors },
              { id: "face" as const, label: "Rosto", icon: Smiley },
              { id: "outfit" as const, label: "Roupa", icon: TShirt },
              { id: "accessories" as const, label: "Acessórios", icon: Eyeglasses },
              { id: "style" as const, label: "Estilo", icon: Sparkle },
            ].map((cat) => {
              const Icon = cat.icon;
              const isSelected = studioCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setStudioCategory(cat.id)}
                  className={cn(
                    "py-2 px-1 rounded-lg text-xs font-bold uppercase transition-all flex flex-col items-center justify-center gap-1 cursor-pointer",
                    isSelected
                      ? "bg-card text-emerald-400 border border-emerald-500/50 shadow-xs"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span className="text-[10px] sm:text-xs">{cat.label}</span>
                </button>
              );
            })}
          </div>

          {/* Interactive Items Selection Grid */}
          <div className="rounded-xl border border-border/60 bg-card/60 p-3 max-h-[280px] overflow-y-auto scrollbar-zai">
            {studioCategory === "hair" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {AVATAR_HAIRS.map((h) => {
                  const currentHair = previewAgent?.avatarConfig?.hair;
                  const isSelected =
                    currentHair === h.id ||
                    (h.id === "hair_01" && currentHair === "female_ponytail_brunette") ||
                    (h.id === "hair_05" && currentHair === "male_short_fade");
                  const resolvedHairSprite = resolveItemSpriteForGender(h, inlineGender);
                  const display = resolveItemDisplayForGender(h, inlineGender);
                  return (
                    <button
                      key={h.id}
                      type="button"
                      data-avatar-item={h.id}
                      onClick={() => {
                        const hairColor = resolveHairColorForHair(h.id, previewAgent?.avatarConfig?.hairColor, inlineGender !== "male");
                        const nextConfig = {
                          ...resolvedInlineAvatar,
                          body: inlineGender,
                          base: inlineGender,
                          hair: h.id,
                          hairColor,
                        };
                        handleUpdateAvatar({
                          body: inlineGender,
                          base: inlineGender,
                          hair: h.id,
                          hairColor,
                          catalogSpriteId: resolveSpriteForAvatar(nextConfig, true),
                        });
                      }}
                      className={cn(
                        "p-2 rounded-xl border text-left transition-all flex items-center gap-2.5 cursor-pointer select-none",
                        isSelected
                          ? "border-emerald-500 bg-emerald-500/15 text-emerald-300 shadow-xs"
                          : "border-border/60 bg-muted/15 hover:border-border text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <AvatarItemPreview
                        spriteRef={resolvedHairSprite}
                        itemId={h.id}
                        gender={inlineGender}
                        focus="hair"
                        selected={isSelected}
                        size="sm"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold truncate text-foreground">{display.title}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{display.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {studioCategory === "face" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {AVATAR_FACES.map((f) => {
                  const isSelected = previewAgent?.avatarConfig?.face === f.id;
                  const resolvedFaceSprite = resolveItemSpriteForGender(f, inlineGender);
                  return (
                    <button
                      key={f.id}
                      type="button"
                      data-avatar-item={f.id}
                      onClick={() => {
                        const nextConfig = {
                          ...resolvedInlineAvatar,
                          body: inlineGender,
                          base: inlineGender,
                          face: f.id,
                        };
                        handleUpdateAvatar({
                          body: inlineGender,
                          base: inlineGender,
                          face: f.id,
                          catalogSpriteId: resolveSpriteForAvatar(nextConfig, true),
                        });
                      }}
                      className={cn(
                        "p-2 rounded-xl border text-left transition-all flex items-center gap-2.5 cursor-pointer select-none",
                        isSelected
                          ? "border-emerald-500 bg-emerald-500/15 text-emerald-300 shadow-xs"
                          : "border-border/60 bg-muted/15 hover:border-border text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <AvatarItemPreview
                        spriteRef={resolvedFaceSprite || inlineSpriteId}
                        itemId={f.id}
                        gender={inlineGender}
                        focus="face"
                        selected={isSelected}
                        size="sm"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold truncate text-foreground">{f.title}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{f.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {studioCategory === "outfit" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {AVATAR_OUTFITS.map((o) => {
                  const isSelected = (previewAgent?.avatarConfig?.outfit || previewAgent?.avatarConfig?.clothing) === o.id;
                  const resolvedOutfitSprite = resolveItemSpriteForGender(o, inlineGender);
                  return (
                    <button
                      key={o.id}
                      type="button"
                      data-avatar-item={o.id}
                      onClick={() => {
                        const nextConfig = {
                          ...resolvedInlineAvatar,
                          body: inlineGender,
                          base: inlineGender,
                          outfit: o.id,
                          clothing: o.id,
                        };
                        handleUpdateAvatar({
                          body: inlineGender,
                          base: inlineGender,
                          outfit: o.id,
                          clothing: o.id,
                          catalogSpriteId: resolveSpriteForAvatar(nextConfig, true),
                        });
                      }}
                      className={cn(
                        "p-2 rounded-xl border text-left transition-all flex items-center gap-2.5 cursor-pointer select-none",
                        isSelected
                          ? "border-emerald-500 bg-emerald-500/15 text-emerald-300 shadow-xs"
                          : "border-border/60 bg-muted/15 hover:border-border text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <AvatarItemPreview
                        spriteRef={resolvedOutfitSprite}
                        itemId={o.id}
                        gender={inlineGender}
                        focus="outfit"
                        selected={isSelected}
                        size="sm"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold truncate text-foreground">{o.title}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{o.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {studioCategory === "accessories" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {AVATAR_ACCESSORIES.map((a) => {
                  const cfg = previewAgent?.avatarConfig;
                  const isEquipped =
                    (a.id === "acc_01" && (!cfg?.accessories || Object.values(cfg?.accessories || {}).every((v: any) => v === "none"))) ||
                    (a.id === "acc_02" && cfg?.headset && cfg.headset !== "none") ||
                    (a.id === "acc_03" && cfg?.accessories?.badge && cfg.accessories.badge !== "none") ||
                    (a.id === "acc_04" && cfg?.glasses && cfg.glasses !== "none") ||
                    (a.id === "acc_05" && cfg?.workObject === "tablet_zai") ||
                    (a.id === "acc_06" && cfg?.accessories?.watch && cfg.accessories.watch !== "none") ||
                    (a.id === "acc_07" && cfg?.glasses === "sunglasses_wayfarer") ||
                    (a.id === "acc_08" && cfg?.workObject === "coffee_cup") ||
                    (a.id === "acc_09" && cfg?.workObject === "boxes_delivery") ||
                    (a.id === "acc_10" && cfg?.workObject === "laptop_zai") ||
                    (a.id === "acc_11" && cfg?.accessories?.backpack === "backpack_tactical_black") ||
                    (a.id === "acc_12" && cfg?.accessories?.headwear === "hardhat_zai_white");

                  const focusType =
                    a.id === "acc_01"
                      ? "full"
                      : a.id === "acc_02" || a.id === "acc_04" || a.id === "acc_07" || a.id === "acc_12"
                      ? "accessory-head"
                      : "accessory-body";
                  const resolvedAccSprite = resolveItemSpriteForGender(a, inlineGender);

                  return (
                    <button
                      key={a.id}
                      type="button"
                      data-avatar-item={a.id}
                      onClick={() => {
                        const updatedAccessories = { ...(cfg?.accessories || {}) };
                        let updatedHeadset = cfg?.headset || "none";
                        let updatedGlasses = cfg?.glasses || "none";
                        let updatedWorkObject = cfg?.workObject || "none";

                        if (a.id === "acc_01") {
                          updatedHeadset = "none";
                          updatedAccessories.headset = "none";
                          updatedAccessories.badge = "none";
                          updatedAccessories.watch = "none";
                          updatedWorkObject = "none";
                          updatedGlasses = "none";
                          updatedAccessories.backpack = "none";
                          updatedAccessories.headwear = "none";
                        } else if (a.id === "acc_02") {
                          updatedHeadset = updatedHeadset === "headset_zai_green" ? "none" : "headset_zai_green";
                          updatedAccessories.headset = updatedHeadset;
                        } else if (a.id === "acc_03") {
                          updatedAccessories.badge = updatedAccessories.badge === "badge_zai_lanyard" ? "none" : "badge_zai_lanyard";
                        } else if (a.id === "acc_04") {
                          updatedGlasses = updatedGlasses === "glasses_square_exec" ? "none" : "glasses_square_exec";
                          updatedAccessories.glasses = updatedGlasses;
                        } else if (a.id === "acc_05") {
                          updatedWorkObject = updatedWorkObject === "tablet_zai" ? "none" : "tablet_zai";
                        } else if (a.id === "acc_06") {
                          updatedAccessories.watch = updatedAccessories.watch === "watch_zai_smart" ? "none" : "watch_zai_smart";
                        } else if (a.id === "acc_07") {
                          updatedGlasses = updatedGlasses === "sunglasses_wayfarer" ? "none" : "sunglasses_wayfarer";
                          updatedAccessories.glasses = updatedGlasses;
                        } else if (a.id === "acc_08") {
                          updatedWorkObject = updatedWorkObject === "coffee_cup" ? "none" : "coffee_cup";
                        } else if (a.id === "acc_09") {
                          updatedWorkObject = updatedWorkObject === "boxes_delivery" ? "none" : "boxes_delivery";
                        } else if (a.id === "acc_10") {
                          updatedWorkObject = updatedWorkObject === "laptop_zai" ? "none" : "laptop_zai";
                        } else if (a.id === "acc_11") {
                          updatedAccessories.backpack = updatedAccessories.backpack === "backpack_tactical_black" ? "none" : "backpack_tactical_black";
                        } else if (a.id === "acc_12") {
                          updatedAccessories.headwear = updatedAccessories.headwear === "hardhat_zai_white" ? "none" : "hardhat_zai_white";
                        }

                        handleUpdateAvatar({
                          body: inlineGender,
                          base: inlineGender,
                          accessories: updatedAccessories,
                          headset: updatedHeadset,
                          glasses: updatedGlasses,
                          workObject: updatedWorkObject,
                        });
                      }}
                      className={cn(
                        "p-2 rounded-xl border text-left transition-all flex items-center gap-2.5 cursor-pointer select-none",
                        isEquipped
                          ? "border-emerald-500 bg-emerald-500/15 text-emerald-300 shadow-xs"
                          : "border-border/60 bg-muted/15 hover:border-border text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <AvatarItemPreview
                        spriteRef={resolvedAccSprite || inlineSpriteId}
                        itemId={a.id}
                        gender={inlineGender}
                        focus={focusType}
                        selected={Boolean(isEquipped)}
                        size="sm"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold truncate text-foreground">{a.title}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{a.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {studioCategory === "style" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {AVATAR_STYLES.map((st) => {
                  const isSelected = previewAgent?.avatarConfig?.style === st.id;
                  const resolvedStyleSprite = resolveItemSpriteForGender(st, inlineGender);
                  return (
                    <button
                      key={st.id}
                      type="button"
                      data-avatar-item={st.id}
                      onClick={() => {
                        const updated = applyStylePreset(resolvedInlineAvatar, st.id);
                        handleUpdateAvatar({
                          ...updated,
                          style: st.id,
                          catalogSpriteId: resolveSpriteForAvatar({ ...updated, style: st.id }, true),
                        });
                      }}
                      className={cn(
                        "p-2 rounded-xl border text-left transition-all flex items-center gap-2.5 cursor-pointer select-none",
                        isSelected
                          ? "border-emerald-500 bg-emerald-500/15 text-emerald-300 shadow-xs"
                          : "border-border/60 bg-muted/15 hover:border-border text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <AvatarItemPreview
                        spriteRef={resolvedStyleSprite}
                        itemId={st.id}
                        gender={inlineGender}
                        focus="full"
                        selected={isSelected}
                        size="sm"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold truncate text-foreground">{st.title}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{st.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderObjectiveToneSection = () => {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
        {/* Left Column: Objetivo Central de Atendimento */}
        <div className="p-4 rounded-2xl border border-border/70 bg-card/70 space-y-3.5">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Target className="h-4 w-4 text-emerald-400" />
                <span>Objetivo Central de Atendimento</span>
              </h4>
              <p className="text-xs text-muted-foreground">
                Define o foco de conversão e a postura que a IA assumirá em cada conversa.
              </p>
            </div>
            <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/40 text-[10px]">
              {currentObjectiveDef.title}
            </Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {OBJECTIVES.map((obj) => {
              const Icon = obj.icon;
              const isSelected = selectedObjective === obj.id;
              return (
                <div
                  key={obj.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    setSelectedObjective(obj.id);
                    notify.info(`Objetivo "${obj.title}" selecionado.`);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") setSelectedObjective(obj.id);
                  }}
                  className={cn(
                    "p-3.5 rounded-2xl border text-left cursor-pointer transition-all duration-200 space-y-2 flex flex-col justify-between select-none relative group",
                    isSelected
                      ? "bg-emerald-500/10 border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.15)] ring-1 ring-emerald-500/50"
                      : "bg-background/60 border-border/70 hover:bg-card hover:border-emerald-500/30"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div
                        className={cn(
                          "h-8 w-8 rounded-xl flex items-center justify-center transition-colors shrink-0",
                          isSelected
                            ? "bg-emerald-500 text-white shadow-xs"
                            : "bg-muted/50 text-muted-foreground border border-border/50 group-hover:text-foreground"
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-foreground block leading-tight">
                          {obj.title}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {isSelected ? "● Ativo agora" : "Foco comercial"}
                        </span>
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[9px] font-semibold px-2 py-0.5 rounded-full shrink-0 border",
                        isSelected
                          ? "border-emerald-500/40 text-emerald-300 bg-emerald-500/15"
                          : "border-border/70 text-muted-foreground bg-muted/20"
                      )}
                    >
                      {obj.badge}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
                    {obj.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Tom de Atendimento & Ajustes Finos */}
        <div className="p-4 rounded-2xl border border-border/70 bg-card/70 space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Sliders className="h-4 w-4 text-emerald-400" />
                <span>Tom de Atendimento & Ajustes Finos</span>
              </h4>
              <p className="text-xs text-muted-foreground">
                Escolha a linguagem e a velocidade de raciocínio das respostas.
              </p>
            </div>
            <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-300 bg-emerald-500/10">
              {currentToneDef.label}
            </Badge>
          </div>

          {/* 4 Tone Cards in 2x2 grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {TONE_OPTIONS.map((t) => {
              const isSelected = selectedTone === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelectedTone(t.id)}
                  className={cn(
                    "p-3 rounded-2xl text-left border text-xs transition-all duration-200 select-none cursor-pointer space-y-1",
                    isSelected
                      ? "border-emerald-500 bg-emerald-500/10 text-emerald-300 font-semibold shadow-[0_0_15px_rgba(16,185,129,0.12)] ring-1 ring-emerald-500/40"
                      : "border-border/70 bg-background/60 text-muted-foreground hover:bg-card hover:text-foreground hover:border-emerald-500/30"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-foreground text-xs">{t.label}</span>
                    {isSelected && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />}
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-relaxed line-clamp-2">
                    {t.desc}
                  </p>
                </button>
              );
            })}
          </div>

          {/* Fine Tuning Sliders */}
          <div className="pt-2 border-t border-border/40 space-y-3">
            {/* Response Style Segmented Control */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-foreground">Estilo de Resposta</span>
                <span className="text-[11px] font-mono text-emerald-400">
                  {responseStyle === "short_natural"
                    ? "Curto & Direto"
                    : responseStyle === "detailed"
                    ? "Explicativo & Detalhado"
                    : "Natural & Equilibrado"}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-background/60 border border-border/60">
                {[
                  { id: "short_natural", label: "Curto & Direto" },
                  { id: "balanced", label: "Equilibrado" },
                  { id: "detailed", label: "Detalhado" },
                ].map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setResponseStyle(st.id)}
                    className={cn(
                      "py-1.5 rounded-lg text-xs font-semibold transition-all text-center cursor-pointer",
                      responseStyle === st.id
                        ? "bg-emerald-600 text-white shadow-xs"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                    )}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Model Temperature Slider */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-foreground">Temperatura do Modelo</span>
                <span className="text-[11px] font-mono text-emerald-400">
                  {temperature.toFixed(2)} {temperature < 0.4 ? "(Mais Preciso)" : temperature > 0.7 ? "(Mais Criativo)" : "(Equilibrado)"}
                </span>
              </div>
              <Slider
                value={[temperature]}
                min={0}
                max={1}
                step={0.05}
                onValueChange={(val) => setTemperature(val[0])}
                className="py-1"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
                <span>0.00 Mais Focado</span>
                <span>0.50 Padrão</span>
                <span>1.00 Mais Criativo</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderPromptSection = () => {
    return (
      <div className="p-4 rounded-2xl border border-border/70 bg-card/70 space-y-3.5 flex flex-col h-full">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="space-y-0.5">
            <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Sparkle weight="fill" className="h-4 w-4 text-emerald-400" />
              <span>Prompt & Treinamento Contínuo ({previewAgent?.name})</span>
            </h4>
            <p className="text-xs text-muted-foreground">
              Envie novas informações para a atendente absorver e evoluir o contexto de atendimento.
            </p>
          </div>
          <span className="text-[11px] font-mono text-muted-foreground bg-muted/30 px-2 py-0.5 rounded-md border border-border/50 shrink-0">
            {agentPrompt.length} caracteres
          </span>
        </div>

        {/* Console de Absorção de Informações / Treinamento Contínuo */}
        <div className="p-3 rounded-xl border border-emerald-500/40 bg-emerald-950/20 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
              <Sparkle weight="fill" className="h-3.5 w-3.5 text-emerald-400" />
              <span>Ensinar / Absorver Nova Informação</span>
            </div>
            <Badge variant="outline" className="text-[9px] border-emerald-500/40 text-emerald-300 bg-emerald-500/10 uppercase font-semibold">
              Aprendizado Ativo
            </Badge>
          </div>
          <p className="text-[11px] text-muted-foreground leading-snug">
            Envie comandos, regras ou preços. <strong>{previewAgent?.name}</strong> absorve imediatamente e responde no chat ao lado.
          </p>
          <form onSubmit={handleAbsorbInstruction} className="flex gap-2">
            <Input
              placeholder={`Diga algo para ${previewAgent?.name} aprender (ex: Cimento CP II agora custa R$ 26,00 à vista)...`}
              value={newInstruction}
              onChange={(e) => setNewInstruction(e.target.value)}
              className="h-9 text-xs rounded-xl bg-background/80 border-border/80 flex-1"
              disabled={isAbsorbing}
            />
            <Button
              type="submit"
              size="sm"
              disabled={!newInstruction.trim() || isAbsorbing}
              className="h-9 px-3.5 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white gap-1.5 cursor-pointer shadow-xs shrink-0"
            >
              <Plus className={cn("h-3.5 w-3.5", isAbsorbing && "animate-spin")} />
              <span>{isAbsorbing ? "Absorvendo..." : "Absorver"}</span>
            </Button>
          </form>

          {/* Últimos conhecimentos absorvidos */}
          {absorbedHistory.length > 0 && (
            <div className="pt-1.5 border-t border-border/40 space-y-1">
              <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
                Informações Absorvidas Recentemente:
              </span>
              <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto scrollbar-zai">
                {absorbedHistory.map((item, idx) => (
                  <Badge key={idx} variant="outline" className="text-[10px] border-emerald-500/30 bg-emerald-500/10 text-emerald-300 py-0.5 px-2">
                    ✨ {item}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Textarea */}
        <div className="space-y-1.5 flex-1 flex flex-col">
          <div className="flex items-center justify-between">
            <label htmlFor="agent-prompt-textarea" className="text-xs font-semibold text-foreground">
              Diretrizes & Instruções Completas do Atendente
            </label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleSaveAgentConfig}
              disabled={isSavingAgent}
              className="h-6 text-[10px] text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 px-2 cursor-pointer"
            >
              <FloppyDisk className="h-3 w-3 mr-1" />
              Salvar Diretrizes
            </Button>
          </div>
          <Textarea
            id="agent-prompt-textarea"
            value={agentPrompt}
            onChange={(e) => setAgentPrompt(e.target.value)}
            rows={8}
            placeholder="Defina aqui como o atendente deve agir, políticas de preço, frete, formas de pagamento e comportamento..."
            className="rounded-xl text-xs font-mono bg-background/70 border-border/70 focus:border-emerald-500/60 leading-relaxed resize-y flex-1 min-h-[140px] scrollbar-zai"
          />
        </div>

        {/* Quick Prompt Templates */}
        <div className="space-y-1.5 pt-1">
          <span className="text-[11px] font-semibold text-muted-foreground">Modelos Base de Atendimento:</span>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {PROMPT_TEMPLATES.map((tmpl, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setAgentPrompt(tmpl.prompt);
                  notify.info(`Modelo "${tmpl.title}" aplicado ao prompt.`);
                }}
                className="p-2 rounded-xl border border-border/60 bg-background/60 hover:bg-card hover:border-emerald-500/40 text-left transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[11px] font-bold text-foreground group-hover:text-emerald-400 transition-colors">
                    {tmpl.title}
                  </span>
                  <Wand2 className="h-3 w-3 text-muted-foreground group-hover:text-emerald-400" />
                </div>
                <p className="text-[10px] text-muted-foreground line-clamp-1 leading-relaxed">
                  {tmpl.desc}
                </p>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderProvidersSection = () => {
    return (
      <div className="p-4 rounded-2xl border border-border/70 bg-card/70 space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Cpu className="h-4 w-4 text-emerald-400" />
              <span>Provedores de IA & Modelos</span>
            </h4>
            <p className="text-xs text-muted-foreground">
              Configure o motor neural e a chave de API que processará as respostas deste atendente.
            </p>
          </div>
          <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-300 bg-emerald-500/10 uppercase flex items-center gap-1.5 py-1 px-2.5">
            <ProviderLogo providerId={currentProviderDef.id} className="h-3.5 w-3.5 shrink-0" />
            <span>{currentProviderDef.name}</span>
          </Badge>
        </div>

        {/* Status / Cota do Provedor ZAI */}
        {selectedProvider === "vps_engine" && (
          isAdmin ? (
            <div className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 flex items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-300 shrink-0">
                  <Crown className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-emerald-300 flex items-center gap-2">
                    <span>Conta Administrador — Provedor ZAI com Acesso Ilimitado</span>
                    <Badge className="bg-emerald-500 text-black text-[9px] font-bold px-1.5 py-0">LIBERADO</Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Sua conta master tem uso liberado e ilimitado sem limite de mensagens diárias ou necessidade de recarga de saldo.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-xl border border-border/70 bg-card/60 space-y-2 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span className="text-xs font-bold text-foreground">Cota Diária Provedor ZAI</span>
                </div>
                <span className="text-xs font-semibold text-emerald-400">
                  {zaiUsage ? `${zaiUsage.countToday} / ${zaiUsage.limitToday} mensagens grátis hoje` : "50 mensagens grátis/dia"}
                </span>
              </div>
              <div className="w-full bg-muted/40 h-2 rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full transition-all",
                    zaiUsage?.remainingToday === 0 && (zaiUsage?.balanceCredits || 0) <= 0 ? "bg-destructive" : "bg-emerald-500"
                  )}
                  style={{ width: `${Math.min(100, ((zaiUsage?.countToday || 0) / (Number(zaiUsage?.limitToday) || 50)) * 100)}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
                <span>
                  {zaiUsage?.remainingToday !== undefined ? `${zaiUsage.remainingToday} gratuitas restantes hoje` : "50 restantes"}
                  {Number(zaiUsage?.balanceCredits || 0) > 0 && ` • Saldo extra: R$ ${(Number(zaiUsage.balanceCredits)).toFixed(2)}`}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setRechargeModalOpen(true)}
                  className="h-7 text-[11px] rounded-lg border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 cursor-pointer"
                >
                  + Adicionar Saldo
                </Button>
              </div>
            </div>
          )
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Provider Select */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Provedor</label>
            <Select
              value={selectedProvider}
              onValueChange={(val) => {
                setSelectedProvider(val);
                const def = getProviderDef(val);
                if (def) setSelectedModel(def.defaultModel);
              }}
            >
              <SelectTrigger className="h-10 rounded-xl bg-background/70 border-border/70 text-xs">
                <div className="flex items-center gap-2 truncate">
                  <ProviderLogo providerId={selectedProvider} className="h-4 w-4 shrink-0" />
                  <span className="font-medium">{currentProviderDef.name}</span>
                </div>
              </SelectTrigger>
              <SelectContent>
                {PROVIDER_OPTIONS.map((p) => (
                  <SelectItem key={p.id} value={p.id} className="text-xs">
                    <div className="flex items-center gap-2">
                      <ProviderLogo providerId={p.id} className="h-4 w-4 shrink-0" />
                      <span className="font-medium">{p.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Model Select */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-foreground">Modelo</label>
              {!isAdmin && (
                <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-amber-500/40 text-amber-400 bg-amber-500/10">
                  Modo Auto (Admin gerencia)
                </Badge>
              )}
            </div>
            <Select
              value={isAdmin ? selectedModel : "auto"}
              onValueChange={(val) => {
                if (isAdmin) setSelectedModel(val);
              }}
              disabled={!isAdmin}
            >
              <SelectTrigger className="h-10 rounded-xl bg-background/70 border-border/70 text-xs">
                <SelectValue placeholder="Selecione o modelo" />
              </SelectTrigger>
              <SelectContent>
                {availableModels.map((m) => (
                  <SelectItem key={m} value={m} className="text-xs">
                    {m === "auto" ? "auto (Automático / Otimizado por IA)" : m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!isAdmin && (
              <p className="text-[10px] text-muted-foreground leading-tight">
                Usuários operacionais utilizam roteamento automático. Troca manual reservada a administradores.
              </p>
            )}
          </div>

          {/* API Key */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Chave de API (Opcional)</label>
            <div className="relative">
              <Input
                type={showApiKey ? "text" : "password"}
                placeholder="sk-proj-..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="h-10 rounded-xl bg-background/70 border-border/70 text-xs pr-10"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>

        {/* Test Connection Button & Result */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border/40">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleTestConnection}
              disabled={isTestingConnection}
              className="h-9 text-xs rounded-xl gap-2 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10 cursor-pointer"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", isTestingConnection && "animate-spin")} />
              <span>{isTestingConnection ? "Validando Conexão..." : "Testar Conexão com Provedor"}</span>
            </Button>
            {connectionTestResult && (
              <Badge
                variant="outline"
                className={cn(
                  "text-xs px-2.5 py-1",
                  connectionTestResult.ok
                    ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/10"
                    : "border-destructive/40 text-destructive bg-destructive/10"
                )}
              >
                {connectionTestResult.ok
                  ? `Sucesso • ${connectionTestResult.responseTimeMs || 0}ms`
                  : `Falha: ${connectionTestResult.error || "Erro de conexão"}`}
              </Badge>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">
            A chave é armazenada com criptografia de ponta a ponta no backend da loja.
          </p>
        </div>

        {/* Resposta Real da Atendente ao Testar Provedor */}
        {connectionTestResult && connectionTestResult.ok && connectionTestResult.response && (
          <div className="p-3.5 rounded-xl border border-emerald-500/40 bg-emerald-950/20 space-y-2 mt-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Avatar className="h-6 w-6 border border-emerald-500/40">
                  <AvatarImage src={previewAgent.avatar} />
                  <AvatarFallback className="text-[10px] bg-emerald-900/50 text-emerald-200">
                    {previewAgent.name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs font-semibold text-foreground">
                  Resposta Real de {previewAgent.name} (Atendente Oficial da Loja):
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-400 bg-emerald-500/10">
                  ⏱️ {connectionTestResult.responseTimeMs || 0}ms
                </Badge>
                {connectionTestResult.totalTokens ? (
                  <Badge variant="outline" className="text-[10px] border-border/60 text-muted-foreground bg-muted/20">
                    🪙 {connectionTestResult.totalTokens} tokens
                  </Badge>
                ) : null}
              </div>
            </div>
            <p className="text-xs text-foreground/90 bg-background/50 p-2.5 rounded-lg border border-border/40 whitespace-pre-wrap leading-relaxed">
              {connectionTestResult.response}
            </p>
            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-muted-foreground">
                Interação registrada ao vivo no Chat Sandbox ao lado.
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  const chatEl = document.getElementById("chat-sandbox-content") || document.getElementById("sandbox-container");
                  chatEl?.scrollIntoView({ behavior: "smooth" });
                }}
                className="h-7 text-[11px] text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 cursor-pointer"
              >
                <span>💬 Ir para o Chat ao Lado &rarr;</span>
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderSandboxSection = () => {
    if (!previewAgent) return null;
    return (
      <div className="p-4 rounded-2xl border border-border/70 bg-card/70 space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
              <ChatCircleText weight="bold" className="h-4 w-4 text-emerald-400" />
              <span>Sandbox de Atendimento & Chat ao Vivo ({previewAgent.name})</span>
            </h4>
            <p className="text-xs text-muted-foreground">
              Inteligência real do atendente. Mensagens de teste não afetam clientes no WhatsApp.
            </p>
          </div>
          <Badge variant="outline" className="text-[10px] font-bold text-emerald-400 border-emerald-500/30 bg-emerald-500/10 uppercase">
            AO VIVO
          </Badge>
        </div>

        {/* Quick test pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1">
          <span className="text-[10px] text-muted-foreground shrink-0 font-medium">Perguntas rápidas:</span>
          {["Qual é o catálogo?", "Formas de pagamento?", "Horário de atendimento?", "Quais são as promoções?"].map((q, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setSandboxInput(q)}
              disabled={isTestingAgent}
              className="px-2.5 py-0.5 rounded-full text-[10px] bg-muted/40 hover:bg-emerald-500/15 text-muted-foreground hover:text-emerald-300 border border-border/60 shrink-0 transition-colors cursor-pointer"
            >
              {q}
            </button>
          ))}
        </div>

        {/* Chat message box */}
        <div ref={sandboxScrollRef} className="h-[340px] rounded-xl border border-border/60 bg-background/50 p-3 overflow-y-auto space-y-3 text-xs scrollbar-zai">
          {sandboxMessages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center p-4 text-muted-foreground space-y-1.5">
              <Headset className="h-7 w-7 text-muted-foreground/60" />
              <p className="text-xs font-semibold text-foreground">Ambiente de Teste Interativo</p>
              <p className="text-[11px] max-w-xs">
                Envie uma pergunta para testar as respostas de <strong>{previewAgent.name}</strong> com a inteligência e configurações reais salvas.
              </p>
            </div>
          )}
          {sandboxMessages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "max-w-[88%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed shadow-xs transition-all",
                msg.sender === "user"
                  ? "ml-auto bg-emerald-600 text-white rounded-br-xs"
                  : "mr-auto bg-card border border-border/60 text-foreground rounded-bl-xs"
              )}
            >
              {/* Texto principal da mensagem sem tags de código cru */}
              <div className="whitespace-pre-wrap">{msg.cleanText || msg.text}</div>

              {/* Mídia Anexada (Áudio Player funcional / Imagem com zoom / Vídeo / Documento) */}
              {msg.media && <SandboxMediaPreview media={msg.media} />}

              {/* Metadados e badges de performance e delay */}
              {msg.sender === "agent" && msg.metrics && (
                <div className="flex flex-wrap items-center gap-1.5 pt-2 mt-2 border-t border-border/40 text-[10px] text-muted-foreground font-mono">
                  <span className="flex items-center gap-1 text-emerald-400 font-semibold bg-emerald-500/10 px-1.5 py-0.5 rounded-md">
                    ⏱️ {(msg.metrics.responseTimeMs / 1000).toFixed(1)}s
                  </span>
                  <span className="flex items-center gap-1 text-amber-400 font-semibold bg-amber-500/10 px-1.5 py-0.5 rounded-md">
                    🪙 {msg.metrics.tokens ?? 0} tokens
                  </span>
                  <span className="flex items-center gap-1 text-cyan-300 bg-cyan-500/10 px-1.5 py-0.5 rounded-md">
                    ⚡ {msg.metrics.provider} ({msg.metrics.model})
                  </span>
                  {msg.quickReplyTitle && (
                    <span className="text-emerald-300 font-semibold bg-emerald-500/15 px-1.5 py-0.5 rounded-md truncate max-w-[200px]">
                      🎵 Resposta Rápida: {msg.quickReplyTitle}
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
          {isTestingAgent && (
            <div className="mr-auto bg-card border border-emerald-500/40 text-foreground rounded-2xl rounded-bl-xs px-3.5 py-2 text-xs flex items-center gap-2.5 shadow-xs">
              <div className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
              <span className="font-medium text-emerald-300">{previewAgent.name} está digitando...</span>
              <Badge variant="outline" className="text-[10px] font-mono border-emerald-500/40 text-emerald-400 bg-emerald-500/10 px-1.5 py-0">
                ⏱️ {(testingElapsedMs / 1000).toFixed(1)}s
              </Badge>
            </div>
          )}
        </div>

        {/* Input Composer */}
        <form onSubmit={handleSendTestMessage} className="flex items-center gap-2 pt-1">
          <Input
            placeholder={`Pergunte algo para ${previewAgent.name}...`}
            value={sandboxInput}
            onChange={(e) => setSandboxInput(e.target.value)}
            className="rounded-xl text-xs h-10 flex-1"
            disabled={isTestingAgent}
          />
          <Button
            type="submit"
            size="sm"
            disabled={!sandboxInput.trim() || isTestingAgent}
            className="h-10 rounded-xl text-xs bg-emerald-600 hover:bg-emerald-500 text-white px-5 font-semibold shadow-xs cursor-pointer"
          >
            Enviar
          </Button>
        </form>
      </div>
    );
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header title="Atendente IA" />

      <main className="flex-1 p-4 md:p-6 max-w-7xl mx-auto w-full space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "flex h-11 w-11 items-center justify-center rounded-2xl border transition-colors",
                  activeTab === "attendants"
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                    : activeTab === "copilot"
                    ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                    : activeTab === "memory"
                    ? "bg-purple-500/10 border-purple-500/30 text-purple-400"
                    : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                )}
              >
                {activeTab === "attendants" ? (
                  <Headset weight="fill" className="h-6 w-6" />
                ) : activeTab === "copilot" ? (
                  <img
                    src="/assets/mascot/zaibot_avatar.png"
                    alt="ZAIBOT"
                    className="h-8 w-8 rounded-xl object-cover shrink-0"
                  />
                ) : activeTab === "memory" ? (
                  <Sparkle weight="fill" className="h-6 w-6" />
                ) : (
                  <TrendUp className="h-6 w-6" />
                )}
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground font-display flex items-center gap-2">
                  <span>
                    {activeTab === "attendants"
                      ? "Atendente IA"
                      : activeTab === "copilot"
                      ? "Assistente ZAI"
                      : activeTab === "memory"
                      ? "Memória do Atendente"
                      : "Evolução IA"}
                  </span>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px] uppercase font-bold",
                      activeTab === "attendants"
                        ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/10"
                        : activeTab === "copilot"
                        ? "border-amber-500/30 text-amber-400 bg-amber-500/10"
                        : activeTab === "memory"
                        ? "border-purple-500/30 text-purple-400 bg-purple-500/10"
                        : "border-emerald-500/30 text-emerald-400 bg-emerald-500/10"
                    )}
                  >
                    {activeTab === "attendants"
                      ? "Operação de Atendimento"
                      : activeTab === "copilot"
                      ? "Copiloto da Plataforma"
                      : activeTab === "memory"
                      ? "Base de Conhecimento"
                      : "Aprendizado Contínuo"}
                  </Badge>
                </h1>
                <p className="hidden md:block text-xs md:text-sm text-muted-foreground">
                  {activeTab === "attendants"
                    ? "Loja, WhatsApp e atendimento em um só lugar."
                    : activeTab === "copilot"
                    ? "Consulte a operação e gerencie os atendentes com dados do sistema."
                    : "Acompanhe score, nível de aprendizado e respostas em tempo real."}
                </p>
              </div>
            </div>
          </div>
        </div>

        {loadError && <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm"><span>{loadError}</span><Button size="sm" variant="outline" onClick={() => void fetchData()}>Tentar novamente</Button></div>}

        {/* ROW 0: ATENDENTES DIGITAIS + NOVO ATENDENTE NA MESMA LINHA */}
        <section aria-label="Seleção de atendente" className="p-3 sm:p-3.5 rounded-2xl border border-border/70 bg-card/60 space-y-2 md:grid-cols-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-foreground font-display flex items-center gap-2">
                <span>Atendentes Digitais</span>
                <Badge variant="outline" className={cn(
                  "text-[10px] px-1.5 py-0.5 border font-semibold",
                  agents.filter((a) => {
                    const sess = (Array.isArray(sessions) && sessions.length > 0)
                      ? (a.sessionIds?.length
                          ? sessions.find((s) => s && a.sessionIds.includes(s.sessionId || s.id))
                          : activeSessionId && activeSessionId !== "all"
                            ? sessions.find((s) => s && (s.sessionId === activeSessionId || s.id === activeSessionId))
                            : sessions.find((s) => s && (s.connected || s.status === "connected")))
                      : null;
                    return a.active !== false && Boolean(sess && (sess.connected || sess.status === "connected"));
                  }).length > 0
                    ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/10"
                    : "border-red-500/30 text-red-400 bg-red-500/10"
                )}>
                  {agents.filter((a) => {
                    const sess = (Array.isArray(sessions) && sessions.length > 0)
                      ? (a.sessionIds?.length
                          ? sessions.find((s) => s && a.sessionIds.includes(s.sessionId || s.id))
                          : activeSessionId && activeSessionId !== "all"
                            ? sessions.find((s) => s && (s.sessionId === activeSessionId || s.id === activeSessionId))
                            : sessions.find((s) => s && (s.connected || s.status === "connected")))
                      : null;
                    return a.active !== false && Boolean(sess && (sess.connected || sess.status === "connected"));
                  }).length} Ativo(s)
                </Badge>
              </h2>
            </div>
            {/* Hidden native select kept for headless test and accessibility compatibility */}
            <div className="sr-only">
              <Label htmlFor="attendant-selector">Atendente selecionado</Label>
              <select
                id="attendant-selector"
                aria-label="Selecionar atendente"
                value={previewAgent?.key || ""}
                onChange={(event) => {
                  const value = event.target.value;
                  setPreviewAgent(agents.find((agent) => (agent.key || agent.id) === value) || null);
                }}
              >
                <option value="">{isLoading ? "Carregando atendentes…" : "Selecione um atendente"}</option>
                {agents.length > 0 && (
                  <optgroup label="Atendentes cadastrados">
                    {agents.map((agent) => (
                      <option key={agent.key || agent.id} value={agent.key || agent.id}>
                        {agent.name || agent.key}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>
          </div>

          {/* Attendants row with real attendants + [+ Novo Atendente] alongside */}
          <div className="grid grid-cols-2 gap-2.5 w-full sm:flex sm:items-center sm:gap-3 sm:overflow-x-auto pb-1 scrollbar-zai">
            {/* Real Registered Agents or Example Archetypes (João, Ana, Pedro, Mariana) */}
            {(agents.length > 0 ? agents : EXAMPLE_ATTENDANTS).map((agent) => {
              const isSelected = previewAgent?.key === agent.key;
              const liveAvatar =
                isSelected && previewAgent?.avatarConfig
                  ? previewAgent.avatarConfig
                  : agent.avatarConfig ||
                    createAgentAvatar({
                      agentId: agent.key || agent.name,
                      name: agent.name,
                      role: agent.role,
                      gender: agent.character?.gender || (agent.name?.toLowerCase().includes("carlos") ? "male" : "female"),
                    });

              const agentSession = (Array.isArray(sessions) && sessions.length > 0)
                ? (agent.sessionIds?.length
                    ? sessions.find((s) => s && agent.sessionIds.includes(s.sessionId || s.id))
                    : activeSessionId && activeSessionId !== "all"
                      ? sessions.find((s) => s && (s.sessionId === activeSessionId || s.id === activeSessionId))
                      : sessions.find((s) => s && (s.connected || s.status === "connected")))
                : null;
              const isSessionOnline = Boolean(agentSession && (agentSession.connected || agentSession.status === "connected"));
              const isOperativeActive = agent.active !== false && isSessionOnline;

              return (
                <button
                  key={agent.key || agent.id}
                  type="button"
                  onClick={() => setPreviewAgent(agent)}
                  className={cn(
                    "flex items-center gap-2.5 sm:gap-3 p-2 sm:p-2.5 rounded-xl border transition-all text-left w-full sm:w-auto shrink-0 cursor-pointer select-none h-[58px]",
                    isOperativeActive
                      ? isSelected
                        ? "border-emerald-500 bg-emerald-500/15 shadow-[0_0_15px_rgba(16,185,129,0.15)] ring-1 ring-emerald-500/50"
                        : "border-emerald-500/50 bg-card hover:border-emerald-500 hover:bg-card/90"
                      : isSelected
                      ? "border-red-500 bg-red-950/25 shadow-[0_0_15px_rgba(239,68,68,0.2)] ring-1 ring-red-500/50"
                      : "border-red-500/40 bg-card hover:border-red-500/70 hover:bg-card/90"
                  )}
                >
                  <div className="relative h-11 w-11 rounded-lg bg-[#091120] border border-border/60 overflow-hidden flex items-center justify-center shrink-0">
                    <ZaiAvatarRenderer
                      avatar={liveAvatar}
                      state={isOperativeActive ? "WORKING" : "IDLE"}
                      size="xs"
                      showAura={false}
                      showStatusBadge={false}
                      showBrandingLayer={false}
                    />
                    <span className={cn(
                      "absolute bottom-0.5 right-0.5 h-2.5 w-2.5 rounded-full border border-black",
                      isOperativeActive ? "bg-emerald-400 animate-pulse" : !isSessionOnline ? "bg-red-500" : "bg-amber-400"
                    )} />
                  </div>
                  <div className="min-w-0 pr-1 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-foreground truncate max-w-[100px] sm:max-w-[110px]">{agent.name}</span>
                      {isOperativeActive ? (
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleActive(agent);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.stopPropagation();
                              handleToggleActive(agent);
                            }
                          }}
                          className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded border border-emerald-500/40 text-emerald-300 bg-emerald-500/15 hover:bg-emerald-500/30 transition-all cursor-pointer font-bold shrink-0 shadow-xs"
                          title="Atendente ativo no WhatsApp. Clique para pausar."
                        >
                          <span>⏸</span>
                          <span>Ativo</span>
                        </span>
                      ) : !isSessionOnline ? (
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate("/connections");
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.stopPropagation();
                              navigate("/connections");
                            }
                          }}
                          className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded border border-red-500/40 text-red-300 bg-red-500/15 hover:bg-red-500/30 transition-all cursor-pointer font-bold shrink-0 shadow-xs"
                          title="WhatsApp desconectado. Clique para conectar."
                        >
                          <span>⏸</span>
                          <span>Zap Off</span>
                        </span>
                      ) : (
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleActive(agent);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.stopPropagation();
                              handleToggleActive(agent);
                            }
                          }}
                          className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded border border-red-500/40 text-red-300 bg-red-500/15 hover:bg-red-500/30 transition-all cursor-pointer font-bold shrink-0 shadow-xs"
                          title="Atendente pausado. Clique para ativar."
                        >
                          <span>▶</span>
                          <span>Pausado</span>
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground block truncate max-w-[115px] sm:max-w-[130px]">{agent.role || "Especialista"}</span>
                  </div>
                </button>
              );
            })}

            {/* Novo Atendente button right next to attendants */}
            <button
              type="button"
              onClick={() => setIsWizardOpen(true)}
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl border border-dashed border-emerald-500/40 bg-emerald-500/5 hover:bg-emerald-500/15 hover:border-emerald-500 text-emerald-400 hover:text-emerald-300 transition-all w-full sm:w-auto shrink-0 cursor-pointer select-none group h-[58px]"
              title="Criar novo atendente digital para a loja"
            >
              <div className="h-9 w-9 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <Plus weight="bold" className="h-4 w-4 text-emerald-400" />
              </div>
              <div className="text-left pr-1 min-w-0 flex-1">
                <span className="text-xs font-bold block leading-tight truncate">Novo Atendente</span>
                <span className="text-[10px] text-muted-foreground block truncate">Adicionar funcionário</span>
              </div>
            </button>
          </div>

          {/* Unified Link Management Panel */}
          <details className="rounded-2xl border border-border/60 bg-card/30 mt-2">
            <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded-2xl flex items-center justify-between">
              <span className="flex items-center gap-2">
                <ArrowsLeftRight className="h-4 w-4 text-emerald-400" />
                <span>Gerenciar vínculos, lojas e atendentes cadastrados</span>
              </span>
              <span className="text-xs text-muted-foreground font-mono">({agents.length} cadastrados)</span>
            </summary>
            {/* Lista Completa de Atendentes */}
            <div className="p-3 pt-0 space-y-4">
              <div className="flex items-center justify-between pt-2 border-t border-border/40">
                <div>
                  <h3 className="text-sm font-bold text-foreground font-display">Atendentes Cadastrados</h3>
                  <p className="text-xs text-muted-foreground">Gerencie vínculos com WhatsApp, lojas e personalização visual.</p>
                </div>
                <Button onClick={() => setIsWizardOpen(true)} className="gap-2 rounded-xl text-xs h-7 bg-emerald-600 hover:bg-emerald-500 text-white">
                  <Plus weight="bold" className="h-3 w-3" />
                  <span>Novo Atendente</span>
                </Button>
              </div>

              {stores.length > 1 && (
                <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                  <button
                    type="button"
                    onClick={() => setSelectedStoreFilter("all")}
                    className={cn(
                      "px-3.5 py-1.5 rounded-xl border text-xs font-medium transition-all select-none whitespace-nowrap shrink-0",
                      selectedStoreFilter === "all"
                        ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-400 shadow-sm"
                        : "bg-card/50 border-border/60 text-muted-foreground hover:bg-card hover:text-foreground"
                    )}
                  >
                    Todas as Lojas ({agents.length})
                  </button>
                  {stores.map((st) => {
                    const isSelected = selectedStoreFilter === st.id;
                    const count = agents.filter((a) => belongsToStore(a, st.id)).length;
                    return (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => setSelectedStoreFilter(st.id)}
                        className={cn(
                          "flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border text-xs font-medium transition-all select-none shrink-0",
                          isSelected
                            ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-400 shadow-sm"
                            : "bg-card/50 border-border/60 text-muted-foreground hover:bg-card hover:text-foreground"
                        )}
                      >
                        <Storefront className="h-3.5 w-3.5" />
                        <span>{st.name}</span>
                        <span className="text-[10px] text-muted-foreground font-mono">({count})</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[1, 2].map((i) => (
                    <div key={i} className="h-44 rounded-2xl bg-card/60 border border-border/50 animate-pulse" />
                  ))}
                </div>
              ) : filteredAttendants.length === 0 ? (
                <div className="text-center py-12 rounded-2xl border border-dashed border-border/80 bg-card/40 space-y-3">
                  <Headset weight="light" className="h-10 w-10 text-muted-foreground mx-auto" />
                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold">{selectedWhatsApp ? "Nenhum atendente responsável por este WhatsApp" : "Nenhum atendente neste filtro"}</h3>
                    <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                      Crie um atendente digital vinculado ao número do WhatsApp da sua loja.
                    </p>
                  </div>
                  <Button onClick={() => setIsWizardOpen(true)} className="gap-2 rounded-xl text-xs h-8">
                    <Plus weight="bold" className="h-3.5 w-3.5" />
                    <span>Criar Atendente</span>
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {paginatedOpCards.map((agent) => {
                    const isSelected = previewAgent?.key === agent.key;
                    const assignedSession = getAssignedSession(agent);
                    const assignedStore = getAssignedStore(agent);
                    const isActive = agent.active !== false;
                    const isConnected = assignedSession?.status === "connected" || assignedSession?.status === "open";
                    const presence = getPresence(agent);
                    const storePrimaryColor = assignedStore?.settings?.primaryColor || assignedStore?.branding?.primaryColor || "#10b981";

                    return (
                      <Card
                        key={agent.key}
                        data-agent-key={agent.key}
                        onClick={() => setPreviewAgent(agent)}
                        className={cn(
                          "rounded-2xl border transition-all duration-200 cursor-pointer overflow-hidden",
                          isSelected
                            ? "bg-card border-emerald-500/60 shadow-[0_0_20px_rgba(16,185,129,0.12)] ring-1 ring-emerald-500/40"
                            : "bg-card/75 border-border/70 hover:border-emerald-500/30 hover:bg-card/90"
                        )}
                      >
                        <CardContent className="p-4 space-y-3.5">
                          {/* Top: Avatar, Name, Role, Store & WhatsApp Chips, Active Status */}
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="relative shrink-0">
                                <div className="h-12 w-12 rounded-2xl border border-emerald-500/30 bg-[#091120] flex items-center justify-center overflow-hidden">
                                  <ZaiAvatarRenderer
                                    avatar={agent.avatarConfig || createAgentAvatar({
                                      agentId: agent.key || agent.name,
                                      name: agent.name,
                                      role: agent.role,
                                      gender: agent.character?.gender || (agent.name?.toLowerCase().includes("carlos") ? "male" : "female"),
                                    })}
                                    renderStyle="chibi_25d"
                                    state={isActive ? "WORKING" : "IDLE"}
                                    size="sm"
                                    showAura={false}
                                    showStatusBadge={false}
                                    showBrandingLayer={false}
                                  />
                                </div>
                                <span
                                  className={cn(
                                    "absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full ring-2 ring-card",
                                    isActive ? "bg-emerald-500 shadow-glow" : "bg-amber-500"
                                  )}
                                />
                              </div>

                              <div className="min-w-0 space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h3 className="font-display text-base font-bold text-foreground truncate">
                                    {agent.name}
                                  </h3>
                                  <Badge
                                    variant="outline"
                                    className="text-[11px] px-2 py-0 border-emerald-500/30 text-emerald-400 bg-emerald-500/10 font-medium"
                                  >
                                    {agent.role || "Especialista em Vendas"}
                                  </Badge>
                                </div>

                                {/* Integrated Store & WhatsApp Chips */}
                                <div className="flex items-center gap-2 flex-wrap pt-0.5">
                                  {/* Store Chip */}
                                  <div
                                    className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-semibold border"
                                    style={{
                                      borderColor: `${storePrimaryColor}55`,
                                      backgroundColor: `${storePrimaryColor}15`,
                                      color: storePrimaryColor,
                                    }}
                                    title={`Loja vinculada: ${assignedStore?.name || "Sem loja vinculada"}`}
                                  >
                                    <Storefront weight="fill" className="h-3.5 w-3.5 shrink-0" />
                                    <span className="truncate max-w-[180px] font-semibold">{assignedStore?.name || "Sem loja vinculada"}</span>
                                  </div>

                                  {/* WhatsApp Chip */}
                                  <div
                                    className={cn(
                                      "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-medium border",
                                      assignedSession
                                        ? isConnected
                                          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                                          : "border-amber-500/40 bg-amber-500/10 text-amber-300"
                                        : "border-border/60 bg-muted/30 text-muted-foreground"
                                    )}
                                    title={assignedSession ? `WhatsApp: ${assignedSession.sessionName || assignedSession.sessionId}` : "Nenhum WhatsApp vinculado"}
                                  >
                                    <WhatsappLogo
                                      weight="fill"
                                      className={cn(
                                        "h-3.5 w-3.5 shrink-0",
                                        assignedSession ? (isConnected ? "text-emerald-400" : "text-amber-400") : "text-muted-foreground"
                                      )}
                                    />
                                    {assignedSession ? (
                                      <span className="truncate max-w-[150px]">
                                        {assignedSession.phone || assignedSession.sessionName || assignedSession.sessionId}
                                      </span>
                                    ) : (
                                      <span className="italic text-[11px]">Sem WhatsApp</span>
                                    )}
                                    {assignedSession && (
                                      <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", isConnected ? "bg-emerald-400 animate-pulse" : "bg-amber-400")} />
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>

                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px] uppercase font-bold px-2 py-0.5 shrink-0",
                                isActive
                                  ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/15"
                                  : "border-amber-500/40 text-amber-400 bg-amber-500/15"
                              )}
                            >
                              {presence.label}
                            </Badge>
                          </div>

                          {/* Summarized Visual KPI Chips */}
                          <div className="grid grid-cols-3 gap-2 pt-1">
                            <div className="flex items-center gap-2 p-2 rounded-xl bg-background/50 border border-border/50">
                              <div className="p-1 rounded-lg bg-emerald-500/10 text-emerald-400 shrink-0">
                                <ChatCircleText weight="bold" className="h-3.5 w-3.5" />
                              </div>
                              <div className="min-w-0">
                                <span className="text-[10px] text-muted-foreground block truncate">WhatsApps</span>
                                <span className="text-xs font-bold text-foreground font-mono">{agent.sessionIds?.length ?? 0}</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 p-2 rounded-xl bg-background/50 border border-border/50">
                              <div className="p-1 rounded-lg bg-cyan-500/10 text-cyan-400 shrink-0">
                                <Clock weight="bold" className="h-3.5 w-3.5" />
                              </div>
                              <div className="min-w-0">
                                <span className="text-[10px] text-muted-foreground block truncate">Conexão</span>
                                <span className="text-xs font-bold text-foreground">{assignedSession ? (isConnected ? "Online" : "Offline") : "—"}</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 p-2 rounded-xl bg-background/50 border border-border/50">
                              <div className="p-1 rounded-lg bg-emerald-500/10 text-emerald-400 shrink-0">
                                <TrendUp weight="bold" className="h-3.5 w-3.5" />
                              </div>
                              <div className="min-w-0">
                                <span className="text-[10px] text-muted-foreground block truncate">Atendente</span>
                                <span className="text-xs font-bold text-foreground">{isActive ? "Habilitado" : "Pausado"}</span>
                              </div>
                            </div>
                          </div>

                          {/* Quick Actions Bar */}
                          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/40">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setAvatarEditorAgent(agent);
                                }}
                                className="h-7 text-[11px] px-2.5 rounded-lg gap-1 border-emerald-500/50 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 hover:text-emerald-200 font-semibold shadow-xs"
                                title="Abrir ZAI Avatar Studio para personalizar corpo, roupas, cabelo e loja DNA"
                              >
                                <TShirt weight="bold" className="h-3.5 w-3.5 text-emerald-400" />
                                <span>Avatar Studio</span>
                              </Button>

                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenReassign(agent);
                                }}
                                className="h-7 text-[11px] px-2 rounded-lg gap-1 border-border/60 hover:border-emerald-500/40 text-foreground"
                                title="Trocar ou vincular número WhatsApp"
                              >
                                <ArrowsLeftRight className="h-3 w-3 text-emerald-400" />
                                <span>{assignedSession ? "Trocar WhatsApp" : "Vincular WhatsApp"}</span>
                              </Button>

                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setCustomizerAgent(agent);
                                }}
                                className="h-7 text-[11px] px-2 rounded-lg gap-1 border-border/60 text-muted-foreground hover:text-foreground"
                                title="Configurar personalidade e IA"
                              >
                                <Sliders className="h-3 w-3" />
                                <span>Configurar IA</span>
                              </Button>
                            </div>

                            <div className="flex items-center gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleActive(agent);
                                }}
                                className={cn(
                                  "h-7 text-[11px] px-2 rounded-lg gap-1 font-medium",
                                  isActive
                                    ? "border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                                    : "border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                                )}
                                title={isActive ? "Pausar atendente" : "Ativar atendente"}
                                disabled={pendingAgent !== null}
                              >
                                {isActive ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                                <span>{isActive ? "Pausar" : "Ativar"}</span>
                              </Button>

                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDuplicate(agent);
                                }}
                                className="h-7 w-7 p-0 rounded-lg border-border/60 text-muted-foreground hover:text-foreground"
                                title="Duplicar atendente"
                              >
                                <Copy className="h-3 w-3" />
                              </Button>

                              {agents.length > 1 && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDelete(agent);
                                  }}
                                  className="h-7 w-7 p-0 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                  title="Excluir atendente"
                                >
                                  <Trash className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}

              {totalOpCardPages > 1 && (
                <div className="flex justify-center pt-2">
                  <Pagination
                    currentPage={opCardPage}
                    totalPages={totalOpCardPages}
                    pageSize={OP_CARDS_PER_PAGE}
                    onPageChange={setOpCardPage}
                  />
                </div>
              )}
            </div>
          </details>
        </section>

        {/* UNIFIED STREAMLINED CONTROL BAR: TABS + VIEW MODES + SAVE (EXACTLY 2 ROWS ON MOBILE) */}
        <div className="p-2 sm:p-2.5 rounded-2xl border border-border/70 bg-card/80 backdrop-blur shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-2.5">
          {/* Row 1 on Mobile (50/50 split width): Navigation Submenus */}
          <div className="grid grid-cols-2 gap-1.5 w-full sm:w-auto p-0.5 rounded-xl bg-background/60 border border-border/60">
            <button
              type="button"
              onClick={() => handleTabChange("attendants")}
              className={cn(
                "flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-semibold transition-all select-none cursor-pointer w-full",
                activeTab === "attendants"
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-card/40"
              )}
            >
              <Headset weight="fill" className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">Atendente & Config</span>
              <Badge
                variant="outline"
                className={cn(
                  "ml-0.5 text-[9px] px-1 py-0 border-emerald-500/30",
                  activeTab === "attendants" ? "bg-emerald-500/30 text-emerald-200" : "text-muted-foreground"
                )}
              >
                {agents.length}
              </Badge>
            </button>

            <button
              type="button"
              onClick={() => handleTabChange("evolution")}
              className={cn(
                "flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-semibold transition-all select-none cursor-pointer w-full",
                (activeTab === "evolution" || activeTab === "memory")
                  ? "bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-card/40"
              )}
            >
              <Sparkle weight="fill" className="h-3.5 w-3.5 text-purple-400 shrink-0" />
              <span className="truncate">Memória & Evolução</span>
            </button>
          </div>

          {/* Row 2 on Mobile: View Mode Switcher + Action Buttons */}
          {activeTab === "attendants" && (
            <div className="flex items-center justify-between gap-1.5 w-full sm:w-auto sm:ml-auto">
              {/* Mode Switcher */}
              <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-background/60 border border-border/60 shrink-0">
                <button
                  type="button"
                  onClick={() => setViewMode("steps")}
                  className={cn(
                    "flex items-center gap-1 px-2 py-1 rounded-md text-[11px] sm:text-xs font-semibold transition-all cursor-pointer",
                    viewMode === "steps"
                      ? "bg-emerald-600 text-white shadow-xs"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                  )}
                >
                  <CheckCircle2 className="h-3 w-3" />
                  <span className="hidden sm:inline">Modo Guiado</span>
                  <span className="sm:hidden">Guiado</span>
                </button>

                <button
                  type="button"
                  onClick={() => setViewMode("complete")}
                  className={cn(
                    "flex items-center gap-1 px-2 py-1 rounded-md text-[11px] sm:text-xs font-semibold transition-all cursor-pointer",
                    viewMode === "complete"
                      ? "bg-emerald-600 text-white shadow-xs"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                  )}
                >
                  <Layers className="h-3 w-3" />
                  <span className="hidden sm:inline">Modo Completo</span>
                  <span className="sm:hidden">Completo</span>
                </button>
              </div>

              {viewMode === "complete" && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={toggleAllCards}
                  className="h-7 text-xs rounded-lg gap-1 border-border/70 text-muted-foreground hover:text-foreground cursor-pointer px-2 shrink-0"
                >
                  <ChevronsUpDown className="h-3 w-3" />
                  <span className="hidden md:inline">{Object.values(collapsedCards).every(Boolean) ? "Expandir Todas" : "Recolher Todas"}</span>
                </Button>
              )}

              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={handleSaveAll}
                disabled={isSavingAgent}
                className="flex-1 sm:flex-initial h-7 text-xs rounded-lg px-2.5 sm:px-3 gap-1.5 font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs cursor-pointer justify-center"
              >
                <FloppyDisk className="h-3.5 w-3.5 shrink-0" />
                <span>{isSavingAgent ? "Salvando..." : "Salvar Alterações"}</span>
              </Button>
            </div>
          )}
        </div>

        {/* Tab Content: Views */}
        {activeTab === "copilot" ? (
          <div className="rounded-2xl border border-border/70 bg-card/85 backdrop-blur shadow-sm p-4 md:p-6">
            <ZaiPlatformAssistantView
              onOpenNewAgentWizard={() => setIsWizardOpen(true)}
              onRefreshAgents={fetchData}
            />
          </div>
        ) : (activeTab === "evolution" || activeTab === "memory") ? (
          <div className="rounded-2xl border border-border/70 bg-card/85 backdrop-blur shadow-sm p-4 md:p-6">
            <React.Suspense fallback={<div className="p-8 text-center text-sm text-muted-foreground">Carregando memória & evolução cognitiva...</div>}>
              {(() => {
                const previewSession =
                  sessions.find((s) => s.id === previewAgent?.sessionId || s.sessionId === previewAgent?.sessionId || s.id === selectedWhatsApp) ||
                  liveSessions.find((s) => s.id === previewAgent?.sessionId || s.sessionId === previewAgent?.sessionId || s.id === selectedWhatsApp);
                const isSessionOnline = Boolean(previewSession && (previewSession.connected || previewSession.status === "connected"));
                return (
                  <EvolutionTab
                    agentKey={previewAgent?.key}
                    selectedAgent={previewAgent}
                    onSelectAgent={(key) => setPreviewAgent(agents.find((a) => (a.key || a.id) === key) || null)}
                    agents={agents}
                    isSessionConnected={isSessionOnline}
                  />
                );
              })()}
            </React.Suspense>
          </div>
        ) : (
          <>
            {/* UNIFIED ATENDENTE & CONFIGURAÇÃO WORKSPACE */}
            {previewAgent ? (
              <div className="space-y-4">
                {/* RENDER CONTENT BASED ON VIEW MODE */}
                {viewMode === "steps" ? (
                  /* STEPPER WORKFLOW */
                  <div className="rounded-2xl border border-border/70 bg-card/85 backdrop-blur shadow-sm p-4 md:p-6 space-y-6">
                    {/* Horizontal Steps Bar */}
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 border-b border-border/50 pb-4">
                      {STEPS.map((s) => {
                        const Icon = s.icon;
                        const isActive = activeStep === s.step;
                        const isDone = activeStep > s.step;
                        return (
                          <button
                            key={s.step}
                            type="button"
                            onClick={() => setActiveStep(s.step)}
                            className={cn(
                              "p-2.5 rounded-xl border text-left transition-all flex items-center gap-2.5 select-none cursor-pointer",
                              isActive
                                ? "bg-emerald-500/15 border-emerald-500/60 shadow-[0_0_15px_rgba(16,185,129,0.12)] ring-1 ring-emerald-500/40 text-emerald-300"
                                : isDone
                                ? "bg-muted/20 border-emerald-500/30 text-emerald-400"
                                : "bg-muted/10 border-border/60 text-muted-foreground hover:bg-muted/20 hover:text-foreground"
                            )}
                          >
                            <div
                              className={cn(
                                "h-7 w-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0",
                                isActive
                                  ? "bg-emerald-500 text-white"
                                  : isDone
                                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                  : "bg-muted text-muted-foreground"
                              )}
                            >
                              {isDone ? <CheckCircle2 className="h-4 w-4" /> : s.step}
                            </div>
                            <div className="min-w-0">
                              <span className="text-xs font-bold block truncate leading-tight">{s.title}</span>
                              <span className="text-[10px] text-muted-foreground hidden sm:block truncate">{s.desc}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {/* Step Content */}
                    <div className="animate-in fade-in duration-200">
                      {activeStep === 1 && renderAvatarStudioSection()}
                      {activeStep === 2 && renderObjectiveToneSection()}
                      {activeStep === 3 && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
                          <div className="rounded-2xl border border-border/70 bg-card/85 p-4 sm:p-5 flex flex-col">
                            {renderPromptSection()}
                          </div>
                          <div className="rounded-2xl border border-border/70 bg-card/85 p-4 sm:p-5 flex flex-col">
                            {renderSandboxSection()}
                          </div>
                        </div>
                      )}
                      {activeStep === 4 && (
                        <div className="space-y-6">
                          {renderProvidersSection()}
                          <div className="pt-2 border-t border-border/50">
                            <div className="mb-3">
                              <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                                <Sparkle weight="fill" className="h-4 w-4 text-emerald-400" />
                                <span>Studio de Atendimento Meia Tela ({previewAgent?.name})</span>
                              </h4>
                              <p className="text-xs text-muted-foreground">
                                Envie comandos e instruções no prompt à esquerda para a atendente absorver conhecimento e teste no chat à direita.
                              </p>
                            </div>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
                              <div className="rounded-2xl border border-border/70 bg-card/85 p-4 sm:p-5 flex flex-col">
                                {renderPromptSection()}
                              </div>
                              <div className="rounded-2xl border border-border/70 bg-card/85 p-4 sm:p-5 flex flex-col">
                                {renderSandboxSection()}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                      {activeStep === 5 && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
                          <div className="rounded-2xl border border-border/70 bg-card/85 p-4 sm:p-5 flex flex-col">
                            {renderPromptSection()}
                          </div>
                          <div className="rounded-2xl border border-border/70 bg-card/85 p-4 sm:p-5 flex flex-col">
                            {renderSandboxSection()}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Stepper Navigation Footer */}
                    <div className="flex items-center justify-between pt-4 border-t border-border/50">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={activeStep <= 1}
                        onClick={() => setActiveStep((prev) => Math.max(1, prev - 1))}
                        className="h-9 px-4 rounded-xl gap-2 text-xs cursor-pointer"
                      >
                        <ArrowLeft className="h-3.5 w-3.5" />
                        <span>Passo Anterior</span>
                      </Button>

                      <span className="text-xs font-mono text-muted-foreground">
                        Passo {activeStep} de {STEPS.length}
                      </span>

                      {activeStep < STEPS.length ? (
                        <Button
                          type="button"
                          variant="default"
                          size="sm"
                          onClick={() => setActiveStep((prev) => Math.min(STEPS.length, prev + 1))}
                          className="h-9 px-4 rounded-xl gap-2 text-xs bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
                        >
                          <span>Próximo Passo</span>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="default"
                          size="sm"
                          onClick={handleSaveAll}
                          disabled={isSavingAgent}
                          className="h-9 px-4 rounded-xl gap-2 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-semibold cursor-pointer"
                        >
                          <FloppyDisk className="h-3.5 w-3.5" />
                          <span>Salvar e Concluir</span>
                        </Button>
                      )}
                    </div>
                  </div>
                ) : (
                  /* COMPLETE MODE: 5 ACCORDION / COLLAPSIBLE CARDS */
                  <div className="space-y-4">
                    {/* Card 1: Avatar Studio 2.5D */}
                    <Card className="rounded-2xl border-border/70 bg-card/85 backdrop-blur shadow-sm overflow-hidden">
                      <CardHeader
                        onClick={() => toggleCard("avatarStudio")}
                        onKeyDown={(event) => handleCardHeaderKeyDown(event, "avatarStudio")}
                        role="button"
                        tabIndex={0}
                        aria-expanded={!collapsedCards.avatarStudio}
                        aria-controls="avatar-studio-content"
                        className="p-3.5 sm:p-4 border-b border-border/40 bg-muted/10 flex flex-row items-center justify-between gap-2 cursor-pointer hover:bg-muted/20 transition-colors select-none"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="h-8 w-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                            <TShirt className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2 truncate">
                              <span>Avatar Studio<span className="sr-only"> 2.5D</span></span>
                            </CardTitle>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant="outline" className="text-[10px] text-muted-foreground font-mono hidden sm:inline-flex">
                            {activeOutfitItem.title}
                          </Badge>
                          <span aria-hidden="true" className="h-7 w-7 flex items-center justify-center text-muted-foreground">
                            {collapsedCards.avatarStudio ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                          </span>
                        </div>
                      </CardHeader>
                      {!collapsedCards.avatarStudio && (
                        <CardContent id="avatar-studio-content" className="p-4 sm:p-5">
                          {renderAvatarStudioSection()}
                        </CardContent>
                      )}
                    </Card>

                    {/* Card 2: Objetivo & Tom */}
                    <Card className="rounded-2xl border-border/70 bg-card/85 backdrop-blur shadow-sm overflow-hidden">
                      <CardHeader
                        onClick={() => toggleCard("objectiveTone")}
                        onKeyDown={(event) => handleCardHeaderKeyDown(event, "objectiveTone")}
                        role="button"
                        tabIndex={0}
                        aria-expanded={!collapsedCards.objectiveTone}
                        aria-controls="objective-tone-content"
                        className="p-3.5 sm:p-4 border-b border-border/40 bg-muted/10 flex flex-row items-center justify-between gap-2 cursor-pointer hover:bg-muted/20 transition-colors select-none"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="h-8 w-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                            <Target className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2 truncate">
                              <span>2. Objetivo Central & Tom de Atendimento</span>
                              <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-400 bg-emerald-500/10 uppercase">
                                Comportamento
                              </Badge>
                            </CardTitle>
                            <CardDescription className="text-[11px] text-muted-foreground truncate">
                              Foco de conversão, empatia, estilo de resposta e temperatura neural.
                            </CardDescription>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant="outline" className="text-[10px] text-emerald-300 border-emerald-500/40 bg-emerald-500/10 hidden sm:inline-flex">
                            {currentObjectiveDef.title} • {currentToneDef.label}
                          </Badge>
                          <span aria-hidden="true" className="h-7 w-7 flex items-center justify-center text-muted-foreground">
                            {collapsedCards.objectiveTone ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                          </span>
                        </div>
                      </CardHeader>
                      {!collapsedCards.objectiveTone && (
                        <CardContent id="objective-tone-content" className="p-4 sm:p-5">
                          {renderObjectiveToneSection()}
                        </CardContent>
                      )}
                    </Card>

                    {/* Card 4: Provedores & Modelos */}
                    <Card className="rounded-2xl border-border/70 bg-card/85 backdrop-blur shadow-sm overflow-hidden">
                      <CardHeader
                        onClick={() => toggleCard("providers")}
                        onKeyDown={(event) => handleCardHeaderKeyDown(event, "providers")}
                        role="button"
                        tabIndex={0}
                        aria-expanded={!collapsedCards.providers}
                        aria-controls="providers-content"
                        className="p-3.5 sm:p-4 border-b border-border/40 bg-muted/10 flex flex-row items-center justify-between gap-2 cursor-pointer hover:bg-muted/20 transition-colors select-none"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="h-8 w-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                            <Cpu className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2 truncate">
                              <span>4. Provedores de IA & Modelos</span>
                              <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-400 bg-emerald-500/10 uppercase">
                                Infraestrutura
                              </Badge>
                            </CardTitle>
                            <CardDescription className="text-[11px] text-muted-foreground truncate">
                              OpenAI, Groq, Anthropic, Gemini, DeepSeek e chaves de API.
                            </CardDescription>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant="outline" className="text-[10px] text-muted-foreground font-mono hidden sm:inline-flex items-center gap-1.5 py-0.5 px-2">
                            <ProviderLogo providerId={selectedProvider} className="h-3.5 w-3.5 shrink-0" />
                            <span>{currentProviderDef.name} • {selectedModel}</span>
                          </Badge>
                          <span aria-hidden="true" className="h-7 w-7 flex items-center justify-center text-muted-foreground">
                            {collapsedCards.providers ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                          </span>
                        </div>
                      </CardHeader>
                      {!collapsedCards.providers && (
                        <CardContent id="providers-content" className="p-4 sm:p-5">
                          {renderProvidersSection()}
                        </CardContent>
                      )}
                    </Card>

                    {/* Studio Meia Tela: 3. Treinamento & Instruções (Esquerda) + 5. Sandbox & Chat ao Vivo (Direita) */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
                      {/* Card 3: Treinamento & Instruções do Agente */}
                      <Card className="rounded-2xl border-border/70 bg-card/85 backdrop-blur shadow-sm overflow-hidden flex flex-col">
                        <CardHeader
                          onClick={() => toggleCard("prompt")}
                          onKeyDown={(event) => handleCardHeaderKeyDown(event, "prompt")}
                          role="button"
                          tabIndex={0}
                          aria-expanded={!collapsedCards.prompt}
                          aria-controls="agent-prompt-content"
                          className="p-3.5 sm:p-4 border-b border-border/40 bg-muted/10 flex flex-row items-center justify-between gap-2 cursor-pointer hover:bg-muted/20 transition-colors select-none"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="h-8 w-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                              <Sparkle weight="fill" className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                              <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2 truncate">
                                <span>3. Prompt & Treinamento</span>
                                <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-400 bg-emerald-500/10 uppercase">
                                  Instrução
                                </Badge>
                              </CardTitle>
                              <CardDescription className="text-[11px] text-muted-foreground truncate">
                                Envie comandos e instruções que a atendente absorve.
                              </CardDescription>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[10px] font-mono text-muted-foreground hidden sm:inline">
                              {agentPrompt.length} chars
                            </span>
                            <span aria-hidden="true" className="h-7 w-7 flex items-center justify-center text-muted-foreground">
                              {collapsedCards.prompt ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                            </span>
                          </div>
                        </CardHeader>
                        {!collapsedCards.prompt && (
                          <CardContent id="agent-prompt-content" className="p-4 sm:p-5 flex-1 flex flex-col">
                            {renderPromptSection()}
                          </CardContent>
                        )}
                      </Card>

                      {/* Card 5: Sandbox de Atendimento & Chat ao Vivo */}
                      <Card className="rounded-2xl border-border/70 bg-card/85 backdrop-blur shadow-sm overflow-hidden flex flex-col">
                        <CardHeader
                          onClick={() => toggleCard("chatSandbox")}
                          onKeyDown={(event) => handleCardHeaderKeyDown(event, "chatSandbox")}
                          role="button"
                          tabIndex={0}
                          aria-expanded={!collapsedCards.chatSandbox}
                          aria-controls="chat-sandbox-content"
                          className="p-3.5 sm:p-4 border-b border-border/40 bg-muted/10 flex flex-row items-center justify-between gap-2 cursor-pointer hover:bg-muted/20 transition-colors select-none"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="h-8 w-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                              <ChatCircleText weight="bold" className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                              <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2 truncate">
                                <span>5. Sandbox & Chat ao Vivo</span>
                                <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-400 bg-emerald-500/10 uppercase">
                                  Simulação
                                </Badge>
                              </CardTitle>
                              <CardDescription className="text-[11px] text-muted-foreground truncate">
                                Converse e teste respostas com inteligência real.
                              </CardDescription>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge variant="outline" className="text-[10px] text-emerald-400 border-emerald-500/30 bg-emerald-500/10 font-bold uppercase">
                              AO VIVO
                            </Badge>
                            <span aria-hidden="true" className="h-7 w-7 flex items-center justify-center text-muted-foreground">
                              {collapsedCards.chatSandbox ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                            </span>
                          </div>
                        </CardHeader>
                        {!collapsedCards.chatSandbox && (
                          <CardContent id="chat-sandbox-content" className="p-4 sm:p-5 flex-1 flex flex-col">
                            {renderSandboxSection()}
                          </CardContent>
                        )}
                      </Card>
                    </div>
                  </div>
                )}
              </div>
            ) : null}

            {/* Store & WhatsApp Connection Selector */}
            <section className="rounded-2xl border border-border/70 bg-card p-4 space-y-3.5 shadow-xs">
              <div className="flex items-center justify-between gap-2">
                <label className="text-sm font-bold flex items-center gap-2 text-foreground font-display" htmlFor="attendant-whatsapp">
                  <div className="p-1 rounded-lg bg-emerald-500/15 text-emerald-400">
                    <WhatsappLogo weight="fill" className="h-4 w-4" />
                  </div>
                  <span>WhatsApp do atendimento</span>
                </label>
                {(() => {
                  const activeConn = (selectedWhatsApp ? sessions.find(s => (s.sessionId || s.id) === selectedWhatsApp) : sessions[0]) || null;
                  if (!activeConn) return null;
                  const isConn = activeConn.status === "connected" || activeConn.status === "open";
                  return (
                    <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[10px] text-emerald-400 font-medium font-mono">
                      <span className={cn("h-1.5 w-1.5 rounded-full", isConn ? "bg-emerald-400 animate-pulse" : "bg-amber-400")} />
                      <span>{isConn ? "Online" : "Aguardando"}</span>
                    </div>
                  );
                })()}
              </div>

              {/* Active Connection Highlight Card */}
              {(() => {
                const activeConn = (selectedWhatsApp ? sessions.find(s => (s.sessionId || s.id) === selectedWhatsApp) : sessions[0]) || null;
                if (!activeConn) return null;
                const isConn = activeConn.status === "connected" || activeConn.status === "open";
                return (
                  <div className="flex items-center justify-between p-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-9 w-9 rounded-xl bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center shrink-0 text-emerald-400 shadow-xs">
                        <WhatsappLogo weight="fill" className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-foreground truncate">
                            {activeConn.sessionName || activeConn.sessionId || activeConn.id || "main"}
                          </span>
                          <span className={cn("h-2 w-2 rounded-full", isConn ? "bg-emerald-400 animate-pulse ring-2 ring-emerald-500/30" : "bg-amber-400")} />
                        </div>
                        <p className="text-[11px] text-emerald-400 font-mono font-medium truncate mt-0.5">
                          {activeConn.phone || "+55 (31) 9367-2075"}
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[9px] border-emerald-500/40 text-emerald-300 bg-emerald-500/15 shrink-0 font-mono">
                      {isConn ? "WhatsApp Ativo" : "Desconectado"}
                    </Badge>
                  </div>
                );
              })()}

              <select
                id="attendant-whatsapp"
                className="w-full rounded-xl border border-border/80 bg-background/80 p-3 text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none transition-all cursor-pointer"
                value={selectedWhatsApp}
                onChange={event => selectWhatsApp(event.target.value)}
              >
                <option value="">Todos os atendentes</option>
                {sessions.map(session => (
                  <option key={session.sessionId || session.id} value={session.sessionId || session.id}>
                    {session.sessionName || session.sessionId || session.id}{session.phone ? ` · ${session.phone}` : ""}
                  </option>
                ))}
              </select>

              {selectedWhatsApp && (
                <>
                  <label className="block text-sm font-semibold" htmlFor="whatsapp-attendant">Trocar atendente responsável</label>
                  <select
                    id="whatsapp-attendant"
                    className="w-full rounded-xl border border-border bg-background p-3 text-sm"
                    disabled={switchingAttendant}
                    value={filteredAttendants.length === 1 ? filteredAttendants[0].key : ""}
                    onChange={event => void switchAttendant(event.target.value)}
                  >
                    <option value="" disabled>Selecione um atendente</option>
                    {agents.map(agent => (
                      <option key={agent.key} value={agent.key}>
                        {agent.name}{agent.active === false ? " · Pausado" : " · Habilitado"}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground">A troca preserva loja, histórico e memória deste número. As instruções de um atendente usado em vários números são compartilhadas.</p>
                  {filteredAttendants.length > 1 && (
                    <p role="alert" className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
                      Este WhatsApp tem vínculos antigos com mais de um atendente. Escolha acima o único responsável para regularizar o atendimento.
                    </p>
                  )}
                </>
              )}
            </section>
            {!selectedWhatsApp && assignmentConflicts.length > 0 && (
              <section role="alert" className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 space-y-2">
                <p className="text-sm font-semibold text-amber-200">{assignmentConflicts.length} WhatsApp(s) têm mais de um atendente vinculado.</p>
                <p className="text-xs text-muted-foreground">O atendimento pode ficar pausado até cada número ter um único responsável. Escolha um WhatsApp para revisar os vínculos; nada será alterado até você selecionar o responsável.</p>
                <label className="sr-only" htmlFor="resolve-assignment-conflict">Escolher WhatsApp com conflito</label>
                <select id="resolve-assignment-conflict" className="w-full rounded-xl border border-amber-500/30 bg-background p-2.5 text-sm" value="" onChange={event => selectWhatsApp(event.target.value)}>
                  <option value="" disabled>Revisar conflito de um WhatsApp…</option>
                  {assignmentConflicts.map(({ sessionId, session, responsible }) => (
                    <option key={sessionId} value={sessionId}>{session.sessionName || session.name || sessionId} · {responsible.map(agent => agent.name).join(", ")}</option>
                  ))}
                </select>
              </section>
            )}
            {selectedWhatsApp && <details open={commercialOpen} onToggle={event => setCommercialOpen(event.currentTarget.open)} className="rounded-2xl border border-border bg-card p-4">
              <summary className="cursor-pointer text-sm font-semibold">Loja e dados comerciais deste WhatsApp</summary>
              <React.Suspense fallback={<p className="py-4 text-sm text-muted-foreground">Carregando dados comerciais…</p>}>
                <CommercialPanel key={selectedWhatsApp} requestedMode="store" initialSessionId={selectedWhatsApp} onCommercialSaved={fetchData} lockSession />
              </React.Suspense>
            </details>}
            {!selectedWhatsApp && searchParams.get("section") === "business" && <p className="text-sm text-muted-foreground">Selecione o WhatsApp acima para configurar a loja e os dados comerciais.</p>}
          </>
        )}
      </main>

      {/* ================= MODAL: VINCULAR NÚMERO WHATSAPP ================= */}
      <Dialog open={reassignModalOpen} onOpenChange={setReassignModalOpen}>
        <DialogContent className="max-w-md border-border/80 bg-card/95 backdrop-blur-xl">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="h-11 w-11 rounded-xl bg-black/40 border border-emerald-500/40 overflow-hidden flex items-center justify-center shrink-0">
                <img
                  src={`/assets/avatar_factory/catalog/${reassignAgent?.avatarConfig?.catalogSpriteId || (reassignAgent?.name?.toLowerCase().includes("carlos") || reassignAgent?.character?.gender === "male" ? "sprite_r1_c1" : "sprite_r2_c1")}_clean.png`}
                  alt={reassignAgent?.name || "Atendente"}
                  className="h-full w-full object-contain"
                  style={{ imageRendering: "pixelated" }}
                />
              </div>
              <div className="min-w-0">
                <DialogTitle className="font-display text-base truncate">
                  Vincular WhatsApp a {reassignAgent?.name}
                </DialogTitle>
                <DialogDescription className="text-xs">
                  1 Número = 1 Atendente Principal.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Selecione o Número / Conexão</Label>
              <div className="space-y-2 max-h-56 overflow-y-auto">
                <button
                  type="button"
                  onClick={() => setSelectedSessionForReassign("")}
                  className={cn(
                    "w-full text-left p-3 rounded-xl border text-xs transition-all",
                    selectedSessionForReassign === ""
                      ? "bg-card border-emerald-500/50 text-foreground ring-1 ring-emerald-500/30"
                      : "bg-background/40 border-border/50 text-muted-foreground hover:bg-card"
                  )}
                >
                  <p className="font-semibold text-foreground">Nenhum número (Deixar em espera)</p>
                  <p className="text-[11px] text-muted-foreground">Remove os vínculos com WhatsApp. Vincule um número antes de ativar o atendimento.</p>
                </button>

                {sessions.map((sess) => {
                  const id = sess.sessionId || sess.id;
                  const isSelected = selectedSessionForReassign === id;
                  const isConnected = sess.status === "connected" || sess.connected;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setSelectedSessionForReassign(id)}
                      className={cn(
                        "w-full text-left p-3 rounded-xl border text-xs transition-all flex items-center justify-between gap-3",
                        isSelected
                          ? "bg-card border-emerald-500/50 text-foreground ring-1 ring-emerald-500/30"
                          : "bg-background/40 border-border/50 text-muted-foreground hover:bg-card"
                      )}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <WhatsappLogo weight="fill" className="h-3.5 w-3.5 text-emerald-400" />
                          <p className="font-semibold text-foreground truncate">{sess.sessionName || sess.name || id}</p>
                        </div>
                        <p className="text-[11px] text-muted-foreground font-mono">{sess.phone || id}</p>
                      </div>

                      <Badge variant="outline" className={cn("text-[9px] uppercase font-bold", isConnected ? "text-emerald-400 border-emerald-500/30" : "text-muted-foreground")}>
                        {isConnected ? "Conectado" : "Offline"}
                      </Badge>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setReassignModalOpen(false)} className="rounded-xl">
              Cancelar
            </Button>
            <Button
              onClick={handleSaveReassign}
              disabled={isReassigning}
              className="rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white"
            >
              {isReassigning ? "Salvando..." : "Salvar Vínculo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ================= MODAL: RECARGA DE SALDO PROVEDOR ZAI ================= */}
      <Dialog open={rechargeModalOpen} onOpenChange={setRechargeModalOpen}>
        <DialogContent className="max-w-md bg-card border-border/80 text-foreground p-5 rounded-2xl">
          <DialogHeader className="space-y-1.5">
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Zap className="h-5 w-5 text-emerald-400" />
              <span>Adicionar Saldo — Provedor ZAI</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Sua conta comum possui 50 mensagens gratuitas por dia. Adicione créditos para continuar respondendo após a cota diária.
            </DialogDescription>
          </DialogHeader>

          <div className="py-3 space-y-3">
            <div className="p-3 rounded-xl border border-border/60 bg-background/50 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Status de Uso Hoje:</span>
              <span className="font-bold text-foreground">
                {zaiUsage?.countToday || 0}/{zaiUsage?.limitToday || 50} gratuitas utilizadas
              </span>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Selecione o Pacote de Recarga:</Label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { amount: 10, label: "R$ 10", desc: "+200 respostas" },
                  { amount: 25, label: "R$ 25", desc: "+550 respostas", popular: true },
                  { amount: 50, label: "R$ 50", desc: "+1200 respostas" },
                ].map((pkg) => (
                  <button
                    key={pkg.amount}
                    type="button"
                    onClick={async () => {
                      setIsRechargingZai(true);
                      try {
                        const res = await apiService.rechargeZaiUsage(pkg.amount);
                        if (res?.data) setZaiUsage(res.data);
                        notify.success(`Recarga de ${pkg.label} efetuada com sucesso!`);
                        setRechargeModalOpen(false);
                      } catch (err: any) {
                        notify.error(err?.message || "Erro ao recarregar saldo.");
                      } finally {
                        setIsRechargingZai(false);
                      }
                    }}
                    disabled={isRechargingZai}
                    className={cn(
                      "p-3 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1",
                      pkg.popular
                        ? "border-emerald-500 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300"
                        : "border-border/60 bg-card/70 hover:bg-muted/30 text-foreground"
                    )}
                  >
                    <span className="text-sm font-bold">{pkg.label}</span>
                    <span className="text-[10px] text-muted-foreground">{pkg.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="flex items-center justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setRechargeModalOpen(false)}
              className="text-xs rounded-xl"
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ================= MODAL: CUSTOMIZER ================= */}
      {customizerAgent && (
        <AgentCustomizerModal
          open={Boolean(customizerAgent)}
          onOpenChange={(isOpen) => {
            if (!isOpen) {
              setCustomizerAgent(null);
            }
          }}
          agent={customizerAgent}
          onSave={async (updated) => {
            const result = await apiService.updateAIAgent(customizerAgent.key, updated);
            if (result.success === false) throw new Error("Não foi possível salvar o atendente.");
            setCustomizerAgent(null);
            await fetchData();
          }}
        />
      )}

      {/* ================= MODAL: PROFILE ================= */}
      {profileAgent && (
        <AgentProfileModal
          open={Boolean(profileAgent)}
          onOpenChange={(isOpen) => {
            if (!isOpen) setProfileAgent(null);
          }}
          agent={profileAgent}
          onUpdated={fetchData}
        />
      )}

      {/* ================= MODAL: NOVO ATENDENTE COM HERANÇA ================= */}
      {isWizardOpen && (
        <NewAgentWizardModal
          isOpen={isWizardOpen}
          onClose={() => {
            setIsWizardOpen(false);
            fetchData();
          }}
          onSuccess={() => {
            setIsWizardOpen(false);
            fetchData();
          }}
        />
      )}

      {/* ================= MODAL: ZAI AVATAR STUDIO MODULAR ================= */}
      {avatarEditorAgent && (
        <AvatarEditorModal
          open={Boolean(avatarEditorAgent)}
          onOpenChange={(isOpen) => {
            if (!isOpen) setAvatarEditorAgent(null);
          }}
          agent={avatarEditorAgent}
          store={getAssignedStore(avatarEditorAgent)}
          runtimeState={getPresence(avatarEditorAgent).state}
          onSave={(updatedAvatar) => {
            const spriteId = updatedAvatar.catalogSpriteId || resolveSpriteForAvatar(updatedAvatar, true);
            const avatarUrl = `/assets/avatar_factory/catalog/${spriteId}_clean.png`;
            const fullConfig = { ...updatedAvatar, catalogSpriteId: spriteId };
            setAgents((prev) =>
              prev.map((a) =>
                a.key === avatarEditorAgent.key
                  ? { ...a, avatarConfig: fullConfig, avatar: avatarUrl }
                  : a
              )
            );
            if (previewAgent?.key === avatarEditorAgent.key) {
              setPreviewAgent((prev: any) => ({
                ...prev,
                avatarConfig: fullConfig,
                avatar: avatarUrl,
              }));
            }
            fetchData();
          }}
        />
      )}
    </div>
  );
}

