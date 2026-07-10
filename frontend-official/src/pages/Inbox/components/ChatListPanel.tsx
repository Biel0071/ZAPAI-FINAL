import { Check, ChatCircleDots, Star, CaretRight, Plus, Trash } from "@phosphor-icons/react";
import { List } from "react-window";
import { ChatSearchBar } from "@/components/inbox/ChatSearchBar";
import { OperationalStatusBadge } from "@/components/enterprise/OperationalStatusBadge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { Conversation, SessionInfo } from "@/services/apiService";
import { ConversationRow } from "./ConversationRow";
import { isSessionActive } from "../utils";

interface ChatListPanelProps {
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  isMultiSelectMode: boolean;
  setIsMultiSelectMode: (updater: boolean | ((prev: boolean) => boolean)) => void;
  selectedChatIds: string[];
  setSelectedChatIds: (ids: string[]) => void;
  filter: string;
  setFilter: (val: string) => void;
  filteredConversations: Conversation[];
  conversationsLoadFailed: boolean;
  loadingConversations: boolean;
  handleRetryConversations: () => Promise<void>;
  conversationListHeight: number;
  conversationRowData: any;
  activeSession: SessionInfo | null;
  navigate: (path: string) => void;
  handleBulkPin: () => void;
  handleBulkArchive: () => void;
  handleBulkAddTag: (tag: string) => Promise<void>;
  handleBulkDelete: () => Promise<void>;
  handleBulkExportContacts: () => void;
  handleBulkLoadCampaign: () => Promise<void>;
  isMobile: boolean;
  mobileScreen: string;
  showGroups?: boolean;
  setShowGroups?: (val: boolean) => void;
}

const BUSINESS_TAG_OPTIONS = ["Novo Lead", "Cliente", "Orçamento", "Venda", "Suporte", "VIP", "Urgente"] as const;
const CONVERSATION_ROW_HEIGHT = 66;

export function ChatListPanel({
  searchQuery,
  setSearchQuery,
  isMultiSelectMode,
  setIsMultiSelectMode,
  selectedChatIds,
  setSelectedChatIds,
  filter,
  setFilter,
  filteredConversations,
  conversationsLoadFailed,
  loadingConversations,
  handleRetryConversations,
  conversationListHeight,
  conversationRowData,
  activeSession,
  navigate,
  handleBulkPin,
  handleBulkArchive,
  handleBulkAddTag,
  handleBulkDelete,
  handleBulkExportContacts,
  handleBulkLoadCampaign,
  isMobile,
  mobileScreen,
  showGroups = false,
  setShowGroups,
}: ChatListPanelProps) {
  return (
    <div className={cn("flex min-h-0 flex-col border-r border-border bg-card/50 lg:overflow-auto h-full", isMobile && mobileScreen !== "conversations" && "hidden")}>
      <div className="space-y-2 border-b border-border p-3">
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <ChatSearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Buscar conversas..."
            />
          </div>
          <Button
            type="button"
            variant={isMultiSelectMode ? "secondary" : "outline"}
            size="icon"
            onClick={() => {
              setIsMultiSelectMode((prev) => !prev);
              setSelectedChatIds([]);
            }}
            className={cn(
              "h-9 w-9 shrink-0 rounded-lg",
              isMultiSelectMode && "bg-primary/20 hover:bg-primary/30 text-primary border-primary/30"
            )}
            title={isMultiSelectMode ? "Desativar seleção em massa" : "Ativar seleção em massa"}
          >
            <Check className="h-4 w-4" weight={isMultiSelectMode ? "bold" : "regular"} />
          </Button>
        </div>
        <Tabs value={filter} onValueChange={setFilter}>
          <TabsList className="w-full">
            <TabsTrigger value="all" className="flex-1">Todas</TabsTrigger>
            <TabsTrigger value="unread" className="flex-1">Não lidas</TabsTrigger>
            <TabsTrigger value="ai" className="flex-1">IA ativa</TabsTrigger>
            <TabsTrigger value="archived" className="flex-1">Arquivadas</TabsTrigger>
          </TabsList>
        </Tabs>
        {setShowGroups && (
          <div className="flex items-center justify-between px-2.5 py-2 bg-muted/10 rounded-xl border border-border/40 text-xs animate-fade-in">
            <span className="font-medium text-muted-foreground/80">Exibir Grupos</span>
            <button
              type="button"
              onClick={() => setShowGroups(!showGroups)}
              className={cn(
                "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                showGroups ? "bg-primary" : "bg-muted"
              )}
              title={showGroups ? "Ocultar grupos" : "Exibir grupos"}
            >
              <span
                className={cn(
                  "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                  showGroups ? "translate-x-4" : "translate-x-0"
                )}
              />
            </button>
          </div>
        )}
        {isMultiSelectMode && (
          <div className="flex items-center justify-between px-2 py-1.5 text-xs text-muted-foreground border-b border-border/40 animate-fade-in bg-muted/10 rounded-md">
            <span>{selectedChatIds.length} selecionadas</span>
            <div className="flex gap-2">
              <button
                type="button"
                className="hover:text-foreground transition-colors font-medium"
                onClick={() => {
                  setSelectedChatIds(filteredConversations.map((c) => c.id));
                }}
              >
                Selecionar todas
              </button>
              <span className="text-muted-foreground/30">|</span>
              <button
                type="button"
                className="hover:text-foreground transition-colors font-medium text-destructive"
                onClick={() => {
                  setSelectedChatIds([]);
                }}
              >
                Limpar
              </button>
            </div>
          </div>
        )}
        <div className="flex items-center justify-between gap-3">
          <div
            onClick={() => {
              if (activeSession && isSessionActive(activeSession)) {
                navigate("/dashboard");
              } else {
                navigate("/connections");
              }
            }}
            className="cursor-pointer transition-transform hover:scale-[1.03] active:scale-[0.98]"
          >
            <OperationalStatusBadge
              label={activeSession && isSessionActive(activeSession) ? "Sessão ON" : "Sessão OFF"}
              tone={activeSession && isSessionActive(activeSession) ? "online" : "warning"}
              pulse={Boolean(activeSession && isSessionActive(activeSession))}
            />
          </div>
          <Button
            type="button"
            variant={activeSession && isSessionActive(activeSession) ? "secondary" : "outline"}
            onClick={() => {
              if (activeSession && isSessionActive(activeSession)) {
                navigate("/dashboard");
              } else {
                navigate("/connections");
              }
            }}
          >
            {activeSession && isSessionActive(activeSession) ? "Métricas Dashboard" : "Conectar Sessão"}
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden p-2">
        {conversationsLoadFailed && filteredConversations.length > 0 && (
          <div className="mb-2 rounded-lg border border-border bg-card p-3 text-center">
            <p className="text-sm text-muted-foreground">Falha temporária ao atualizar conversas. Mantendo os últimos dados em tela.</p>
            <Button type="button" variant="outline" size="sm" className="mt-3" onClick={handleRetryConversations}>
              Tentar novamente
            </Button>
          </div>
        )}

        {loadingConversations ? (
          <div className="space-y-3 p-2">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-11 w-11 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-2/3" />
                  <Skeleton className="h-3 w-5/6" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredConversations.length === 0 ? (
          conversationsLoadFailed ? (
            <div className="rounded-lg border border-border bg-card p-4 text-center">
              <p className="text-sm text-muted-foreground">Falha ao carregar conversas. O backend está online, mas o banco local pode estar indisponível.</p>
              <Button type="button" variant="outline" size="sm" className="mt-3" onClick={handleRetryConversations}>
                Tentar novamente
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 gap-3 animate-fade-in">
              <div className="rounded-2xl bg-muted/30 p-4 ring-1 ring-border/40">
                <ChatCircleDots className="h-8 w-8 text-muted-foreground/40" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-foreground">Nenhuma conversa encontrada</p>
                <p className="mt-1 text-xs text-muted-foreground/70">Tente ajustar os filtros ou aguarde novas mensagens.</p>
              </div>
            </div>
          )
        ) : (
          <List
            rowComponent={ConversationRow}
            rowCount={filteredConversations.length}
            rowHeight={CONVERSATION_ROW_HEIGHT}
            rowProps={conversationRowData}
            style={{ height: conversationListHeight, width: "100%" }}
          />
        )}
      </div>

      {isMultiSelectMode && selectedChatIds.length > 0 && (
        <div className="border-t border-border bg-popover/80 backdrop-blur p-3 space-y-2 shrink-0 animate-slide-up shadow-lg">
          <p className="text-xs font-semibold text-foreground">{selectedChatIds.length} selecionadas</p>
          <div className="grid grid-cols-2 gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs justify-start gap-1.5"
              onClick={handleBulkPin}
            >
              <Star className="h-3.5 w-3.5" />
              Fixar/Desfixar
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs justify-start gap-1.5"
              onClick={handleBulkArchive}
            >
              <CaretRight className="h-3.5 w-3.5" />
              Arquivar/Des.
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs justify-start gap-1.5"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Etiquetar
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-44">
                {BUSINESS_TAG_OPTIONS.map((tag) => (
                  <DropdownMenuItem
                    key={tag}
                    onClick={() => handleBulkAddTag(tag)}
                    className="text-xs cursor-pointer"
                  >
                    Adicionar {tag}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs justify-start gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={handleBulkDelete}
            >
              <Trash className="h-3.5 w-3.5" />
              Excluir
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-1.5 border-t border-border/40 pt-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-8 text-xs w-full gap-1.5"
              onClick={handleBulkExportContacts}
            >
              Exportar Contatos
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-8 text-xs w-full gap-1.5"
              onClick={handleBulkLoadCampaign}
            >
              Carregar Disparos
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
