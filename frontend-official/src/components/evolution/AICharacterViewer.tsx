import React, { useState, useRef, useEffect, useCallback } from "react";
import { Eye, Shirt, Headphones, Image as ImageIcon, Sparkles, RotateCcw } from "lucide-react";

interface AICharacterViewerProps {
  agentName?: string;
  agentRole?: string;
  isOnline: boolean;
  onToggleOnline?: (online: boolean) => void;
  avatarUrl?: string;
}

export const AICharacterViewer: React.FC<AICharacterViewerProps> = ({
  agentName = "Camila",
  agentRole = "Assistente de Vendas",
  isOnline,
  onToggleOnline,
  avatarUrl = "/assets/evolution/camila_avatar.png"
}) => {
  const [activeTab, setActiveTab] = useState<"visual" | "roupas" | "acessorios" | "cenario" | "animacoes">("visual");
  
  // 3D Isometric Transform States
  const [rotation, setRotation] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Mouse Handlers for 3D Drag & Rotate
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    dragStart.current = { x: e.clientX, y: e.clientY };

    setRotation((prev) => ({
      x: Math.max(-25, Math.min(25, prev.x - dy * 0.3)),
      y: Math.max(-45, Math.min(45, prev.y + dx * 0.4)),
    }));
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  // Wheel Zoom Handler
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.05 : 0.05;
    setZoom((prev) => Math.max(0.8, Math.min(1.35, prev + delta)));
  };

  // Reset Camera on Double Click
  const handleDoubleClick = () => {
    setRotation({ x: 0, y: 0 });
    setZoom(1);
  };

  return (
    <article className={`zai-card zai-character-card ${!isOnline ? "is-offline" : ""}`}>
      <div
        className="zai-character-stage"
        ref={containerRef}
        onWheel={handleWheel}
        onDoubleClick={handleDoubleClick}
      >
        {/* CHARACTER STATUS OVERLAY */}
        <div className="zai-character-status">
          <div className="zai-character-status-avatar">
            <img
              src={avatarUrl}
              alt={agentName}
              onError={(e) => {
                // Fallback pixel avatar
                (e.target as HTMLElement).style.display = "none";
              }}
            />
          </div>
          <div>
            <div className="zai-character-status-name">{agentName}</div>
            <div className="zai-character-status-role">{agentRole}</div>
            <div className={isOnline ? "zai-status-active" : "zai-status-offline"}>
              {isOnline ? "Ativa · Atendendo" : "Desativada"}
            </div>
          </div>
        </div>

        {/* OFFLINE / ONLINE TOGGLE */}
        <button
          type="button"
          onClick={() => onToggleOnline?.(!isOnline)}
          className={`zai-offline-toggle ${!isOnline ? "active" : ""}`}
          title="Alternar estado de atendimento da assistente"
        >
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: isOnline ? "var(--zai-green)" : "#596574" }}
          />
          <span>{isOnline ? "Online" : "Offline"}</span>
        </button>

        {/* 3D CHARACTER VIEWER STAGE */}
        <div className="zai-character-viewer">
          <div
            className="zai-character-3d"
            onMouseDown={handleMouseDown}
            style={{
              transform: `scale(${zoom}) rotateX(${rotation.x}deg) rotateY(${rotation.y}deg)`,
              transformStyle: "preserve-3d",
            }}
          >
            {isOnline ? (
              /* ESTADO ATIVO: Camila sentada à mesa no escritório pixel-art com PC e monitores ZAI */
              <div className="relative flex items-center justify-center w-full h-full p-4 select-none">
                <img
                  src="/assets/evolution/camila_office_active.png"
                  alt="Camila Atendendo no Escritório ZAI"
                  className="zai-character-art"
                  draggable={false}
                />
              </div>
            ) : (
              /* ESTADO DESATIVADO: Camila em pé na plataforma isométrica com braços relaxados */
              <div className="relative flex flex-col items-center justify-center w-full h-full p-4 select-none">
                <img
                  src="/assets/evolution/camila_standing_offline.png"
                  alt="Camila em Espera (Offline)"
                  className="zai-character-art h-[75%] object-contain"
                  draggable={false}
                />
                <div className="zai-character-platform" />
                <p className="text-[11px] text-muted-foreground/80 mt-2 font-medium">
                  Quando desativada, fica em pé.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* STATUS PILL (BOTTOM CENTER) */}
        <div className="zai-status-pill-bottom">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>{isOnline ? "Atendendo agora..." : "Em espera"}</span>
        </div>

        {/* CHARACTER CONTROLS (VERTICAL LEFT) */}
        <div className="zai-character-controls">
          <button
            type="button"
            onClick={() => setActiveTab("visual")}
            className={`zai-character-control ${activeTab === "visual" ? "active" : ""}`}
            title="Visual da Personagem"
          >
            <Eye className="w-4 h-4" />
            <span>Visual</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("roupas")}
            className={`zai-character-control ${activeTab === "roupas" ? "active" : ""}`}
            title="Roupas e Estilo ZAI"
          >
            <Shirt className="w-4 h-4" />
            <span>Roupas</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("acessorios")}
            className={`zai-character-control ${activeTab === "acessorios" ? "active" : ""}`}
            title="Acessórios e Headset"
          >
            <Headphones className="w-4 h-4" />
            <span>Acessórios</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("cenario")}
            className={`zai-character-control ${activeTab === "cenario" ? "active" : ""}`}
            title="Cenário do Escritório"
          >
            <ImageIcon className="w-4 h-4" />
            <span>Cenário</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("animacoes")}
            className={`zai-character-control ${activeTab === "animacoes" ? "active" : ""}`}
            title="Animações Comportamentais"
          >
            <Sparkles className="w-4 h-4" />
            <span>Animações</span>
          </button>
        </div>

        {/* RESET CAMERA & DRAG HINT PILL */}
        <div className="zai-character-hint flex items-center gap-2">
          <span>🖱 Arraste para girar · Scroll para zoom</span>
          {(rotation.x !== 0 || rotation.y !== 0 || zoom !== 1) && (
            <button
              type="button"
              onClick={handleDoubleClick}
              className="ml-1 p-0.5 hover:text-emerald-400 transition-colors"
              title="Resetar Câmera"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    </article>
  );
};
