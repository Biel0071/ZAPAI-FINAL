import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Trophy, Store, CheckCircle, ShieldCheck } from 'lucide-react';

export interface AgentHabboAvatarProps {
  agentName: string;
  agentKey: string;
  personality?: string;
  level?: string;
  score?: number;
  storeName?: string;
  status?: 'active' | 'learning' | 'paused';
  totalMemories?: number;
  conversationsCount?: number;
  onEditAgent?: () => void;
}

export const AgentHabboAvatar: React.FC<AgentHabboAvatarProps> = ({
  agentName,
  agentKey,
  personality = '',
  level = 'Nível 1',
  score = 65,
  storeName,
  status = 'active',
  totalMemories = 0,
  conversationsCount = 0,
  onEditAgent,
}) => {
  // Deterministic styling based on agent name/key
  const lowerName = (agentName || '').toLowerCase();
  const isFemale = lowerName.includes('camila') || lowerName.includes('julia') || lowerName.includes('ana') || lowerName.includes('mari');
  const isTech = lowerName.includes('pedro') || lowerName.includes('lucas') || lowerName.includes('rafael');

  // Palette selection
  const hairColor = isFemale ? '#4a2c11' : '#1f2937';
  const shirtColor = isFemale ? '#ec4899' : isTech ? '#3b82f6' : '#10b981';
  const pantsColor = '#1e293b';
  const skinColor = '#fcd34d';

  // Level classification
  const numericScore = Math.min(100, Math.max(0, score || 50));
  const levelTitle =
    numericScore >= 90 ? 'Mestre Supremo' :
    numericScore >= 75 ? 'Especialista Sênior' :
    numericScore >= 55 ? 'Atendente Pleno' :
    numericScore >= 30 ? 'Em Evolução' : 'Iniciante';

  return (
    <div className="relative rounded-2xl border border-border/60 bg-gradient-to-br from-card/80 via-card/50 to-primary/5 p-4 sm:p-5 shadow-sm hover:border-primary/40 transition-all group">
      {/* Background Habbo-style isometric grid subtle texture */}
      <div 
        className="absolute inset-0 rounded-2xl opacity-10 pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(circle at 2px 2px, currentColor 1px, transparent 0)`,
          backgroundSize: '16px 16px',
        }}
      />

      <div className="relative flex flex-col sm:flex-row items-center sm:items-start gap-5">
        
        {/* AVATAR BOX & PIXEL CHARACTER */}
        <div className="relative flex flex-col items-center shrink-0">
          
          {/* Habbo Speech Bubble */}
          <div className="mb-2 relative px-2.5 py-1 rounded-xl bg-background/90 border border-primary/30 shadow-md text-[10px] font-medium text-foreground flex items-center gap-1.5 animate-bounce-slow">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>
              {status === 'learning' ? 'Evoluindo com conversas...' :
               storeName ? `Atendendo em ${storeName}` : 'Pronta para vender!'}
            </span>
            <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-2 h-2 bg-background border-r border-b border-primary/30 rotate-45" />
          </div>

          {/* Isometric Habbo Avatar Pixel Art (SVG) */}
          <div className="relative w-24 h-28 flex items-center justify-center bg-muted/20 border-2 border-border/80 rounded-2xl p-2 shadow-inner group-hover:scale-105 transition-transform duration-300">
            <svg
              viewBox="0 0 64 80"
              className="w-full h-full drop-shadow-[0_8px_8px_rgba(0,0,0,0.4)]"
              style={{ shapeRendering: 'crispEdges' }}
            >
              {/* Shadow on floor */}
              <ellipse cx="32" cy="74" rx="18" ry="4" fill="rgba(0,0,0,0.3)" />

              {/* Shoes */}
              <rect x="22" y="66" width="8" height="6" fill="#0f172a" rx="1" />
              <rect x="34" y="66" width="8" height="6" fill="#0f172a" rx="1" />

              {/* Legs / Pants */}
              <rect x="23" y="48" width="7" height="19" fill={pantsColor} />
              <rect x="34" y="48" width="7" height="19" fill={pantsColor} />
              <rect x="23" y="46" width="18" height="4" fill="#0f172a" /> {/* Belt */}
              <rect x="30" y="46" width="4" height="4" fill="#fbbf24" /> {/* Buckle */}

              {/* Torso / Shirt */}
              <rect x="20" y="28" width="24" height="19" fill={shirtColor} rx="2" />
              
              {/* Collar / Tie or Blouse */}
              {isFemale ? (
                <>
                  <polygon points="26,28 32,36 38,28" fill="#ffffff" />
                  <rect x="28" y="32" width="8" height="4" fill={shirtColor} />
                </>
              ) : (
                <>
                  <polygon points="28,28 32,33 36,28" fill="#ffffff" />
                  <rect x="31" y="32" width="2" height="10" fill="#dc2626" /> {/* Red Tie */}
                </>
              )}

              {/* Arms */}
              <rect x="15" y="30" width="5" height="14" fill={shirtColor} rx="1" />
              <rect x="44" y="30" width="5" height="14" fill={shirtColor} rx="1" />
              {/* Hands */}
              <rect x="15" y="43" width="5" height="5" fill={skinColor} rx="1" />
              <rect x="44" y="43" width="5" height="5" fill={skinColor} rx="1" />

              {/* Head / Face */}
              <rect x="23" y="12" width="18" height="17" fill={skinColor} rx="3" />
              
              {/* Eyes (Pixel Habbo style) */}
              <rect x="26" y="19" width="3" height="4" fill="#1e293b" />
              <rect x="27" y="19" width="1" height="2" fill="#ffffff" />
              <rect x="35" y="19" width="3" height="4" fill="#1e293b" />
              <rect x="36" y="19" width="1" height="2" fill="#ffffff" />

              {/* Smile */}
              <rect x="29" y="25" width="6" height="2" fill="#991b1b" rx="1" />

              {/* Hair */}
              {isFemale ? (
                <>
                  <rect x="21" y="8" width="22" height="7" fill={hairColor} rx="3" />
                  <rect x="19" y="12" width="5" height="16" fill={hairColor} rx="2" />
                  <rect x="40" y="12" width="5" height="16" fill={hairColor} rx="2" />
                  {/* Hairclip / Ribbon */}
                  <rect x="20" y="10" width="4" height="4" fill="#f43f5e" />
                </>
              ) : (
                <>
                  <rect x="21" y="7" width="22" height="8" fill={hairColor} rx="3" />
                  <rect x="20" y="11" width="4" height="8" fill={hairColor} />
                  <rect x="40" y="11" width="4" height="8" fill={hairColor} />
                </>
              )}

              {/* Badge on chest */}
              <circle cx="38" cy="34" r="2" fill="#fbbf24" />
            </svg>

            {/* Level Orb */}
            <div className="absolute -bottom-2 -right-2 px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground font-black text-[9px] shadow-sm flex items-center gap-0.5 border-2 border-background">
              <Trophy className="w-2.5 h-2.5 text-amber-300" />
              <span>{Math.floor(numericScore / 10)}</span>
            </div>
          </div>

          <span className="mt-2 text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-widest">
            {levelTitle}
          </span>
        </div>

        {/* INFO & EVOLUTION METRICS */}
        <div className="flex-1 w-full space-y-3">
          
          {/* Header Line */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-foreground flex items-center gap-1.5">
                  {agentName || 'Atendente IA'}
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                </h3>
                <Badge variant="outline" className="text-[10px] border-primary/30 text-primary bg-primary/5">
                  Persona White-Label
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                {personality || 'Atendente comercial ágil, empática e focada em fechamento.'}
              </p>
            </div>

            {onEditAgent && (
              <button
                onClick={onEditAgent}
                className="text-xs font-semibold text-primary hover:underline"
              >
                Ajustar Instruções
              </button>
            )}
          </div>

          {/* Loja Vinculada (White-Label Badge) */}
          <div className="flex items-center gap-2 p-2 rounded-xl bg-background/50 border border-border/50 text-xs">
            <Store className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="text-muted-foreground">Loja Atual:</span>
            <strong className="text-foreground">{storeName || 'Loja Padrão (White-Label)'}</strong>
            <span className="text-[10px] text-muted-foreground ml-auto hidden sm:inline">
              (Reutilizável em qualquer loja)
            </span>
          </div>

          {/* Progress Bar of Agent Maturity */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground font-medium flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-primary" /> Maturidade Comportamental
              </span>
              <strong className="font-mono text-primary">{numericScore}/100</strong>
            </div>
            <div className="h-2.5 w-full rounded-full bg-muted/60 overflow-hidden p-0.5">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary via-emerald-400 to-teal-400 transition-all duration-700"
                style={{ width: `${numericScore}%` }}
              />
            </div>
          </div>

          {/* Badges / Micro-stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px]">
            <div className="p-2 rounded-lg bg-background/40 border border-border/40 text-center">
              <span className="block text-[10px] text-muted-foreground">Conversas</span>
              <strong className="text-foreground">{conversationsCount}</strong>
            </div>
            <div className="p-2 rounded-lg bg-background/40 border border-border/40 text-center">
              <span className="block text-[10px] text-muted-foreground">Memórias no Grafo</span>
              <strong className="text-foreground text-primary">{totalMemories}</strong>
            </div>
            <div className="p-2 rounded-lg bg-background/40 border border-border/40 text-center">
              <span className="block text-[10px] text-muted-foreground">Estilo</span>
              <strong className="text-emerald-400">Consultivo</strong>
            </div>
            <div className="p-2 rounded-lg bg-background/40 border border-border/40 text-center">
              <span className="block text-[10px] text-muted-foreground">Preços Oficiais</span>
              <strong className="text-foreground flex items-center justify-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-400" /> Protegidos
              </strong>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
