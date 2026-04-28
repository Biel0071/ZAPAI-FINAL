import { useCallback, useEffect, useMemo, useState } from 'react';
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  addEdge,
  Connection,
  Edge,
  Node,
  useEdgesState,
  useNodesState,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Button } from '../components/ui/Button';
import { FlowPalette } from '../components/modules/flows/FlowPalette';
import { Card } from '../components/ui/Card';
import { SidePanel } from '../components/ui/SidePanel';
import { api } from '../lib/api';
import { Flow } from '../types';

const blockTypes = ['message', 'image', 'audio', 'condition', 'delay'];

export default function FlowBuilderPage() {
  const [flows, setFlows] = useState<Flow[]>([]);
  const [selectedFlowId, setSelectedFlowId] = useState<string | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  useEffect(() => {
    void api.get<Flow[]>('/api/flows').then((items) => {
      setFlows(items);
      if (items[0]) {
        setSelectedFlowId(items[0].id);
      }
    });
  }, []);

  const currentFlow = useMemo(() => flows.find((item) => item.id === selectedFlowId) || null, [flows, selectedFlowId]);

  useEffect(() => {
    if (!currentFlow) {
      setNodes([]);
      setEdges([]);
      return;
    }

    const nextNodes: Node[] = currentFlow.nodes.map((node) => ({
      id: node.id,
      data: { label: `${node.type.toUpperCase()} - ${node.label}` },
      position: node.position,
      type: 'default',
    }));

    const nextEdges: Edge[] = currentFlow.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      label: edge.label,
    }));

    setNodes(nextNodes);
    setEdges(nextEdges);
  }, [currentFlow, setEdges, setNodes]);

  const onConnect = useCallback((params: Connection) => setEdges((prev) => addEdge(params, prev)), [setEdges]);

  async function createFlow() {
    const created = await api.post<Flow>('/api/flows', {
      name: `Fluxo ${Date.now()}`,
      nodes: [
        {
          id: 'start',
          type: 'message',
          label: 'Inicio',
          position: { x: 60, y: 80 },
          config: {},
        },
      ],
      edges: [],
      rules: [{ type: 'first_message', value: 'true', active: true }],
    });

    setFlows([created, ...flows]);
    setSelectedFlowId(created.id);
  }

  async function saveFlow() {
    if (!selectedFlowId) {
      return;
    }

    await api.put(`/api/flows/${selectedFlowId}`, {
      nodes: nodes.map((node) => ({
        id: node.id,
        type: String((node.data as { label?: string })?.label || 'message').toLowerCase(),
        label: String((node.data as { label?: string })?.label || node.id),
        position: node.position,
      })),
      edges: edges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        label: edge.label,
      })),
      rules: currentFlow?.rules || [],
    });

    const refreshed = await api.get<Flow[]>('/api/flows');
    setFlows(refreshed);
  }

  function addNode(type: string) {
    const id = `${type}-${Date.now()}`;
    setNodes((prev) => [
      ...prev,
      {
        id,
        data: { label: type },
        position: { x: 180 + prev.length * 30, y: 100 + prev.length * 30 },
      },
    ]);
  }

  return (
    <div className="space-y-4">
      <div className="crm-card bg-panelSoft/80 flex items-center justify-between p-5">
        <div>
          <h2 className="text-2xl font-semibold text-textPrimary">Flow Builder</h2>
          <p className="text-sm text-textSecondary">Canvas visual com blocos arrastaveis, regras e triggers.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={createFlow}>Novo fluxo</Button>
          <Button onClick={saveFlow}>Salvar alteracoes</Button>
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-[280px,1fr,300px]">
        <SidePanel title="Blocos" subtitle="Acoes, regras e triggers">
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-textMuted">Acoes</p>
              <FlowPalette blockTypes={blockTypes} onAddBlock={addNode} />
            </div>

            <div className="rounded-lg border border-borderSoft bg-panelSoft p-3">
              <p className="text-xs font-semibold text-textSecondary">Regras</p>
              <ul className="mt-2 space-y-1 text-xs text-textMuted">
                <li>Primeira mensagem</li>
                <li>Horario comercial</li>
                <li>Tag do lead</li>
              </ul>
            </div>

            <div className="rounded-lg border border-borderSoft bg-panelSoft p-3">
              <p className="text-xs font-semibold text-textSecondary">Triggers</p>
              <ul className="mt-2 space-y-1 text-xs text-textMuted">
                <li>Mensagem recebida</li>
                <li>Tempo sem resposta</li>
                <li>Evento de campanha</li>
              </ul>
            </div>
          </div>
        </SidePanel>

        <Card className="h-[640px]">
          <div className="mb-3 flex flex-wrap items-center gap-2 border-b border-borderSoft pb-3">
            {flows.map((flow) => (
              <button
                key={flow.id}
                onClick={() => setSelectedFlowId(flow.id)}
                className={`rounded-lg border px-3 py-1 text-xs transition ${
                  selectedFlowId === flow.id
                    ? 'border-accent/60 bg-accent/20 text-textPrimary shadow-glow'
                    : 'border-borderSoft bg-panelSoft text-textSecondary hover:border-accentBlue/40'
                }`}
              >
                {flow.name}
              </button>
            ))}
          </div>

          <div className="h-[560px] overflow-hidden rounded-lg border border-borderSoft bg-panelSoft">
            <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} fitView>
              <Background variant={BackgroundVariant.Dots} gap={18} size={1} color="#334155" />
              <Controls />
            </ReactFlow>
          </div>
        </Card>

        <SidePanel title="Painel de Fluxo" subtitle="Resumo e status">
          <div className="space-y-3 text-sm">
            <div className="rounded-lg border border-borderSoft bg-panelSoft p-3">
              <p className="text-xs text-textSecondary">Fluxo atual</p>
              <p className="mt-1 font-semibold text-textPrimary">{currentFlow?.name || 'Nenhum selecionado'}</p>
            </div>

            <div className="rounded-lg border border-borderSoft bg-panelSoft p-3">
              <p className="text-xs text-textSecondary">Nós e conexoes</p>
              <p className="mt-1 text-textPrimary">{nodes.length} nos</p>
              <p className="text-textPrimary">{edges.length} conexoes</p>
            </div>

            <div className="rounded-lg border border-borderSoft bg-panelSoft p-3">
              <p className="text-xs text-textSecondary">Regras ativas</p>
              <ul className="mt-2 space-y-1 text-xs text-textMuted">
                {(currentFlow?.rules || []).slice(0, 4).map((rule) => (
                  <li key={rule.id}>{rule.type}: {rule.value}</li>
                ))}
                {(currentFlow?.rules || []).length === 0 ? <li>Nenhuma regra definida.</li> : null}
              </ul>
            </div>
          </div>
        </SidePanel>
      </div>
    </div>
  );
}
