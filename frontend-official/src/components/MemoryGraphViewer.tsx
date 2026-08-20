import React, { useRef, useEffect, useState } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { useTheme } from 'next-themes';

export interface MemoryGraphViewerProps {
  graphData: {
    nodes: any[];
    edges: any[];
  };
  width?: number;
  height?: number;
  onNodeClick?: (node: any) => void;
}

export const MemoryGraphViewer: React.FC<MemoryGraphViewerProps> = ({ graphData, width, height, onNodeClick }) => {
  const fgRef = useRef<any>();
  const { theme } = useTheme();
  const [dimensions, setDimensions] = useState({ width: width || 800, height: height || 600 });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!width || !height) {
      const updateDimensions = () => {
        if (containerRef.current) {
          setDimensions({
            width: containerRef.current.offsetWidth,
            height: containerRef.current.offsetHeight || 500,
          });
        }
      };
      updateDimensions();
      window.addEventListener('resize', updateDimensions);
      return () => window.removeEventListener('resize', updateDimensions);
    }
  }, [width, height]);

  // Obsidian-like color palette
  const getNodeColor = (type: string) => {
    switch (type) {
      case 'contact':
      case 'lead':
        return '#3b82f6'; // blue
      case 'conversation':
      case 'episode':
        return '#10b981'; // green
      case 'concept':
      case 'field':
        return '#8b5cf6'; // purple
      case 'product_media':
      case 'product':
        return '#f59e0b'; // amber
      case 'memory':
        return '#ef4444'; // red
      case 'agent':
        return '#6366f1'; // indigo
      default:
        return '#64748b'; // slate
    }
  };

  const isDark = theme === 'dark';
  const textColor = isDark ? '#e2e8f0' : '#1e293b';
  const linkColor = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)';

  return (
    <div ref={containerRef} className="w-full h-full min-h-[500px] rounded-xl overflow-hidden border border-border/50 bg-background relative shadow-inner">
      <ForceGraph2D
        ref={fgRef}
        width={dimensions.width}
        height={dimensions.height}
        graphData={{ nodes: graphData?.nodes || [], links: graphData?.edges || [] }}
        nodeLabel="label"
        nodeColor={(node: any) => getNodeColor(node.type)}
        nodeRelSize={6}
        linkColor={() => linkColor}
        linkWidth={1.5}
        linkDirectionalParticles={2}
        linkDirectionalParticleWidth={2}
        d3VelocityDecay={0.3}
        warmupTicks={100}
        cooldownTicks={100}
        nodeCanvasObject={(node: any, ctx, globalScale) => {
          const label = node.label || node.id;
          const fontSize = 12 / globalScale;
          ctx.font = `${fontSize}px Inter, sans-serif`;
          
          const radius = node.val ? Math.sqrt(node.val) * 4 : 5;
          const color = getNodeColor(node.type);

          ctx.beginPath();
          ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false);
          ctx.fillStyle = color;
          ctx.fill();
          
          // Outer glow for Obsidian effect
          ctx.shadowColor = color;
          ctx.shadowBlur = 10;

          const textWidth = ctx.measureText(label).width;
          const bckgDimensions = [textWidth, fontSize].map(n => n + fontSize * 0.2); // some padding

          ctx.fillStyle = isDark ? 'rgba(0, 0, 0, 0.7)' : 'rgba(255, 255, 255, 0.7)';
          ctx.fillRect(node.x - bckgDimensions[0] / 2, node.y + radius + 2, bckgDimensions[0], bckgDimensions[1]);

          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = textColor;
          ctx.fillText(label, node.x, node.y + radius + 2 + fontSize / 2);
        }}
        onNodeClick={(node) => {
          // Center/zoom on node
          fgRef.current?.centerAt(node.x, node.y, 1000);
          fgRef.current?.zoom(8, 2000);
          if (onNodeClick) onNodeClick(node);
        }}
      />
      <div className="absolute bottom-4 left-4 flex flex-col gap-2 p-3 bg-background/80 backdrop-blur-md border border-border rounded-lg text-xs shadow-lg">
        <h4 className="font-semibold mb-1">Legenda</h4>
        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#3b82f6]"></div> Clientes</div>
        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#10b981]"></div> Interações</div>
        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#8b5cf6]"></div> Conceitos</div>
        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#f59e0b]"></div> Produtos/Mídia</div>
      </div>
    </div>
  );
};
