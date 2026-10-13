import React, { useState, useRef, useMemo, useEffect } from "react";
import { ZaiAvatarRenderer } from "@/components/avatar-engine/ZaiAvatarRenderer";
import { MemoryNodeData } from "./MemoryDetailDrawer";
import { cn } from "@/core/lib/utils";
import { Plus, Minus, RotateCcw } from "lucide-react";

export interface ActiveBrainGraphProps {
  attendantName: string;
  avatarConfig?: any;
  memories: MemoryNodeData[];
  centralConnectionIds?: Array<string | number>;
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
  count: number;
}

interface GraphCategoryRelationship {
  sourceCategory: string;
  targetCategory: string;
  count: number;
}

const MAX_VISIBLE_CATEGORY_MEMORIES = 8;

const GRAPH_CATEGORY_LABELS: Record<string, string> = {
  client: "Clientes",
  preference: "Preferências",
  topic: "Tópicos & Regras",
  payment: "Pagamentos & PIX",
  delivery: "Entrega & Frete",
  product: "Produtos",
  objection: "Objeções",
  unknown: "Sem categoria",
};
const GRAPH_CATEGORY_COLORS: Record<string, string> = {
  client: "#06b6d4",
  preference: "#ec4899",
  topic: "#10b981",
  payment: "#f59e0b",
  delivery: "#f43f5e",
  product: "#3b82f6",
  objection: "#8b5cf6",
};

export const ActiveBrainGraph: React.FC<ActiveBrainGraphProps> = ({
  attendantName,
  avatarConfig,
  memories,
  centralConnectionIds = [],
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

  // Category anchors are generated from the real node types returned by the API.
  const categoryBranches: GraphCategoryBranch[] = useMemo(() => {
    const categoryCounts = new Map<string, number>();
    memories.forEach((memory) => {
      const id = memory.type || memory.category || "unknown";
      categoryCounts.set(id, (categoryCounts.get(id) || 0) + 1);
    });

    const categories = [...categoryCounts.keys()];
    return categories.map((id, index) => ({
      id,
      label: GRAPH_CATEGORY_LABELS[id] || id.replace(/[_-]/g, " ").replace(/^\w/, (letter) => letter.toLocaleUpperCase("pt-BR")),
      color: GRAPH_CATEGORY_COLORS[id] || ["#14b8a6", "#f97316", "#a855f7", "#84cc16"][index % 4],
      angle: (index * 2 * Math.PI) / categories.length,
      distance: 160,
      count: categoryCounts.get(id) || 0,
    }));
  }, [memories]);

  // Filter memories if a category is selected
  const activeMemories = useMemo(() => {
    if (!selectedCategory || selectedCategory === "todos") return memories;
    return memories.filter((m) => {
      const type = m.type || m.category || "unknown";
      return type === selectedCategory;
    });
  }, [memories, selectedCategory]);

  const isAllCategories = !selectedCategory || selectedCategory === "todos";
  const showMemoryNodes = !isAllCategories && activeMemories.length <= MAX_VISIBLE_CATEGORY_MEMORIES;
  const graphMemories = showMemoryNodes ? activeMemories : [];

  const categoryPositions = useMemo(() => new Map(categoryBranches.map((branch) => [
    branch.id,
    {
      x: centerX + Math.cos(branch.angle) * branch.distance,
      y: centerY + Math.sin(branch.angle) * branch.distance,
    },
  ])), [categoryBranches, centerX, centerY]);

  const categoryRelationships: GraphCategoryRelationship[] = useMemo(() => {
    const memoryById = new Map(memories.map((memory) => [String(memory.id), memory]));
    const seen = new Set<string>();
    const counts = new Map<string, GraphCategoryRelationship>();

    memories.forEach((memory) => {
      const sourceCategory = memory.type || memory.category || "unknown";
      (memory.connectionIds || []).forEach((relatedId) => {
        const target = memoryById.get(String(relatedId));
        if (!target) return;

        const targetCategory = target.type || target.category || "unknown";
        if (sourceCategory === targetCategory) return;

        const pair = [sourceCategory, targetCategory].sort();
        const edgeKey = [String(memory.id), String(target.id)].sort().join("::");
        const categoryKey = pair.join("::");
        if (seen.has(edgeKey)) return;
        seen.add(edgeKey);

        const relationship = counts.get(categoryKey) || {
          sourceCategory: pair[0],
          targetCategory: pair[1],
          count: 0,
        };
        relationship.count += 1;
        counts.set(categoryKey, relationship);
      });
    });

    return [...counts.values()];
  }, [memories]);

  const centralCategoryConnections = useMemo(() => {
    const centralIds = new Set(centralConnectionIds.map(String));
    const counts = new Map<string, number>();
    memories.forEach((memory) => {
      if (!centralIds.has(String(memory.id))) return;
      const category = memory.type || memory.category || "unknown";
      counts.set(category, (counts.get(category) || 0) + 1);
    });
    return [...counts.entries()].map(([category, count]) => ({ category, count }));
  }, [centralConnectionIds, memories]);

  const registeredRelationshipCount = useMemo(() => {
    const memoryIds = new Set(memories.map((memory) => String(memory.id)));
    const memoryEdges = new Set<string>();
    memories.forEach((memory) => {
      (memory.connectionIds || []).forEach((relatedId) => {
        if (!memoryIds.has(String(relatedId)) || String(memory.id) === String(relatedId)) return;
        memoryEdges.add([String(memory.id), String(relatedId)].sort().join("::"));
      });
    });
    const centralEdges = new Set(centralConnectionIds.map(String).filter((id) => memoryIds.has(id)));
    return memoryEdges.size + centralEdges.size;
  }, [centralConnectionIds, memories]);

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

    graphMemories.forEach((mem) => {
      const cat = mem.type || mem.category || "unknown";
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
  }, [graphMemories, categoryBranches, centerX, centerY, selectedMemoryId]);

  const connectionLines = useMemo(() => {
    const positions = new Map(positionedNodes.map((node) => [String(node.memory.id), node]));
    const seen = new Set<string>();
    return positionedNodes.flatMap((node) => (node.memory.connectionIds || []).flatMap((relatedId) => {
      const target = positions.get(String(relatedId));
      const sourceId = String(node.memory.id);
      const targetId = String(relatedId);
      const edgeKey = [sourceId, targetId].sort().join("::");
      if (!target || seen.has(edgeKey)) return [];
      seen.add(edgeKey);
      return [{ source: node, target, key: edgeKey }];
    }));
  }, [positionedNodes]);
  const centralConnections = positionedNodes.filter((node) =>
    centralConnectionIds.some((id) => String(id) === String(node.memory.id))
  );

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

      {activeMemories.length === 0 && (
        <div role="status" className="absolute inset-x-4 top-1/2 z-10 -translate-y-1/2 text-center pointer-events-none">
          <span className="inline-block rounded-xl border border-border/70 bg-card/90 px-4 py-2 text-xs font-medium text-muted-foreground shadow-sm">
            Nenhuma memória nesta categoria
          </span>
        </div>
      )}

      {/* Number of API-backed relationships */}
      <div className="absolute bottom-3 left-3 z-20 hidden sm:flex items-center gap-3 p-1.5 px-3 rounded-xl bg-card/80 backdrop-blur-md border border-border/60 text-[10px] text-muted-foreground">
        <span className="font-bold text-foreground">Conexões registradas:</span>
        <span>{registeredRelationshipCount}</span>
      </div>

      {activeMemories.length > 0 && !showMemoryNodes && (
        <div role="status" className="absolute bottom-3 right-3 z-20 max-w-[70%] rounded-xl border border-border/70 bg-card/90 px-3 py-2 text-[10px] text-muted-foreground shadow-sm">
          {isAllCategories
            ? "Selecione uma categoria para explorar memórias individuais"
            : `Esta categoria tem ${activeMemories.length} memórias. Use a lista ao lado para explorar os registros.`}
        </div>
      )}

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

          {/* Only draw relationships returned by the memory graph API. */}
          {centralConnections.map((node) => (
            <line
              key={`agent-edge-${node.memory.id}`}
              data-testid="memory-relationship"
              x1={centerX}
              y1={centerY}
              x2={node.x}
              y2={node.y}
              stroke={node.branchColor}
              strokeWidth={node.isSelected ? "2.5" : "1.4"}
              strokeOpacity={node.isSelected ? "0.85" : "0.55"}
            />
          ))}
          {connectionLines.map(({ source, target, key }) => (
            <line
              key={`memory-edge-${key}`}
              data-testid="memory-relationship"
              x1={source.x}
              y1={source.y}
              x2={target.x}
              y2={target.y}
              stroke={source.branchColor}
              strokeWidth={source.isSelected || target.isSelected ? "2.5" : "1.4"}
              strokeOpacity={source.isSelected || target.isSelected ? "0.85" : "0.55"}
            />
          ))}

          {/* Summarize real API relationships between categories in overview mode. */}
          {!showMemoryNodes && categoryRelationships.map((relationship) => {
            const source = categoryPositions.get(relationship.sourceCategory);
            const target = categoryPositions.get(relationship.targetCategory);
            if (!source || !target) return null;

            return (
              <line
                key={`category-edge-${relationship.sourceCategory}-${relationship.targetCategory}`}
                data-testid="category-relationship"
                aria-label={`${relationship.count} ${relationship.count === 1 ? "conexão" : "conexões"} entre ${relationship.sourceCategory} e ${relationship.targetCategory}`}
                x1={source.x}
                y1={source.y}
                x2={target.x}
                y2={target.y}
                stroke="#94a3b8"
                strokeWidth={Math.min(3, 1 + Math.log2(relationship.count))}
                strokeOpacity="0.45"
              />
            );
          })}
          {!showMemoryNodes && centralCategoryConnections.map(({ category, count }) => {
            const branch = categoryBranches.find((item) => item.id === category);
            const position = categoryPositions.get(category);
            if (!branch || !position) return null;

            return (
              <line
                key={`central-category-edge-${category}`}
                data-testid="central-category-relationship"
                aria-label={`${count} conexão(ões) do atendente para ${branch.label}`}
                x1={centerX}
                y1={centerY}
                x2={position.x}
                y2={position.y}
                stroke={branch.color}
                strokeWidth={Math.min(3, 1 + Math.log2(count))}
                strokeOpacity="0.6"
              />
            );
          })}

          {/* Primary Category Branch Nodes */}
          {categoryBranches.map((branch) => {
            const bx = centerX + Math.cos(branch.angle) * branch.distance;
            const by = centerY + Math.sin(branch.angle) * branch.distance;
            const count = branch.count;

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
                data-testid="memory-leaf"
                onClick={() => onSelectMemory(item.memory)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelectMemory(item.memory);
                  }
                }}
                onMouseEnter={() => setHoveredNodeId(item.memory.id)}
                onMouseLeave={() => setHoveredNodeId(null)}
                role="button"
                tabIndex={0}
                aria-label={`Selecionar memória: ${item.memory.label}`}
                aria-pressed={item.isSelected}
                className="cursor-pointer group focus-visible:outline-none"
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
              {attendantName || "Atendente"}
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
              ● Atendente selecionado
            </text>
          </g>
        </g>
      </svg>
    </div>
  );
};
