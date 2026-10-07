import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ZaiAvatarRenderer } from "@/components/avatar-engine/ZaiAvatarRenderer";
import { AgentAvatarConfig } from "@/components/avatar-engine/AvatarDefinition";
import { cn } from "@/core/lib/utils";

export interface AttendantCardData {
  id: string;
  key: string;
  name: string;
  role?: string;
  isExample?: boolean;
  active?: boolean;
  avatarConfig?: Partial<AgentAvatarConfig>;
  statusLabel?: string;
}

interface AttendantItemCardProps {
  attendant: AttendantCardData;
  isSelected: boolean;
  onSelect: (attendant: AttendantCardData) => void;
  onEdit?: (attendant: AttendantCardData) => void;
}

export const AttendantItemCard: React.FC<AttendantItemCardProps> = ({
  attendant,
  isSelected,
  onSelect,
  onEdit,
}) => {
  const isExample = Boolean(attendant.isExample);

  return (
    <div
      onClick={() => onSelect(attendant)}
      className={cn(
        "group relative flex flex-col justify-between w-[150px] sm:w-[160px] h-[170px] p-2.5 rounded-2xl cursor-pointer select-none transition-all duration-200 shrink-0",
        isExample
          ? isSelected
            ? "border border-dashed border-sky-400/80 bg-sky-950/20 shadow-md shadow-sky-500/10 opacity-100"
            : "border border-dashed border-slate-700/80 bg-card/40 opacity-85 hover:opacity-100 hover:border-slate-500 hover:bg-card/70"
          : isSelected
          ? "border-2 border-emerald-500 bg-emerald-950/20 shadow-lg shadow-emerald-500/15"
          : "border border-border/80 bg-card hover:border-emerald-500/50 hover:bg-card/90"
      )}
    >
      {/* Top Tag: Real Status or Example Badge */}
      <div className="flex items-center justify-between gap-1 w-full">
        {isExample ? (
          <span className="badge-zai-example">
            Exemplo
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-emerald-400">
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                attendant.active === false
                  ? "bg-slate-500"
                  : "bg-emerald-400 shadow-xs shadow-emerald-400/80 animate-pulse"
              )}
            />
            <span className="text-[10px] font-mono text-muted-foreground">
              {attendant.active === false ? "Pausado" : "Online"}
            </span>
          </span>
        )}

        {isExample && attendant.role && (
          <span className="text-[9px] font-medium text-muted-foreground/70 truncate max-w-[70px]">
            {attendant.role.split(" ")[0]}
          </span>
        )}
      </div>

      {/* Avatar Bust */}
      <div className="relative flex items-center justify-center h-16 w-full overflow-hidden my-0.5">
        <div className="transform scale-[0.62] origin-center -translate-y-4 pointer-events-none">
          <ZaiAvatarRenderer
            avatar={attendant.avatarConfig || {}}
            state={isExample ? "IDLE" : attendant.active === false ? "IDLE" : "WORKING"}
            size="sm"
          />
        </div>
      </div>

      {/* Bottom Name & Action Button */}
      <div className="space-y-1.5 pt-1 border-t border-border/40 text-center w-full">
        <h4 className="text-xs font-bold text-foreground truncate px-1">
          {attendant.name}
        </h4>

        <Button
          type="button"
          size="sm"
          variant={isSelected ? (isExample ? "outline" : "default") : "ghost"}
          onClick={(e) => {
            e.stopPropagation();
            onEdit ? onEdit(attendant) : onSelect(attendant);
          }}
          className={cn(
            "h-6 w-full text-[11px] font-semibold rounded-lg px-2 transition-all",
            isSelected && !isExample
              ? "bg-emerald-600 hover:bg-emerald-500 text-white"
              : isSelected && isExample
              ? "border-sky-500/50 text-sky-300 hover:bg-sky-500/10"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
          )}
        >
          {isExample ? "Ver Modelo" : "Editar"}
        </Button>
      </div>
    </div>
  );
};
