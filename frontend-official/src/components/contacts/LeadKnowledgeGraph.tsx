import React, { useState, useEffect } from "react";
import {
  User,
  Package,
  Megaphone,
  Receipt,
  Robot,
  Brain,
  TreeStructure,
  Sparkle,
  ArrowRight,
  ShieldCheck,
} from "@phosphor-icons/react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { apiService } from "@/services/apiService";

interface GraphNode {
  id: string;
  label: string;
  category: string;
  type: "lead" | "product" | "campaign" | "order" | "agent" | "memory";
  details: string;
}

interface GraphEdge {
  source: string;
  target: string;
  label: string;
}

interface LeadKnowledgeGraphProps {
  leadId: string;
  leadName: string;
}

function getNodeIcon(type: GraphNode["type"]) {
  switch (type) {
    case "lead":
      return <User className="h-5 w-5 text-primary" weight="fill" />;
    case "product":
      return <Package className="h-5 w-5 text-success" weight="fill" />;
    case "campaign":
      return <Megaphone className="h-5 w-5 text-amber-400" weight="fill" />;
    case "order":
      return <Receipt className="h-5 w-5 text-info" weight="fill" />;
    case "agent":
      return <Robot className="h-5 w-5 text-purple-400" weight="fill" />;
    case "memory":
      return <Brain className="h-5 w-5 text-rose-400" weight="fill" />;
    default:
      return <TreeStructure className="h-5 w-5 text-muted-foreground" />;
  }
}

function getNodeColor(type: GraphNode["type"]) {
  switch (type) {
    case "lead":
      return "border-primary/40 bg-primary/10 text-primary";
    case "product":
      return "border-success/40 bg-success/10 text-success";
    case "campaign":
      return "border-amber-500/40 bg-amber-500/10 text-amber-400";
    case "order":
      return "border-info/40 bg-info/10 text-info";
    case "agent":
      return "border-purple-500/40 bg-purple-500/10 text-purple-400";
    case "memory":
      return "border-rose-500/40 bg-rose-500/10 text-rose-400";
    default:
      return "border-border bg-card text-muted-foreground";
  }
}

export function LeadKnowledgeGraph({ leadId, leadName }: LeadKnowledgeGraphProps) {
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);

  useEffect(() => {
    const fetchGraph = async () => {
      setLoading(true);
      try {
        const res = await apiService.getLeadKnowledgeGraph(leadId);
        if (res?.data) {
          setNodes(res.data.nodes || []);
          setEdges(res.data.edges || []);
          if (res.data.nodes?.length > 0) {
            setSelectedNode(res.data.nodes[0]);
          }
        }
      } catch (err) {
        console.warn("Failed to fetch lead knowledge graph:", err);
      } finally {
        setLoading(false);
      }
    };

    void fetchGraph();
  }, [leadId]);

  if (loading) {
    return (
      <div className="py-12 text-center text-xs text-muted-foreground animate-pulse flex items-center justify-center gap-2">
        <TreeStructure className="h-5 w-5 text-primary animate-spin" />
        Carregando Grafo de Conhecimento do Lead...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b border-border/40 pb-2">
        <div className="flex items-center gap-2 text-xs font-bold text-foreground">
          <TreeStructure className="h-4 w-4 text-primary" />
          Grafo Inteligente de Relacionamento (Knowledge Graph)
        </div>
        <Badge variant="outline" className="text-[9px] border-primary/30 text-primary">
          {nodes.length} Nós Conectados
        </Badge>
      </div>

      {/* Nodes Map Visualization */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {nodes.map((node) => (
          <button
            key={node.id}
            type="button"
            onClick={() => setSelectedNode(node)}
            className={`rounded-2xl border p-3 text-left transition-all relative overflow-hidden flex flex-col justify-between ${
              selectedNode?.id === node.id ? "ring-2 ring-primary shadow-glow" : ""
            } ${getNodeColor(node.type)}`}
          >
            <div className="flex items-center justify-between">
              <div className="h-8 w-8 rounded-xl bg-background/50 flex items-center justify-center">
                {getNodeIcon(node.type)}
              </div>
              <span className="text-[8px] uppercase tracking-wider font-bold opacity-80">{node.category}</span>
            </div>
            <div className="mt-3">
              <p className="font-bold text-xs truncate text-foreground">{node.label}</p>
              <p className="text-[10px] opacity-80 truncate mt-0.5">{node.details}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Connected Relationships Edge Details */}
      {selectedNode && (
        <Card className="rounded-2xl border-border/60 bg-card/60 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <Sparkle className="h-4 w-4 text-amber-400" />
              Conexões Ativas de: <strong className="text-primary">{selectedNode.label}</strong>
            </span>
            <Badge variant="secondary" className="text-[9px] uppercase">{selectedNode.category}</Badge>
          </div>

          <div className="space-y-1.5 pt-1">
            {edges
              .filter((edge) => edge.source === selectedNode.id || edge.target === selectedNode.id)
              .map((edge, idx) => {
                const otherNodeId = edge.source === selectedNode.id ? edge.target : edge.source;
                const otherNode = nodes.find((n) => n.id === otherNodeId);
                return (
                  <div key={idx} className="flex items-center justify-between p-2 rounded-xl bg-background/50 text-xs border border-border/30">
                    <span className="text-muted-foreground font-semibold flex items-center gap-2">
                      <ArrowRight className="h-3.5 w-3.5 text-primary" />
                      {edge.label}
                    </span>
                    <span className="font-bold text-foreground">{otherNode?.label || otherNodeId}</span>
                  </div>
                );
              })}
          </div>
        </Card>
      )}
    </div>
  );
}
