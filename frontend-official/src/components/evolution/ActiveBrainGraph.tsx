import React, { useState, useRef, useMemo, useEffect } from "react";
import { ZaiAvatarRenderer } from "@/components/avatar-engine/ZaiAvatarRenderer";
import { MemoryNodeData } from "./MemoryDetailDrawer";
import { cn } from "@/core/lib/utils";
import { Plus, Minus, RotateCcw } from "lucide-react";

export interface ActiveBrainGraphProps {
  attendantName: string;
  avatarConfig?: any;
  memories: MemoryNodeData[];
  selectedCategory: string;
  selectedMemoryId: string | number | null;
  onSelectMemory: (memory: MemoryNodeData) => void;
  width?: number;
  height?: number;
}

interface GraphCategoryBranch {
  id: string;
  label: string;
  color: string;
  angle: number; // in radians
  distance: number;
}

export const ActiveBrainGraph: React.FC<ActiveBrainGraphProps> = ({
  attendantName,
  avatarConfig,
  memories,
  selectedCategory,
  selectedMemoryId,
  onSelectMemory,
  height = 540,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hoveredNodeId, setHoveredNodeId] = useState<string | number | null>(null);

  // SVG dimensions
  const [viewBoxSize, setViewBoxSize] = useState({ width: 900, height: 600 });

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const w = containerRef.current.offsetWidth || 900;
        const h = containerRef.current.offsetHeight || height || 600;
        setViewBoxSize({ width: w, height: h });
      }
    };
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, [height]);

  const centerX = viewBoxSize.width / 2;
  const centerY = viewBoxSize.height / 2;

  // Primary Category Branches
  const categoryBranches: GraphCategoryBranch[] = useMemo(
    () => [
      { id: "client", label: "Clientes", color: "#06b6d4", angle: (0 * Math.PI) / 3, distance: 160 },
      { id: "topic", label: "Tópicos & Regras", color: "#10b981", angle: (1 * Math.PI) / 3, distance: 160 },
      { id: "payment", label: "Pagamentos & PIX", color: "#f59e0b", angle: (2 * Math.PI) / 3, distance: 160 },
      { id: "delivery", label: "Entrega & Frete", color: "#f43f5e", angle: (3 * Math.PI) / 3, distance: 160 },
      { id: "product", label: "Produtos", color: "#3b82f6", angle: (4 * Math.PI) / 3, distance: 160 },
      { id: "objection", label: "Objeções", color: "#8b5cf6", angle: (5 * Math.PI) / 3, distance: 160 },
    ],
    []
  );

  // Filter memories if a category is selected
  const activeMemories = useMemo(() => {
    if (!selectedCategory || selectedCategory === "todos") return memories;
    return memories.filter((m) => {
      const type = m.type || m.category || "topic";
      return type === selectedCategory;
    });
  }, [memories, selectedCategory]);

  // Compute positions for leaf memory nodes around their corresponding category branch
  const positionedNodes = useMemo(() => {
    const result: Array<{
      memory: MemoryNodeData;
      x: number;
      y: number;
      branchX: number;
      branchY: number;
      branchColor: string;
      isSelected: boolean;
    }> = [];

    // Group active memories by category
    const byCategory: Record<string, MemoryNodeData[]> = {};
    categoryBranches.forEach((b) => {
      byCategory[b.id] = [];
    });

    activeMemories.forEach((mem) => {
      const cat = mem.type || mem.category || "topic";
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(mem);
    });

    categoryBranches.forEach((branch) => {
      const branchX = centerX + Math.cos(branch.angle) * branch.distance;
      const branchY = centerY + Math.sin(branch.angle) * branch.distance;
      const memList = byCategory[branch.id] || [];

      memList.forEach((mem, index) => {
        // Distribute leaf nodes radially around the branch
        const leafAngle = branch.angle - 0.4 + (index * 0.8) / Math.max(1, memList.length - 1);
        const leafDist = branch.distance + 85 + (index % 2) * 35;
        const x = centerX + Math.cos(leafAngle) * leafDist;
        const y = centerY + Math.sin(leafAngle) * leafDist;

        result.push({
          memory: mem,
          x,
          y,
          branchX,
          branchY,
          branchColor: branch.color,
          isSelected: String(mem.id) === String(selectedMemoryId),
        });
      });
    });

    return result;
  }, [activeMemories, categoryBranches, centerX, centerY, selectedMemoryId]);

  // Pan / Drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).tagName.toLowerCase() === "button") return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleReset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      className={cn(
        "relative w-full rounded-2xl border border-border/80 bg-[#060a0f] overflow-hidden select-none shadow-inner",
        isDragging ? "cursor-grabbing" : "cursor-grab"
      )}
      style={{ height: `${height}px` }}
    >
      {/* Floating Toolbar (Zoom +, Zoom -, Enquadrar, Legend) */}
      <div className="absolute top-3 right-3 z-20 flex items-center gap-1.5 p-1 rounded-xl bg-card/90 backdrop-blur-md border border-border/80 shadow-md">
        <button
          type="button"
          onClick={() => setZoom((z) => Math.min(2.2, z + 0.15))}
          className="h-7 w-7 rounded-lg hover:bg-muted/70 text-foreground flex items-center justify-center transition-colors text-xs font-bold"
          title="Aumentar Zoom"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => setZoom((z) => Math.max(0.6, z - 0.15))}
          className="h-7 w-7 rounded-lg hover:bg-muted/70 text-foreground flex items-center justify-center transition-colors text-xs font-bold"
          title="Diminuir Zoom"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={handleReset}
          className="h-7 px-2.5 rounded-lg hover:bg-muted/70 text-purple-400 hover:text-purple-300 flex items-center gap-1 transition-colors text-[11px] font-semibold"
          title="Centralizar e Enquadrar"
        >
          <RotateCcw className="h-3 w-3" />
          <span>Enquadrar</span>
        </button>
      </div>

      {/* Top Left Badge: Cérebro Ativo Legend */}
      <div className="absolute top-3 left-3 z-20 flex items-center gap-2 p-1.5 px-3 rounded-xl bg-card/85 backdrop-blur-md border border-border/70 text-xs">
        <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
        <span className="font-bold text-foreground font-mono text-[11px]">
          CÉREBRO ATIVO
        </span>
        <span className="text-muted-foreground/60">•</span>
        <span className="text-[10px] text-muted-foreground">
          {memories.length} memórias ativas
        </span>
      </div>

      {/* Bottom Connection Intensity Indicator */}
      <div className="absolute bottom-3 left-3 z-20 hidden sm:flex items-center gap-3 p-1.5 px-3 rounded-xl bg-card/80 backdrop-blur-md border border-border/60 text-[10px] text-muted-foreground">
        <span className="font-bold text-foreground">Intensidade:</span>
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-4 rounded-full bg-emerald-400" /> Forte
        </span>
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-4 rounded-full bg-purple-400" /> Média
        </span>
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-4 rounded-full bg-slate-500" /> Fraca
        </span>
      </div>

      {/* SVG Canvas */}
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${viewBoxSize.width} ${viewBoxSize.height}`}
        className="w-full h-full pointer-events-auto"
      >
        <defs>
          {/* Background grid pattern */}
          <pattern id="brain-grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#101924" strokeWidth="0.8" />
          </pattern>
          {/* Radial glow around center */}
          <radialGradient id="centerGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
            <stop offset="60%" stopColor="#8b5cf6" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#05070a" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Grid Background */}
        <rect width="100%" height="100%" fill="url(#brain-grid)" />

        {/* Transformed Group (Zoom & Pan) */}
        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`} transform-origin={`${centerX} ${centerY}`}>
          {/* Large subtle aura */}
          <circle cx={centerX} cy={centerY} r={280} fill="url(#centerGlow)" />

          {/* Lines from Center to Primary Category Branches */}
          {categoryBranches.map((branch) => {
            const bx = centerX + Math.cos(branch.angle) * branch.distance;
            const by = centerY + Math.sin(branch.angle) * branch.distance;
            return (
              <g key={`branch-line-${branch.id}`}>
                <line
                  x1={centerX}
                  y1={centerY}
                  x2={bx}
                  y2={by}
                  stroke={branch.color}
                  strokeWidth="2.5"
                  strokeOpacity="0.45"
                  strokeDasharray="4 4"
                />
              </g>
            );
          })}

          {/* Lines from Category Branches to Leaf Memories */}
          {positionedNodes.map((item, idx) => {
            return (
              <line
                key={`leaf-line-${idx}`}
                x1={item.branchX}
                y1={item.branchY}
                x2={item.x}
                y2={item.y}
                stroke={item.branchColor}
                strokeWidth={item.isSelected ? "2.5" : "1.2"}
                strokeOpacity={item.isSelected ? "0.9" : "0.35"}
              />
            );
          })}

          {/* Primary Category Branch Nodes */}
          {categoryBranches.map((branch) => {
            const bx = centerX + Math.cos(branch.angle) * branch.distance;
            const by = centerY + Math.sin(branch.angle) * branch.distance;
            const count = memories.filter((m) => (m.type || m.category || "topic") === branch.id).length;

            return (
              <g key={`branch-node-${branch.id}`} className="cursor-pointer">
                {/* Glow ring */}
                <circle cx={bx} cy={by} r={24} fill="#0d141e" stroke={branch.color} strokeWidth="2" />
                <circle cx={bx} cy={by} r={8} fill={branch.color} fillOpacity="0.9" />

                {/* Branch Label */}
                <text
                  x={bx}
                  y={by + 36}
                  textAnchor="middle"
                  fill="#e2e8f0"
                  fontSize="11"
                  fontWeight="bold"
                  className="pointer-events-none drop-shadow"
                >
                  {branch.label}
                </text>
                <text
                  x={bx}
                  y={by + 48}
                  textAnchor="middle"
                  fill="#94a3b8"
                  fontSize="9"
                  fontFamily="monospace"
                  className="pointer-events-none"
                >
                  {count} itens
                </text>
              </g>
            );
          })}

          {/* Leaf Memory Nodes */}
          {positionedNodes.map((item) => {
            const isHovered = hoveredNodeId === item.memory.id;
            return (
              <g
                key={`leaf-${item.memory.id}`}
                onClick={() => onSelectMemory(item.memory)}
                onMouseEnter={() => setHoveredNodeId(item.memory.id)}
                onMouseLeave={() => setHoveredNodeId(null)}
                className="cursor-pointer group"
              >
                {/* Pulse ring if selected */}
                {item.isSelected && (
                  <circle
                    cx={item.x}
                    cy={item.y}
                    r={18}
                    fill="none"
                    stroke={item.branchColor}
                    strokeWidth="2"
                    strokeDasharray="3 3"
                    className="animate-spin"
                    style={{ transformOrigin: `${item.x}px ${item.y}px`, animationDuration: "8s" }}
                  />
                )}

                {/* Node body */}
                <circle
                  cx={item.x}
                  cy={item.y}
                  r={item.isSelected ? 11 : isHovered ? 9 : 7}
                  fill={item.isSelected ? item.branchColor : "#0d141e"}
                  stroke={item.branchColor}
                  strokeWidth={item.isSelected ? "2.5" : "1.8"}
                  className="transition-all duration-150"
                />

                {/* Label text */}
                <text
                  x={item.x}
                  y={item.y + 16}
                  textAnchor="middle"
                  fill={item.isSelected ? "#ffffff" : isHovered ? "#38bdf8" : "#cbd5e1"}
                  fontSize={item.isSelected ? "10" : "8.5"}
                  fontWeight={item.isSelected ? "bold" : "normal"}
                  className="pointer-events-none select-none drop-shadow"
                >
                  {item.memory.label?.length > 18
                    ? `${item.memory.label.slice(0, 16)}...`
                    : item.memory.label}
                </text>
              </g>
            );
          })}

          {/* CENTRAL NODE: Attendant with pulsing ring */}
          <g className="cursor-pointer select-none">
            {/* Pulsing Outer Rings */}
            <circle
              cx={centerX}
              cy={centerY}
              r={52}
              fill="none"
              stroke="#10b981"
              strokeWidth="2"
              strokeOpacity="0.4"
              className="animate-brain-pulse"
              style={{ transformOrigin: `${centerX}px ${centerY}px` }}
            />
            <circle
              cx={centerX}
              cy={centerY}
              r={44}
              fill="#060a0f"
              stroke="#10b981"
              strokeWidth="3"
            />

            {/* Avatar inside Center Circle */}
            <foreignObject
              x={centerX - 36}
              y={centerY - 36}
              width={72}
              height={72}
              className="pointer-events-none rounded-full overflow-hidden"
            >
              <div className="w-full h-full flex items-center justify-center bg-card scale-90">
                <ZaiAvatarRenderer
                  avatar={avatarConfig || {}}
                  state="WORKING"
                  size="sm"
                />
              </div>
            </foreignObject>

            {/* Label below Central Node */}
            <text
              x={centerX}
              y={centerY + 62}
              textAnchor="middle"
              fill="#ffffff"
              fontSize="13"
              fontWeight="bold"
              className="drop-shadow-md"
            >
              {attendantName || "Camila"}
            </text>
            <text
              x={centerX}
              y={centerY + 76}
              textAnchor="middle"
              fill="#34d399"
              fontSize="10"
              fontWeight="600"
              className="font-mono"
            >
              ● Cérebro Ativo Online
            </text>
          </g>
        </g>
      </svg>
    </div>
  );
};
